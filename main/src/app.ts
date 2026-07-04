import express from 'express'; 
import {Request, Response} from 'express'; 
import cors from 'cors'; 
import {createConnection} from "typeorm"; 
import * as amqp from 'amqplib/callback_api'; 
import {Product} from "./entity/product"; 
import axios from 'axios'; 

// Detect if we are using a cloud MongoDB Atlas connection string string
const isCloudMongo = process.env.TYPEORM_HOST && process.env.TYPEORM_HOST.startsWith('mongodb');

createConnection({
    type: "mongodb",
    url: isCloudMongo ? process.env.TYPEORM_HOST : undefined,
    host: isCloudMongo ? undefined : (process.env.TYPEORM_HOST || "localhost"),
    port: isCloudMongo ? undefined : 27017,
    database: process.env.TYPEORM_DATABASE || "yt_node_main",
    useUnifiedTopology: true,
    entities: [Product],
    synchronize: true,
    logging: false
}).then(db => { 
    const productRepository = db.getMongoRepository(Product); 
    
    amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost', (error0, connection) => { 
        if (error0) { 
            throw error0; 
        } 
        connection.createChannel((error1, channel) => { 
            if (error1) { 
                throw error1; 
            } 
            channel.assertQueue('product_created', {durable: false}); 
            channel.assertQueue('product_updated', {durable: false}); 
            channel.assertQueue('product_deleted', {durable: false}); 
            
            const app = express(); 
            app.use(cors({ 
                origin: ['http://localhost:3000', 'http://localhost:8080', 'http://localhost:4200'] 
            })); 
            app.use(express.json()); 

            channel.consume('product_created', async (msg) => { 
                if (!msg) return; 
                const eventProduct = JSON.parse(msg.content.toString()); 
                const product = new Product(); 
                product.admin_id = parseInt(eventProduct.id); 
                product.title = eventProduct.title; 
                product.image = eventProduct.image; 
                product.likes = eventProduct.likes; 
                await productRepository.save(product); 
                console.log('product created'); 
            }, {noAck: true}); 

            channel.consume('product_updated', async (msg) => { 
                if (!msg) return; 
                const eventProduct = JSON.parse(msg.content.toString()); 
                const product = await productRepository.findOne({admin_id: parseInt(eventProduct.id)}); 
                if (!product) return; 
                productRepository.merge(product, { 
                    title: eventProduct.title, 
                    image: eventProduct.image, 
                    likes: eventProduct.likes 
                }); 
                await productRepository.save(product); 
                console.log('product updated'); 
            }, {noAck: true}); 

            channel.consume('product_deleted', async (msg) => { 
                if (!msg) return; 
                const admin_id = parseInt(msg.content.toString()); 
                await productRepository.deleteOne({admin_id}); 
                console.log('product deleted'); 
            }); 

            app.get('/api/products', async (req: Request, res: Response) => { 
                const products = await productRepository.find(); 
                return res.send(products); 
            }); 

            app.post('/api/products/:id/like', async (req: Request, res: Response) => { 
                const product = await productRepository.findOne(req.params.id); 
                if (!product) return res.status(404).json({message: 'Product not found'}); 
                
                // Dynamic routing: points to the live Admin URL on Render, or falls back to local
                const adminApiUrl = process.env.ADMIN_API_URL || 'http://localhost:8000';
                await axios.post(`${adminApiUrl}/api/products/${product.admin_id}/like`, {}); 
                                 
                product.likes++; 
                await productRepository.save(product); 
                return res.send(product); 
            }); 

            console.log('Listening to port: 8001'); 
            app.listen(8001); 
            process.on('beforeExit', () => { 
                console.log('closing'); 
                connection.close(); 
            }); 
        }); 
    }); 
});
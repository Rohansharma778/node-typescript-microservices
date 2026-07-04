import express from 'express'; 
import {Request, Response} from 'express'; 
import cors from 'cors'; 
import {createConnection} from 'typeorm'; 
import {Product} from "./entity/product"; 
import * as amqp from 'amqplib/callback_api'; 

// Explicitly pass connection settings into createConnection
createConnection({
    type: "mysql",
    host: process.env.TYPEORM_HOST || "localhost",
    port: parseInt(process.env.TYPEORM_PORT || "3306"),
    username: process.env.TYPEORM_USERNAME || "root",
    password: process.env.TYPEORM_PASSWORD || "rootroot",
    database: process.env.TYPEORM_DATABASE || "yt_node_admin",
    // Encrypt traffic when running on a remote cloud host (TiDB requirement)
    ssl: process.env.TYPEORM_HOST ? { rejectUnauthorized: true } : false,
    entities: [
        Product
        // Keep your existing entity declarations right here
    ],
    synchronize: true,
    logging: false
}).then(db => { 
    const productRepository = db.getRepository(Product); 
    
    // amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost', (error0, connection) => { 
    //     if (error0) { 
    //         throw error0; 
    //     } 
    let amqpOptions = {};

    if (process.env.RABBITMQ_URL && process.env.RABBITMQ_URL.startsWith("amqps")) {
    try {
        // Dynamically extract the hostname to satisfy strict SNI routing rules
        const brokerHostname = new URL(process.env.RABBITMQ_URL).hostname;
        amqpOptions = {
            servername: brokerHostname,
            rejectUnauthorized: false // Bypasses strict authority certificate drops
        };
    } catch (err) {
        console.error("Failed to parse RABBITMQ_URL:", err);
    }
    }
    amqp.connect(process.env.RABBITMQ_URL || "amqp://localhost", function (error0, connection) {
        if (error0) {
            console.error("RabbitMQ Connection Error Details:", error0);
            throw error0;
        }
        connection.createChannel((error1, channel) => { 
            if (error1) { 
                throw error1; 
            } 
            const app = express(); 
            app.use(cors({ 
                origin: ['http://localhost:3000', 'http://localhost:8080', 'http://localhost:4200'] 
            })); 

            app.use(express.json()); 

            app.get('/api/products', async (req: Request, res: Response) => { 
                const products = await productRepository.find(); 
                res.json(products); 
            }); 

            app.post('/api/products', async (req: Request, res: Response) => { 
                const product = await productRepository.create(req.body); 
                const result = await productRepository.save(product); 
                channel.sendToQueue('product_created', Buffer.from(JSON.stringify(result))); 
                return res.send(result); 
            }); 

            app.get('/api/products/:id', async (req: Request, res: Response) => { 
                const product = await productRepository.findOne(req.params.id); 
                if (!product) return res.status(404).json({message: 'Product not found'}); 
                return res.send(product); 
            }); 

            app.put('/api/products/:id', async (req: Request, res: Response) => { 
                const product = await productRepository.findOne(req.params.id); 
                if (!product) return res.status(404).json({message: 'Product not found'}); 
                                 
                productRepository.merge(product, req.body); 
                const result = await productRepository.save(product); 
                channel.sendToQueue('product_updated', Buffer.from(JSON.stringify(result))); 
                return res.send(result); 
            }); 

            app.delete('/api/products/:id', async (req: Request, res: Response) => { 
                const result = await productRepository.delete(req.params.id); 
                channel.sendToQueue('product_deleted', Buffer.from(req.params.id)); 
                return res.send(result); 
            }); 

            app.post('/api/products/:id/like', async (req: Request, res: Response) => { 
                const product = await productRepository.findOne(req.params.id); 
                if (!product) return res.status(404).json({message: 'Product not found'}); 
                                 
                product.likes++; 
                const result = await productRepository.save(product); 
                return res.send(result); 
            }); 

            console.log('Listening to port: 8000'); 
            app.listen(8000); 
            process.on('beforeExit', () => { 
                console.log('closing'); 
                connection.close(); 
            }); 
        }); 
    }); 
});
import express = require('express');
import cors = require('cors');
import { createConnection } from 'typeorm';
import * as amqp from 'amqplib/callback_api';
import { Product } from "./entity/product";
import axios from 'axios';

createConnection({
    type: "mongodb",
    url: process.env.MONGO_URL || undefined,
    host: process.env.MONGO_URL ? undefined : "localhost",
    port: process.env.MONGO_URL ? undefined : 27017,
    database: "yt_node_main",
    useUnifiedTopology: true,
    synchronize: true,
    logging: false,
    entities: [
        Product
    ]
}).then(db => {
    const productRepository = db.getMongoRepository(Product);

    let amqpOptions = {};
    if (process.env.RABBITMQ_URL && process.env.RABBITMQ_URL.startsWith("amqps")) {
        try {
            const brokerHostname = new URL(process.env.RABBITMQ_URL).hostname;
            amqpOptions = {
                servername: brokerHostname,
                rejectUnauthorized: false
            };
        } catch (err) {
            console.error("Failed to parse RABBITMQ_URL:", err);
        }
    }

    amqp.connect(process.env.RABBITMQ_URL || "amqp://localhost", amqpOptions, (error0, connection) => {
        if (error0) {
            throw error0;
        }

        connection.createChannel((error1, channel) => {
            if (error1) {
                throw error1;
            }

            channel.assertQueue('product_created', { durable: false });
            channel.assertQueue('product_updated', { durable: false });
            channel.assertQueue('product_deleted', { durable: false });

            const app = express();

            app.use(cors({
                origin: ['http://localhost:3000', 'http://localhost:8080', 'http://localhost:4200']
            }));

            app.use(express.json());

            channel.consume('product_created', async (msg) => {
                if (msg) {
                    const eventProduct = JSON.parse(msg.content.toString());
                    const product = new Product();
                    product.admin_id = parseInt(eventProduct.id);
                    product.title = eventProduct.title;
                    product.image = eventProduct.image;
                    product.likes = eventProduct.likes;
                    await productRepository.save(product);
                    console.log('product created');
                }
            }, { noAck: true });

            channel.consume('product_updated', async (msg) => {
                if (msg) {
                    const eventProduct = JSON.parse(msg.content.toString());
                    const product = await productRepository.findOne({ admin_id: parseInt(eventProduct.id) });
                    if (product) {
                        productRepository.merge(product, {
                            title: eventProduct.title,
                            image: eventProduct.image,
                            likes: eventProduct.likes
                        });
                        await productRepository.save(product);
                        console.log('product updated');
                    }
                }
            }, { noAck: true });

            channel.consume('product_deleted', async (msg) => {
                if (msg) {
                    const admin_id = parseInt(msg.content.toString());
                    await productRepository.deleteOne({ admin_id });
                    console.log('product deleted');
                }
            }, { noAck: true });

            app.get('/api/products', async (req: express.Request, res: express.Response) => {
                const products = await productRepository.find();
                return res.send(products);
            });

            app.post('/api/products/:id/like', async (req: express.Request, res: express.Response) => {
                const product = await productRepository.findOne(req.params.id);
                if (product) {
                    const adminUrl = process.env.ADMIN_BACKEND_URL || "http://localhost:8000";
                    await axios.post(`${adminUrl}/api/products/${product.admin_id}/like`, {});
                    product.likes++;
                    await productRepository.save(product);
                    return res.send(product);
                }
                return res.status(404).send({ message: "Product not found" });
            });

            app.listen(8001, () => {
                console.log('Listening to port: 8001');
            });
        });
    });
});
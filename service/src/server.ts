import express from 'express';
import http from 'http';
import * as dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

import schema from '../schema/db-schema.json';
import Applier, { Schema } from '../../../shared/schema-applier/src/applier';
import Config from '../../../config/mongodb-config';
import * as _mongodbConfig from '../../../config/mongodb-config.json';

import Registrar from '../../../shared/registrar/src/registrar';
if (process.env.NODE_ENV === 'local') dotenv.config({ path: './.env.local' });

const mongodbConfig = _mongodbConfig as Config;

const config = mongodbConfig[process.env.NODE_ENV || 'development'];
const options = Object.entries(config.options).map(([key, value]) => `${key}=${value}`).join('&');

const uri = `mongodb://${config.ip}/?${options}`;
const client = new MongoClient(uri);
const db = client.db(config.db);

const applier = new Applier(config);
applier.apply(schema as Schema);

const app = express();
const server = http.createServer(app);

app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: '1mb' }));

app.get('/ping', async (_, res) => {
    return res.status(200).send({ message: `pong from ${process.env.INSTANCE_ID}` });
});

const port = process.env.PORT || 8080;

server.listen(port, () => {
    console.log(process.env.INSTANCE_ID, 'running on port', +port);
});

const registrarParams = {
    appId: process.env.APP_ID,
    instanceId: process.env.INSTANCE_ID,
    hostName: process.env.INSTANCE_ID,
    ipAddr: process.env.INSTANCE_ID,
    port: process.env.PORT || 8080,
    vipAddr: 'localhost',
    eureka: {
        eurekaHost: process.env.EUREKA_HOST,
        eurekaPort: process.env.EUREKA_PORT,
    }
};

const registrar = new Registrar(registrarParams);
registrar.start();

if (process.platform === 'win32') {
    require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    }).on('SIGINT', () => {
        registrar.stop(() => {
            process.exit(0);
        });
    });
}

process.on('SIGINT', () => {
    registrar.stop(() => {
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    registrar.stop(() => {
        process.exit(0);
    });
});
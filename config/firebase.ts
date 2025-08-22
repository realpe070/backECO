import * as admin from 'firebase-admin';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

// Update CORS options
export const corsOptions = {
    origin: [
        'http://localhost:3000',
        'http://localhost:4300',
        'http://localhost:59055',
        'http://localhost:62878',
        'https://ecoadmin.onrender.com',
        'https://ecoapp.onrender.com'
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    optionsSuccessStatus: 204,
    allowedHeaders: [
        'Content-Type',
        'Accept',
        'Authorization',
        'Origin',
        'X-Requested-With'
    ]
};

const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
});

export default admin;

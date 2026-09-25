import express from 'express';
import cookieParser from 'cookie-parser';
import { apiRouter } from '../server/api';

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Mount API routes
app.use('/api', apiRouter);

export default app;

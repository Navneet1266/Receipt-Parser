import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { initDb } from './db';
import { receiptsRouter } from './routes/receipts';

dotenv.config();

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.');
  process.exit(1);
}

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api/receipts', receiptsRouter);

initDb();

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { parseReceiptImage } from '../services/llm';
import { getAllReceipts, getReceipt, insertReceipt, updateReceipt } from '../db';
import { Receipt, LineItem } from '../types';

export const receiptsRouter = express.Router();

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    cb(null, ['image/jpeg', 'image/png'].includes(file.mimetype));
  },
  limits: { fileSize: 15 * 1024 * 1024 },
});

// POST /api/receipts/upload
receiptsRouter.post('/upload', upload.single('image'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No image file provided or unsupported type (use JPEG/PNG)' });
    return;
  }

  try {
    const parsed = await parseReceiptImage(req.file.path);

    const receipt: Receipt = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      imagePath: req.file.filename,
      merchant: parsed.merchant ?? '',
      date: parsed.date ?? '',
      lineItems: parsed.lineItems ?? [],
      total: parsed.total ?? 0,
      currency: parsed.currency ?? 'USD',
      rawParsed: parsed,
      isCorrected: false,
    };

    insertReceipt(receipt);
    res.json(receipt);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to process receipt' });
  }
});

// GET /api/receipts
receiptsRouter.get('/', (_req, res) => {
  res.json(getAllReceipts());
});

// GET /api/receipts/:id
receiptsRouter.get('/:id', (req, res) => {
  const receipt = getReceipt(req.params.id);
  if (!receipt) {
    res.status(404).json({ error: 'Receipt not found' });
    return;
  }
  res.json(receipt);
});

// PUT /api/receipts/:id
receiptsRouter.put('/:id', (req, res) => {
  const existing = getReceipt(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Receipt not found' });
    return;
  }

  const { merchant, date, lineItems, total, currency } = req.body as {
    merchant: string;
    date: string;
    lineItems: LineItem[];
    total: number;
    currency?: string;
  };

  const ok = updateReceipt(req.params.id, {
    merchant,
    date,
    lineItems,
    total,
    currency: currency ?? 'USD',
    isCorrected: true,
    updatedAt: new Date().toISOString(),
  });

  res.json({ ok });
});

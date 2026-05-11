import fs from 'fs';
import path from 'path';
import { Receipt } from './types';

const DATA_DIR = path.join(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'receipts.json');

interface Store { receipts: Receipt[] }

function ensureFile(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ receipts: [] }));
}

function read(): Store {
  ensureFile();
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')) as Store;
}

function write(store: Store): void {
  fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2));
}

export function initDb(): void {
  ensureFile();
}

export function getAllReceipts(): Receipt[] {
  return read().receipts.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getReceipt(id: string): Receipt | undefined {
  return read().receipts.find(r => r.id === id);
}

export function insertReceipt(receipt: Receipt): void {
  const store = read();
  store.receipts.push(receipt);
  write(store);
}

export function updateReceipt(id: string, patch: Partial<Receipt>): boolean {
  const store = read();
  const idx = store.receipts.findIndex(r => r.id === id);
  if (idx === -1) return false;
  store.receipts[idx] = { ...store.receipts[idx], ...patch };
  write(store);
  return true;
}

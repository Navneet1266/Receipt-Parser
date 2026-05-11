export type LineItemType = 'item' | 'tax' | 'tip' | 'discount' | 'subtotal' | 'fee';

export interface LineItem {
  id: string;
  name: string;
  amount: number;
  type: LineItemType;
  confidence: number;
}

export interface ParsedReceipt {
  merchant: string;
  merchantConfidence: number;
  date: string | null;
  dateConfidence: number;
  lineItems: LineItem[];
  total: number | null;
  totalConfidence: number;
  currency: string;
  overallConfidence: number;
  notes?: string;
}

export interface Receipt {
  id: string;
  createdAt: string;
  updatedAt?: string;
  imagePath?: string;
  merchant: string;
  date: string;
  lineItems: LineItem[];
  total: number;
  currency: string;
  rawParsed: ParsedReceipt;
  isCorrected: boolean;
}

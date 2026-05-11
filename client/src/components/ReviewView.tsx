import { useState, useCallback } from 'react';
import { Receipt, LineItem, LineItemType } from '../types';

interface Props {
  receipt: Receipt;
  onSaved: () => void;
  onBack: () => void;
}

interface EditState {
  merchant: string;
  date: string;
  lineItems: LineItem[];
  total: string;
  currency: string;
}

const LINE_ITEM_TYPES: LineItemType[] = ['item', 'tax', 'tip', 'discount', 'subtotal', 'fee'];

function confidenceLevel(c: number): 'high' | 'medium' | 'low' {
  if (c >= 0.85) return 'high';
  if (c >= 0.5) return 'medium';
  return 'low';
}

function ConfidenceDot({ confidence }: { confidence: number }) {
  const level = confidenceLevel(confidence);
  const label = `${Math.round(confidence * 100)}% confident`;
  return (
    <span
      className={`conf-dot conf-${level}`}
      title={label}
      aria-label={label}
    />
  );
}

function sumItems(items: LineItem[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

export default function ReviewView({ receipt, onSaved, onBack }: Props) {
  const raw = receipt.rawParsed;

  const [edit, setEdit] = useState<EditState>({
    merchant: receipt.merchant,
    date: receipt.date,
    lineItems: receipt.lineItems.map(li => ({ ...li })),
    total: String(receipt.total ?? ''),
    currency: receipt.currency,
  });

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const computedSum = sumItems(edit.lineItems);
  const parsedTotal = parseFloat(edit.total) || 0;
  const totalMismatch = edit.lineItems.length > 0 && Math.abs(computedSum - parsedTotal) > 0.02;

  function updateItem(id: string, field: keyof LineItem, value: string | number) {
    setEdit(prev => ({
      ...prev,
      lineItems: prev.lineItems.map(li =>
        li.id === id ? { ...li, [field]: field === 'amount' ? parseFloat(value as string) || 0 : value } : li,
      ),
    }));
  }

  function addItem() {
    const newItem: LineItem = {
      id: `new-${Date.now()}`,
      name: '',
      amount: 0,
      type: 'item',
      confidence: 1,
    };
    setEdit(prev => ({ ...prev, lineItems: [...prev.lineItems, newItem] }));
  }

  function removeItem(id: string) {
    setEdit(prev => ({ ...prev, lineItems: prev.lineItems.filter(li => li.id !== id) }));
  }

  function recalcTotal() {
    setEdit(prev => ({ ...prev, total: computedSum.toFixed(2) }));
  }

  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    setErrorMsg('');
    try {
      const res = await fetch(`/api/receipts/${receipt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant: edit.merchant,
          date: edit.date,
          lineItems: edit.lineItems,
          total: parseFloat(edit.total) || 0,
          currency: edit.currency,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaveStatus('saved');
      setTimeout(onSaved, 800);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Save failed');
      setSaveStatus('error');
    }
  }, [receipt.id, edit, onSaved]);

  function reset() {
    setEdit({
      merchant: receipt.merchant,
      date: receipt.date,
      lineItems: receipt.lineItems.map(li => ({ ...li })),
      total: String(receipt.total ?? ''),
      currency: receipt.currency,
    });
    setSaveStatus('idle');
    setErrorMsg('');
  }

  const overallConf = raw.overallConfidence ?? 0;
  const imageUrl = receipt.imagePath ? `/uploads/${receipt.imagePath}` : null;

  return (
    <div className="review-page">
      <div className="review-topbar">
        <button className="btn-ghost" onClick={onBack}>
          ← Back
        </button>
        <div className="review-topbar-right">
          {overallConf > 0 && (
            <span className={`overall-badge conf-${confidenceLevel(overallConf)}`}>
              {Math.round(overallConf * 100)}% overall confidence
            </span>
          )}
          <button className="btn-ghost" onClick={reset} disabled={saveStatus === 'saving'}>
            Reset
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saveStatus === 'saving' || saveStatus === 'saved'}
          >
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </div>

      {saveStatus === 'error' && (
        <div className="alert-error" role="alert">{errorMsg}</div>
      )}

      {raw.notes && (
        <div className="notes-banner" role="note">
          <strong>Parser note:</strong> {raw.notes}
        </div>
      )}

      <div className="review-layout">
        {imageUrl && (
          <aside className="image-panel">
            <p className="panel-label">Receipt image</p>
            <img src={imageUrl} alt="Uploaded receipt" className="receipt-img" />
          </aside>
        )}

        <main className="fields-panel">
          {/* Merchant */}
          <div className="field-row">
            <label className="field-label">
              <ConfidenceDot confidence={raw.merchantConfidence ?? 0} />
              Merchant
            </label>
            <input
              className={`field-input conf-bg-${confidenceLevel(raw.merchantConfidence ?? 0)}`}
              value={edit.merchant}
              onChange={e => setEdit(p => ({ ...p, merchant: e.target.value }))}
              placeholder="Merchant name"
            />
          </div>

          {/* Date */}
          <div className="field-row">
            <label className="field-label">
              <ConfidenceDot confidence={raw.dateConfidence ?? 0} />
              Date
            </label>
            <input
              type="date"
              className={`field-input conf-bg-${confidenceLevel(raw.dateConfidence ?? 0)}`}
              value={edit.date}
              onChange={e => setEdit(p => ({ ...p, date: e.target.value }))}
            />
          </div>

          {/* Currency */}
          <div className="field-row">
            <label className="field-label">Currency</label>
            <input
              className="field-input field-input-sm"
              value={edit.currency}
              onChange={e => setEdit(p => ({ ...p, currency: e.target.value.toUpperCase() }))}
              maxLength={3}
              placeholder="USD"
            />
          </div>

          {/* Line Items */}
          <div className="line-items-section">
            <div className="line-items-header">
              <h2 className="section-title">Line Items</h2>
              <button className="btn-add" onClick={addItem}>+ Add row</button>
            </div>

            {edit.lineItems.length === 0 ? (
              <p className="empty-items">No line items. Add one manually or re-upload a clearer image.</p>
            ) : (
              <div className="line-items-table-wrap">
                <table className="line-items-table">
                  <thead>
                    <tr>
                      <th style={{ width: 20 }} />
                      <th>Type</th>
                      <th>Description</th>
                      <th className="col-right">Amount</th>
                      <th style={{ width: 32 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {edit.lineItems.map(item => (
                      <tr key={item.id} className={`item-row conf-row-${confidenceLevel(item.confidence)}`}>
                        <td>
                          <ConfidenceDot confidence={item.confidence} />
                        </td>
                        <td>
                          <select
                            className="select-type"
                            value={item.type}
                            onChange={e => updateItem(item.id, 'type', e.target.value)}
                          >
                            {LINE_ITEM_TYPES.map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            className="input-name"
                            value={item.name}
                            onChange={e => updateItem(item.id, 'name', e.target.value)}
                            placeholder="Description"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            className="input-amount"
                            value={item.amount}
                            onChange={e => updateItem(item.id, 'amount', e.target.value)}
                          />
                        </td>
                        <td>
                          <button
                            className="btn-remove"
                            onClick={() => removeItem(item.id)}
                            aria-label="Remove item"
                            title="Remove"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Total */}
          <div className="field-row total-row">
            <label className="field-label">
              <ConfidenceDot confidence={raw.totalConfidence ?? 0} />
              Total
            </label>
            <div className="total-input-group">
              <input
                type="number"
                step="0.01"
                className={`field-input field-input-total conf-bg-${confidenceLevel(raw.totalConfidence ?? 0)}`}
                value={edit.total}
                onChange={e => setEdit(p => ({ ...p, total: e.target.value }))}
                placeholder="0.00"
              />
              {totalMismatch && (
                <div className="total-mismatch" role="alert">
                  <span>
                    ⚠ Item sum is <strong>{edit.currency} {computedSum.toFixed(2)}</strong>.
                  </span>
                  <button className="btn-recalc" onClick={recalcTotal}>
                    Use sum
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="conf-legend">
            <span className="conf-dot conf-high" /> High confidence
            <span className="conf-dot conf-medium" /> Review suggested
            <span className="conf-dot conf-low" /> Low — please verify
          </div>
        </main>
      </div>
    </div>
  );
}

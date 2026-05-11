import { useState, useEffect } from 'react';
import { Receipt } from '../types';

interface Props {
  onSelect: (receipt: Receipt) => void;
}

export default function ReceiptList({ onSelect }: Props) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/receipts')
      .then(r => r.json())
      .then((data: Receipt[]) => { setReceipts(data); setLoading(false); })
      .catch(() => { setError('Could not load saved receipts.'); setLoading(false); });
  }, []);

  if (loading) return <p className="list-status">Loading saved receipts…</p>;
  if (error) return <p className="list-status error-msg">{error}</p>;
  if (receipts.length === 0) return null;

  return (
    <section className="receipt-list-section">
      <h2 className="section-title">Saved Receipts</h2>
      <ul className="receipt-list">
        {receipts.map(r => (
          <li key={r.id}>
            <button className="receipt-card" onClick={() => onSelect(r)}>
              <div className="card-left">
                {r.imagePath && (
                  <img
                    src={`/uploads/${r.imagePath}`}
                    alt="Receipt thumbnail"
                    className="card-thumb"
                  />
                )}
              </div>
              <div className="card-body">
                <div className="card-merchant">{r.merchant || <em>Unknown merchant</em>}</div>
                <div className="card-meta">
                  {r.date && <span>{r.date}</span>}
                  {r.total != null && (
                    <span className="card-total">{r.currency} {r.total.toFixed(2)}</span>
                  )}
                </div>
              </div>
              <div className="card-right">
                {r.isCorrected && <span className="badge-corrected">corrected</span>}
                <span className="card-arrow">›</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

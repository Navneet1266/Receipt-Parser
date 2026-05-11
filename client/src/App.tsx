import { useState } from 'react';
import { Receipt } from './types';
import UploadView from './components/UploadView';
import ReviewView from './components/ReviewView';
import ReceiptList from './components/ReceiptList';

type View =
  | { kind: 'home' }
  | { kind: 'reviewing'; receipt: Receipt };

export default function App() {
  const [view, setView] = useState<View>({ kind: 'home' });
  const [listKey, setListKey] = useState(0);

  function handleUploaded(receipt: Receipt) {
    setView({ kind: 'reviewing', receipt });
  }

  function handleSaved() {
    setListKey(k => k + 1);
    setView({ kind: 'home' });
  }

  function handleSelectReceipt(receipt: Receipt) {
    setView({ kind: 'reviewing', receipt });
  }

  if (view.kind === 'reviewing') {
    return (
      <ReviewView
        receipt={view.receipt}
        onSaved={handleSaved}
        onBack={() => setView({ kind: 'home' })}
      />
    );
  }

  return (
    <div className="home">
      <header className="home-header">
        <h1>Receipt Parser</h1>
        <p className="subtitle">Upload a receipt photo to extract and correct structured data.</p>
      </header>
      <UploadView onUploaded={handleUploaded} />
      <ReceiptList key={listKey} onSelect={handleSelectReceipt} />
    </div>
  );
}

import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { Receipt } from '../types';

interface Props {
  onUploaded: (receipt: Receipt) => void;
}

export default function UploadView({ onUploaded }: Props) {
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    if (!file.type.match(/image\/(jpeg|png)/)) {
      setErrorMsg('Only JPEG and PNG files are supported.');
      setStatus('error');
      return;
    }

    setPreview(URL.createObjectURL(file));
    setStatus('uploading');
    setErrorMsg('');

    const form = new FormData();
    form.append('image', file);

    try {
      const res = await fetch('/api/receipts/upload', { method: 'POST', body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const receipt: Receipt = await res.json();
      onUploaded(receipt);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed');
      setStatus('error');
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  return (
    <section className="upload-section">
      <div
        className={`drop-zone ${dragging ? 'dragging' : ''} ${status === 'uploading' ? 'loading' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => status !== 'uploading' && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
        aria-label="Upload receipt image"
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          className="file-input"
          onChange={onFileChange}
        />

        {status === 'uploading' ? (
          <div className="upload-state">
            {preview && <img src={preview} alt="Receipt preview" className="preview-thumb" />}
            <div className="spinner" aria-hidden="true" />
            <p>Parsing receipt with Claude…</p>
          </div>
        ) : (
          <div className="upload-state">
            <div className="upload-icon" aria-hidden="true">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="drop-label">
              <strong>Drop a receipt here</strong> or click to browse
            </p>
            <p className="drop-hint">JPEG or PNG, up to 15 MB</p>
          </div>
        )}
      </div>

      {status === 'error' && (
        <p className="error-msg" role="alert">{errorMsg}</p>
      )}
    </section>
  );
}

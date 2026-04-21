import { useEffect, useRef, useState } from 'react';

export default function WorkDetailsModal({ projectName, elapsedMs, onSave, onSkip }) {
  const [notes, setNotes] = useState('');
  const textareaRef = useRef(null);
  const modalRef = useRef(null);

  const totalSeconds = Math.max(0, Math.floor((elapsedMs || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const today = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const summary = `${projectName || 'Project'} — ${hours}h ${minutes}m logged on ${today}`;

  const canSave = notes.trim().length >= 3;

  useEffect(() => {
    if (textareaRef.current) textareaRef.current.focus();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onSkip();
      } else if ((e.key === 'Enter') && (e.metaKey || e.ctrlKey)) {
        if (notes.trim().length >= 3) {
          e.preventDefault();
          onSave(notes.trim());
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [notes, onSave, onSkip]);

  // Simple focus trap within the modal
  const handleKeyDown = (e) => {
    if (e.key !== 'Tab') return;
    const root = modalRef.current;
    if (!root) return;
    const focusable = root.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="work-details-title"
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        zIndex: 9999,
      }}
    >
      <div
        ref={modalRef}
        style={{
          width: '100%',
          maxWidth: 260,
          background: '#fff',
          borderRadius: 8,
          padding: 14,
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <h2
          id="work-details-title"
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
            color: '#3C3C3C',
          }}
        >
          What did you work on?
        </h2>
        <div style={{ fontSize: 13, color: '#6b7280' }}>{summary}</div>
        <textarea
          ref={textareaRef}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Briefly describe the work done (e.g., 'Reviewed Chapter 3 assessment rubric, drafted feedback for peer review')"
          style={{
            minHeight: 90,
            fontSize: 14,
            padding: 10,
            border: '1px solid #ddd',
            borderRadius: 6,
            fontFamily: 'inherit',
            resize: 'vertical',
          }}
        />
        <button
          type="button"
          onClick={() => onSave(notes.trim())}
          disabled={!canSave}
          style={{
            minHeight: 44,
            fontSize: 15,
            fontWeight: 600,
            color: '#fff',
            background: canSave ? '#E31B54' : '#E31B54',
            border: 'none',
            borderRadius: 6,
            cursor: canSave ? 'pointer' : 'not-allowed',
            opacity: canSave ? 1 : 0.5,
          }}
        >
          Save entry
        </button>
        <button
          type="button"
          onClick={onSkip}
          style={{
            background: 'none',
            border: 'none',
            color: '#6b7280',
            textDecoration: 'underline',
            fontSize: 13,
            cursor: 'pointer',
            padding: 6,
          }}
        >
          Skip &amp; save anyway
        </button>
      </div>
    </div>
  );
}

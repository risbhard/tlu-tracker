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
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        if (notes.trim().length >= 3) {
          e.preventDefault();
          onSave(notes.trim());
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [notes, onSave, onSkip]);

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
      className="wd-overlay"
    >
      <div ref={modalRef} className="wd-card">
        <h2 id="work-details-title" className="wd-title">
          What did you work on?
        </h2>
        <div className="wd-summary">{summary}</div>
        <textarea
          ref={textareaRef}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Briefly describe the work done (e.g., 'Reviewed Chapter 3 assessment rubric, drafted feedback for peer review')"
          className="wd-textarea"
        />
        <button
          type="button"
          onClick={() => onSave(notes.trim())}
          disabled={!canSave}
          className="btn-primary full-width wd-save"
        >
          Save entry
        </button>
        <button type="button" onClick={onSkip} className="wd-skip">
          Skip &amp; save anyway
        </button>
      </div>
    </div>
  );
}

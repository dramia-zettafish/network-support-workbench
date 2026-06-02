'use client';

import { useEffect, useState } from 'react';
import { copyTextToClipboard } from '../../lib/clipboard';
import styles from './ReviewCopyPanel.module.css';

export default function ReviewCopyPanel({
  title = 'Review Response',
  purpose,
  initialMessage,
  confirmLabel = 'Copy Message',
  cancelLabel = 'Back',
  onConfirmCopy,
  onCancel
}) {
  const [message, setMessage] = useState(initialMessage || '');
  const [feedback, setFeedback] = useState(null);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    setMessage(initialMessage || '');
    setFeedback(null);
  }, [initialMessage]);

  async function handleConfirmCopy() {
    setCopying(true);
    setFeedback(null);

    try {
      await copyTextToClipboard(message);
    } catch (error) {
      setFeedback({ type: 'error', text: 'Copy failed. Try again or copy the text manually.' });
      setCopying(false);
      return;
    }

    try {
      setFeedback({ type: 'success', text: 'Copied. Updating workflow...' });
      await onConfirmCopy?.(message);
    } catch (error) {
      setFeedback({ type: 'error', text: 'Copied, but the workflow update failed.' });
      setCopying(false);
      return;
    }

    setCopying(false);
  }

  return (
    <section className={styles.panel} aria-label={title}>
      <div className={styles.header}>
        <div>
          <h3>{title}</h3>
          {purpose && <p>{purpose}</p>}
        </div>
        <button type="button" className="secondaryButton compactButton" onClick={() => setMessage(initialMessage || '')} disabled={copying}>
          Reset to Generated Text
        </button>
      </div>

      <label className={styles.messageField}>
        Message
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={14} disabled={copying} />
      </label>

      {feedback && <p className={`${styles.feedback} ${styles[feedback.type]}`}>{feedback.text}</p>}

      <div className={styles.actions}>
        <button type="button" className="primaryButton" onClick={handleConfirmCopy} disabled={copying || !message.trim()}>
          {copying ? 'Copying...' : confirmLabel}
        </button>
        <button type="button" className="secondaryButton" onClick={onCancel} disabled={copying}>
          {cancelLabel}
        </button>
      </div>
    </section>
  );
}

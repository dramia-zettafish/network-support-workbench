'use client';

import { useEffect, useState } from 'react';
import { copyTextToClipboard } from '../../lib/clipboard';
import SpotlightPanel from '../ui/SpotlightPanel';
import { useToast } from '../ui/ToastProvider';
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
  const { showToast } = useToast();
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
      showToast({
        type: 'error',
        title: 'Copy failed',
        message: 'Try again or copy the text manually.'
      });
      setCopying(false);
      return;
    }

    try {
      setFeedback({ type: 'info', text: 'Copied. Updating workflow...' });
      if (onConfirmCopy) {
        await onConfirmCopy(message);
      } else {
        showToast({ type: 'success', title: 'Message copied' });
      }
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Workflow update failed',
        message: 'The message was copied, but the workflow update did not complete.'
      });
      setCopying(false);
      return;
    }

    setCopying(false);
  }

  return (
    <SpotlightPanel as="section" className={styles.panel} mode="interactive" aria-label={title}>
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
    </SpotlightPanel>
  );
}

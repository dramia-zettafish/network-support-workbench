import styles from './Modal.module.css';
import SpotlightPanel from './SpotlightPanel';

export default function Modal({ title, children, footer, onClose, label, size = 'default', spotlight = false, spotlightMode = 'static' }) {
  const Surface = spotlight ? SpotlightPanel : 'section';
  const surfaceProps = spotlight ? { as: 'section', intensity: 'subtle', mode: spotlightMode } : {};

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={onClose}>
      <Surface
        {...surfaceProps}
        className={`${styles.modal} ${size === 'wide' ? styles.wide : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label || title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          {title && <h2>{title}</h2>}
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close modal">
            x
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </Surface>
    </div>
  );
}

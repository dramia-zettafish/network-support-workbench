import styles from './Modal.module.css';

export default function Modal({ title, children, footer, onClose, label, size = 'default' }) {
  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={onClose}>
      <section
        className={`${styles.modal} ${size === 'wide' ? styles.wide : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label || title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close modal">
          x
        </button>
        {title && <h2>{title}</h2>}
        {children}
        {footer && <div className={styles.footer}>{footer}</div>}
      </section>
    </div>
  );
}

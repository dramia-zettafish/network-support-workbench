import styles from './SectionCard.module.css';

export default function SectionCard({ title, description, actions, children, className = '' }) {
  return (
    <section className={`${styles.card} ${className}`}>
      {(title || description || actions) && (
        <div className={styles.header}>
          <div>
            {title && <h2>{title}</h2>}
            {description && <p>{description}</p>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

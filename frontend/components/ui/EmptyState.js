import styles from './EmptyState.module.css';

export default function EmptyState({ title = 'No records found', description }) {
  return (
    <div className={styles.empty}>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
    </div>
  );
}

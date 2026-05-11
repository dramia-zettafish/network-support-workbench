import StatusBadge from './StatusBadge';
import styles from './StatCard.module.css';

export default function StatCard({ label, value, detail, status, onClick }) {
  const Component = onClick ? 'button' : 'article';

  return (
    <Component
      className={`${styles.card} ${onClick ? styles.clickable : ''}`}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      <div className={styles.topline}>
        <p>{label}</p>
        {status && <StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
      </div>
      <strong>{value}</strong>
      {detail && <span>{detail}</span>}
    </Component>
  );
}

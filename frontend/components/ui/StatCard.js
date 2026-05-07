import StatusBadge from './StatusBadge';
import styles from './StatCard.module.css';

export default function StatCard({ label, value, detail, status }) {
  return (
    <article className={styles.card}>
      <div className={styles.topline}>
        <p>{label}</p>
        {status && <StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
      </div>
      <strong>{value}</strong>
      {detail && <span>{detail}</span>}
    </article>
  );
}

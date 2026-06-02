import StatusBadge from './StatusBadge';
import SpotlightPanel from './SpotlightPanel';
import styles from './StatCard.module.css';

export default function StatCard({ label, value, detail, status, onClick }) {
  const Component = onClick ? 'button' : 'article';

  return (
    <SpotlightPanel
      as={Component}
      className={`${styles.card} ${onClick ? styles.clickable : ''}`}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      intensity="soft"
    >
      <div className={styles.topline}>
        <p>{label}</p>
        {status && <StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
      </div>
      <strong>{value}</strong>
      {detail && <span>{detail}</span>}
    </SpotlightPanel>
  );
}

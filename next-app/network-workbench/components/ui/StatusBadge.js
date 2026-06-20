import styles from './StatusBadge.module.css';

const toneClassMap = {
  neutral: styles.neutral,
  success: styles.success,
  warning: styles.warning,
  danger: styles.danger,
  info: styles.info
};

export default function StatusBadge({ children, tone = 'neutral' }) {
  return <span className={`${styles.badge} ${toneClassMap[tone] || styles.neutral}`}>{children}</span>;
}

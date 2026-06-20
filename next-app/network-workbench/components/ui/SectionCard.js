import styles from './SectionCard.module.css';
import SpotlightPanel from './SpotlightPanel';

export default function SectionCard({ title, description, actions, children, className = '', spotlight = false, spotlightMode = 'static' }) {
  const Surface = spotlight ? SpotlightPanel : 'section';
  const surfaceProps = spotlight ? { as: 'section', intensity: 'subtle', mode: spotlightMode } : {};

  return (
    <Surface className={`${styles.card} ${className}`} {...surfaceProps}>
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
    </Surface>
  );
}

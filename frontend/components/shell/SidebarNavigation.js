import styles from './SidebarNavigation.module.css';

export default function SidebarNavigation({ items, activeItem, onChange }) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span>NV</span>
        <div>
          <strong>Network Vcode</strong>
          <p>Operations console</p>
        </div>
      </div>

      <nav className={styles.nav} aria-label="Application workspaces">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-current={activeItem === item.id ? 'page' : undefined}
            onClick={() => onChange?.(item.id)}
          >
            <span>{item.label}</span>
            {item.meta && <small>{item.meta}</small>}
          </button>
        ))}
      </nav>
    </aside>
  );
}

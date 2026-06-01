import styles from './TabNavigation.module.css';

export default function TabNavigation({ tabs, activeTab, onChange, label = 'Tabs' }) {
  return (
    <nav className={styles.tabbar} aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={styles.tab}
          aria-selected={activeTab === tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

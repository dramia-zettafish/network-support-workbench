import styles from './SpotlightPanel.module.css';

export default function SpotlightPanel({
  children,
  className = '',
  intensity = 'subtle',
  as: Component = 'div',
  ...props
}) {
  const intensityClass = styles[intensity] || styles.subtle;
  const classes = [styles.panel, intensityClass, className].filter(Boolean).join(' ');

  return (
    <Component className={classes} {...props}>
      {children}
    </Component>
  );
}

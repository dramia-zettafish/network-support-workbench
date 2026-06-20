'use client';

import styles from './SpotlightPanel.module.css';

export default function SpotlightPanel({
  children,
  className = '',
  intensity = 'subtle',
  mode = 'static',
  as: Component = 'div',
  onPointerMove,
  onPointerEnter,
  ...props
}) {
  const intensityClass = styles[intensity] || styles.subtle;
  const modeClass = mode === 'interactive' ? styles.interactive : styles.static;
  const classes = [styles.panel, modeClass, intensityClass, className].filter(Boolean).join(' ');

  function syncPointer(event) {
    if (onPointerMove) {
      onPointerMove(event);
    }

    if (mode !== 'interactive' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--spotlight-x', `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty('--spotlight-y', `${event.clientY - rect.top}px`);
  }

  function handlePointerEnter(event) {
    if (onPointerEnter) {
      onPointerEnter(event);
    }

    syncPointer(event);
  }

  return (
    <Component
      {...props}
      className={classes}
      onPointerEnter={mode === 'interactive' ? handlePointerEnter : onPointerEnter}
      onPointerMove={mode === 'interactive' ? syncPointer : onPointerMove}
    >
      {children}
    </Component>
  );
}

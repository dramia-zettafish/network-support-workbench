import SpotlightPanel from '../ui/SpotlightPanel';
import styles from './UpsStatusStepper.module.css';

const steps = [
  { status: 'intake', label: 'Pending' },
  { status: 'scheduled', label: 'Scheduled' },
  { status: 'servicing', label: 'Servicing' },
  { status: 'confirm_ip', label: 'Confirm IP' },
  { status: 'fulfilled', label: 'Fulfilled' }
];

export default function UpsStatusStepper({ status, snmpIp }) {
  const currentIndex = Math.max(0, steps.findIndex((step) => step.status === status));
  const missingFulfilledIp = status === 'fulfilled' && !String(snmpIp || '').trim();

  return (
    <SpotlightPanel className={styles.stepper} aria-label="UPS workflow status">
      <ol className={styles.steps}>
        {steps.map((step, index) => {
          const state = index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'pending';
          return (
            <li key={step.status} className={`${styles.step} ${styles[state]}`}>
              <span className={styles.marker} aria-hidden="true">{index < currentIndex ? '✓' : index + 1}</span>
              <span>{step.label}</span>
            </li>
          );
        })}
      </ol>
      {missingFulfilledIp && <p className={styles.warning}>Fulfilled, missing SNMP IP</p>}
    </SpotlightPanel>
  );
}

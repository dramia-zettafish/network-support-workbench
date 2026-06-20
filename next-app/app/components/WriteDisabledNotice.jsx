'use client';

/**
 * WriteDisabledNotice — client-side banner indicating write operations are disabled.
 *
 * This component reads the NEXT_PUBLIC_WRITES_ENABLED environment variable and
 * displays a visible notice when write operations are not available. It renders
 * nothing when writes are enabled.
 *
 * Usage:
 *   import WriteDisabledNotice from '@/app/components/WriteDisabledNotice';
 *
 *   export default function SomePage() {
 *     return (
 *       <div>
 *         <WriteDisabledNotice />
 *         {/* rest of page content *\/}
 *       </div>
 *     );
 *   }
 *
 * This is a presentation-only component — no API calls, no database interaction.
 */

/**
 * Inline styles for the read-only notice banner.
 */
const bannerStyle = {
  backgroundColor: '#fff3cd',
  border: '1px solid #ffc107',
  borderRadius: '6px',
  padding: '12px 16px',
  margin: '12px 0',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  fontSize: '14px',
  color: '#856404',
  lineHeight: '1.5',
};

const iconStyle = {
  fontSize: '18px',
  flexShrink: 0,
};

const textStyle = {
  flex: 1,
};

/**
 * Displays a read-only mode notice banner when write operations are disabled.
 * Renders null (nothing) when writes are enabled.
 *
 * @returns {JSX.Element|null}
 */
export default function WriteDisabledNotice() {
  const writesEnabled = process.env.NEXT_PUBLIC_WRITES_ENABLED;

  if (writesEnabled === 'true') {
    return null;
  }

  return (
    <div style={bannerStyle} role="alert" aria-live="polite">
      <span style={iconStyle} aria-hidden="true">
        ℹ️
      </span>
      <span style={textStyle}>
        <strong>Read-Only Mode:</strong> Write operations are not yet available.
        This application is currently in read-only mode.
      </span>
    </div>
  );
}

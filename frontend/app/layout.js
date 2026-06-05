import './globals.css';
import AppShell from '../components/shell/AppShell';
import { ToastProvider } from '../components/ui/ToastProvider';
import { appDisplayName } from '../lib/publicConfig';

export const metadata = {
  title: appDisplayName,
  description: 'Ticket and UPS workflow tracker'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var stored = localStorage.getItem('network-vcode-theme');
                if (stored === 'light') document.documentElement.dataset.theme = 'light';
              } catch (_) {}
            `
          }}
        />
      </head>
      <body>
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}

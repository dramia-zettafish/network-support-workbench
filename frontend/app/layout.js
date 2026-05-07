import './globals.css';

export const metadata = {
  title: 'End User Operations Network Team',
  description: 'Ticket, RMA, and UPS workflow tracker'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

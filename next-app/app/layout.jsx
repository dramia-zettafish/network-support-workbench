import './globals.css';
import NavHeader from './components/nav-header.jsx';
import UserActivityHeartbeat from './components/user-activity-heartbeat.jsx';
import ThemeProvider from './components/theme-provider.jsx';
import WorkspaceProvider from './components/workspace-provider.jsx';

export const metadata = {
  title: 'EU Support',
  description: 'EU Support Operations Dashboard - Next.js Shell',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('eus_theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}` }} />
      </head>
      <body>
        <ThemeProvider>
          <WorkspaceProvider>
            <UserActivityHeartbeat />
            <NavHeader />
            <div className="pt-6">
              {children}
            </div>
          </WorkspaceProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

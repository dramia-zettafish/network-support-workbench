import AppShell from '../components/shell/AppShell';
import NetworkingWorkspace from '../components/networking/NetworkingWorkspace';

export default function Home() {
  return (
    <AppShell activeWorkspace="networking">
      <NetworkingWorkspace />
    </AppShell>
  );
}

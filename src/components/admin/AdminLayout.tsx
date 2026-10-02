import { AdminDashboard } from './AdminDashboard';

interface AdminLayoutProps {
  onNavigatePublic: () => void;
}

export function AdminLayout({ onNavigatePublic }: AdminLayoutProps) {
  return (
    <AdminDashboard
      onLogout={onNavigatePublic}
      onNavigatePublic={onNavigatePublic}
    />
  );
}

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { checkAuthStatus, logoutAdmin } from '../../services/auth';
import { AdminLogin } from './AdminLogin';
import { AdminDashboard } from './AdminDashboard';

interface AdminLayoutProps {
  onNavigatePublic: () => void;
}

export function AdminLayout({ onNavigatePublic }: AdminLayoutProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const verify = async () => {
      setIsLoading(true);
      try {
        const res = await checkAuthStatus();
        setIsAuthenticated(res.authenticated);
      } catch {
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    verify();
  }, []);

  const handleLogout = async () => {
    await logoutAdmin();
    setIsAuthenticated(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-950 font-mono font-bold flex items-center justify-center text-sm shadow-md">
            TB
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
            <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
            <span>Verifying admin session...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AdminLogin
        onLoginSuccess={() => setIsAuthenticated(true)}
        onNavigatePublic={onNavigatePublic}
      />
    );
  }

  return <AdminDashboard onLogout={handleLogout} onNavigatePublic={onNavigatePublic} />;
}

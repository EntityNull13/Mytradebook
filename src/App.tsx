import { useState, useEffect } from 'react';
import { PublicLayout } from './components/public/PublicLayout';
import { AdminLayout } from './components/admin/AdminLayout';

export function App() {
  const getInitialPath = () => {
    const p = window.location.pathname;
    if (p.startsWith('/admin')) return p;
    const h = window.location.hash.replace(/^#/, '');
    if (h.startsWith('/admin')) return h;
    return p;
  };

  const [currentPath, setCurrentPath] = useState(getInitialPath);

  useEffect(() => {
    const onLocationChange = () => {
      const p = window.location.pathname;
      if (p.startsWith('/admin')) {
        setCurrentPath(p);
        return;
      }
      const h = window.location.hash.replace(/^#/, '');
      if (h.startsWith('/admin')) {
        setCurrentPath(h);
        return;
      }
      setCurrentPath(p);
    };

    window.addEventListener('popstate', onLocationChange);
    window.addEventListener('hashchange', onLocationChange);
    return () => {
      window.removeEventListener('popstate', onLocationChange);
      window.removeEventListener('hashchange', onLocationChange);
    };
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  const isAdminRoute = currentPath.startsWith('/admin');

  if (isAdminRoute) {
    return <AdminLayout onNavigatePublic={() => navigate('/')} />;
  }

  return <PublicLayout onNavigateAdmin={() => navigate('/admin')} />;
}

export default App;

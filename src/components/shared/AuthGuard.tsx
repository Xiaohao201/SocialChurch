import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserContext } from '@/context/AuthContext';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

const AuthGuard = ({ children, requireAdmin = false }: AuthGuardProps) => {
  const { user, isAuthenticated } = useUserContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/sign-in');
      return;
    }

    if (user.mustChangePassword && window.location.pathname !== '/change-password') {
      navigate('/change-password');
      return;
    }

    if (user.status === 'disabled') {
      navigate('/sign-in');
      return;
    }

    if (requireAdmin && !user.isAdmin) {
      navigate('/');
      return;
    }
  }, [isAuthenticated, user, navigate, requireAdmin]);

  if (!isAuthenticated || user.mustChangePassword || user.status === 'disabled') {
    return null;
  }

  return <>{children}</>;
};

export default AuthGuard; 
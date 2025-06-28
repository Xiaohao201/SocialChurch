import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserContext } from '@/context/AuthContext';

interface RequirePasswordChangeProps {
  children: React.ReactNode;
}

const RequirePasswordChange = ({ children }: RequirePasswordChangeProps) => {
  const { user } = useUserContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (user.mustChangePassword) {
      navigate('/change-password');
    }
  }, [user.mustChangePassword, navigate]);

  return <>{children}</>;
};

export default RequirePasswordChange; 
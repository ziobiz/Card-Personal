import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import OtpChallenge from '../components/OtpChallenge';
import { useAuth } from '../hooks/useAuth';

export default function MemberOtp() {
  const navigate = useNavigate();
  const { setToken } = useAuth();
  const enrollToken = useMemo(() => sessionStorage.getItem('memberOtpEnroll') || '', []);
  const mode = enrollToken ? 'setup' : 'verify';

  return (
    <OtpChallenge
      mode={mode}
      enrollToken={enrollToken}
      backHref="/login"
      onSetup={(token) => api.auth.setupOtp(token)}
      onActivate={async (token, code) => {
        const r = await api.auth.activateOtp(token, code);
        sessionStorage.removeItem('memberOtpEnroll');
        return r;
      }}
      onVerify={(code) => api.auth.verifyOtp(code)}
      onSuccess={(token) => {
        setToken(token);
        navigate('/');
      }}
    />
  );
}

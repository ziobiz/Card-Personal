import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import OtpChallenge from '../../components/OtpChallenge';
import { setAdminToken } from '../../lib/adminSession';

export default function AdminOtp() {
  const navigate = useNavigate();
  const enrollToken = useMemo(() => sessionStorage.getItem('adminOtpEnroll') || '', []);
  const mode = enrollToken ? 'setup' : 'verify';

  return (
    <OtpChallenge
      admin
      mode={mode}
      enrollToken={enrollToken}
      backHref="/admin/login"
      onSetup={(token) => api.admin.setupOtp(token)}
      onActivate={async (token, code) => {
        const r = await api.admin.activateOtp(token, code);
        sessionStorage.removeItem('adminOtpEnroll');
        return r;
      }}
      onVerify={(code) => api.admin.verifyOtp(code)}
      onSuccess={(token) => {
        setAdminToken(token);
        sessionStorage.removeItem('adminMustChangePassword');
        navigate('/admin/dashboard', { replace: true });
      }}
    />
  );
}

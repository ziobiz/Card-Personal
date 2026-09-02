import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CardIssue from './pages/CardIssue';
import CardManage from './pages/CardManage';
import Activity from './pages/Activity';
import Earn from './pages/Earn';
import AdminLogin from './pages/admin/AdminLogin';
import AdminPassword from './pages/admin/AdminPassword';
import AdminOtp from './pages/admin/AdminOtp';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminOperators from './pages/admin/AdminOperators';
import AdminMembers from './pages/admin/AdminMembers';
import AdminCards from './pages/admin/AdminCards';
import AdminSettings from './pages/admin/AdminSettings';
import AdminPartners from './pages/admin/AdminPartners';
import AdminPartnerRegister from './pages/admin/AdminPartnerRegister';
import AdminOrg from './pages/admin/AdminOrg';
import AdminFeePolicy from './pages/admin/AdminFeePolicy';
import AdminBrand from './pages/admin/AdminBrand';
import AdminMyInfo from './pages/admin/AdminMyInfo';
import PartnerLayout from './components/PartnerLayout';
import PartnerLogin from './pages/partner/PartnerLogin';
import PartnerPassword from './pages/partner/PartnerPassword';
import PartnerOtp from './pages/partner/PartnerOtp';
import PartnerHome from './pages/partner/PartnerHome';
import PartnerApi from './pages/partner/PartnerApi';
import PartnerFees from './pages/partner/PartnerFees';
import PartnerManual from './pages/partner/PartnerManual';
import MemberOtp from './pages/MemberOtp';
import { useAuth } from './hooks/useAuth';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { pathname } = useLocation();
  const shell = pathname.startsWith('/admin')
    ? 'is-admin'
    : pathname.startsWith('/partner')
      ? 'partner-portal'
      : 'user-app';

  return (
    <div className={shell}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/otp" element={<MemberOtp />} />
        <Route path="/register" element={<Register />} />
        <Route path="/partner/login" element={<PartnerLogin />} />
        <Route path="/partner/password" element={<PartnerPassword />} />
        <Route path="/partner/otp" element={<PartnerOtp />} />
        <Route path="/partner" element={<PartnerLayout />}>
          <Route index element={<PartnerHome />} />
          <Route path="api" element={<PartnerApi />} />
          <Route path="fees" element={<PartnerFees />} />
          <Route path="manual" element={<PartnerManual />} />
        </Route>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="cards" element={<Navigate to="/cards/issue" replace />} />
          <Route path="cards/issue" element={<CardIssue />} />
          <Route path="cards/manage" element={<CardManage />} />
          <Route path="earn" element={<Earn />} />
          <Route path="activity" element={<Activity />} />
        </Route>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/password" element={<AdminPassword />} />
        <Route path="/admin/otp" element={<AdminOtp />} />
        <Route
          path="/admin"
          element={
            <AdminProtectedRoute>
              <AdminLayout />
            </AdminProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<Navigate to="/admin/operators" replace />} />
          <Route path="operators" element={<AdminOperators scope="HQ" />} />
          <Route path="operators/partner" element={<AdminOperators scope="PARTNER" />} />
          <Route path="members" element={<AdminMembers source="direct" />} />
          <Route path="members/partner" element={<AdminMembers source="partner" />} />
          <Route path="cards" element={<AdminCards />} />
          <Route path="partners/new" element={<AdminPartnerRegister />} />
          <Route path="partners" element={<AdminPartners />} />
          <Route path="org" element={<AdminOrg />} />
          <Route path="fee-list" element={<AdminFeePolicy view="list" />} />
          <Route path="fee-policy" element={<AdminFeePolicy view="manage" />} />
        <Route path="brand" element={<AdminBrand />} />
        <Route path="me" element={<AdminMyInfo />} />
        <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Routes>
    </div>
  );
}

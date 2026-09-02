import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { startRegistration } from '@simplewebauthn/browser';
import { api, type MemberProfile } from '../api';

export default function Account() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const [secMsg, setSecMsg] = useState('');
  const [secErr, setSecErr] = useState('');
  const [secBusy, setSecBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const p = await api.user.get();
      setProfile(p);
      setDisplayName(p.displayName || '');
      setPhone(p.phone || '');
      setCountry(p.country || '');
    } catch (e) {
      setProfileErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg('');
    setProfileErr('');
    try {
      const r = await api.user.updateProfile({ displayName, phone, country });
      setProfile(r.user);
      setProfileMsg(t('account.profileSaved'));
    } catch (err) {
      setProfileErr((err as Error).message);
    } finally {
      setProfileSaving(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg('');
    setPwErr('');
    if (newPassword.length < 6) {
      setPwErr(t('account.passwordMin'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwErr(t('account.passwordMismatch'));
      return;
    }
    setPwSaving(true);
    try {
      await api.user.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwMsg(t('account.passwordChanged'));
    } catch (err) {
      setPwErr((err as Error).message);
    } finally {
      setPwSaving(false);
    }
  };

  const enrollBiometric = async () => {
    setSecBusy(true);
    setSecMsg('');
    setSecErr('');
    try {
      const options = await api.auth.webauthnRegisterOptions();
      const attestation = await startRegistration({ optionsJSON: options as never });
      await api.auth.webauthnRegisterVerify(attestation);
      setSecMsg(t('account.biometricEnabled'));
      await load();
    } catch (err) {
      setSecErr((err as Error).message || t('auth.biometricEnrollFailed'));
    } finally {
      setSecBusy(false);
    }
  };

  const clearBiometric = async () => {
    if (!window.confirm(t('account.biometricClearConfirm'))) return;
    setSecBusy(true);
    setSecMsg('');
    setSecErr('');
    try {
      await api.user.clearBiometric();
      setSecMsg(t('account.biometricCleared'));
      await load();
    } catch (err) {
      setSecErr((err as Error).message);
    } finally {
      setSecBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="app-container">
        <p className="muted-text">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="app-container wx-account">
      <div className="page-header">
        <h1 className="page-title">{t('account.title')}</h1>
      </div>
      <p className="muted-text" style={{ marginTop: 0 }}>
        {t('account.intro')}
      </p>

      <section className="card-surface wx-account-card">
        <h2 className="section-title">{t('account.loginSection')}</h2>
        <p className="muted-text wx-account-hint">{t('account.loginHint')}</p>
        <label className="wx-account-field">
          <span>{t('account.loginId')}</span>
          <input className="input" value={profile?.email || ''} readOnly />
        </label>
        <div className="wx-account-meta">
          <span>
            {t('account.memberSince')}:{' '}
            {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—'}
          </span>
          <span>
            {t('account.kyc')}: {profile?.kycStatus || 'pending'}
          </span>
        </div>
      </section>

      <section className="card-surface wx-account-card">
        <h2 className="section-title">{t('account.profileSection')}</h2>
        <form onSubmit={saveProfile} className="wx-account-form">
          {profileErr ? <div className="auth-error">{profileErr}</div> : null}
          {profileMsg ? <p className="wx-account-ok">{profileMsg}</p> : null}
          <label className="wx-account-field">
            <span>{t('account.displayName')}</span>
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('account.displayNamePh')}
              maxLength={80}
              autoComplete="name"
            />
          </label>
          <label className="wx-account-field">
            <span>{t('account.phone')}</span>
            <input
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('account.phonePh')}
              maxLength={32}
              autoComplete="tel"
            />
          </label>
          <label className="wx-account-field">
            <span>{t('account.country')}</span>
            <input
              className="input"
              value={country}
              onChange={(e) => setCountry(e.target.value.toUpperCase())}
              placeholder="KR"
              maxLength={8}
              autoComplete="country"
            />
          </label>
          <label className="wx-account-field">
            <span>{t('account.wallet')}</span>
            <input className="input" value={profile?.walletAddress || ''} readOnly />
          </label>
          <button type="submit" className="btn-primary" disabled={profileSaving}>
            {profileSaving ? t('common.loading') : t('account.saveProfile')}
          </button>
        </form>
      </section>

      <section className="card-surface wx-account-card">
        <h2 className="section-title">{t('account.passwordSection')}</h2>
        <form onSubmit={changePassword} className="wx-account-form">
          {pwErr ? <div className="auth-error">{pwErr}</div> : null}
          {pwMsg ? <p className="wx-account-ok">{pwMsg}</p> : null}
          <label className="wx-account-field">
            <span>{t('account.currentPassword')}</span>
            <input
              className="input"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <label className="wx-account-field">
            <span>{t('account.newPassword')}</span>
            <input
              className="input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          <label className="wx-account-field">
            <span>{t('account.confirmPassword')}</span>
            <input
              className="input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          <button type="submit" className="btn-primary" disabled={pwSaving}>
            {pwSaving ? t('common.loading') : t('account.changePassword')}
          </button>
        </form>
      </section>

      <section className="card-surface wx-account-card">
        <h2 className="section-title">{t('account.securitySection')}</h2>
        {secErr ? <div className="auth-error">{secErr}</div> : null}
        {secMsg ? <p className="wx-account-ok">{secMsg}</p> : null}
        <ul className="wx-account-sec-list">
          <li>
            <strong>{t('account.otpStatus')}</strong>
            <span>{profile?.otpEnabled ? t('account.enabled') : t('account.disabled')}</span>
          </li>
          <li>
            <strong>{t('account.biometricStatus')}</strong>
            <span>
              {profile?.biometricEnabled
                ? `${t('account.enabled')} (${profile.biometricCount || 1})`
                : t('account.disabled')}
            </span>
          </li>
        </ul>
        <p className="muted-text wx-account-hint">{t('account.securityHint')}</p>
        <div className="wx-account-sec-actions">
          <button type="button" className="btn-secondary" disabled={secBusy} onClick={() => void enrollBiometric()}>
            {profile?.biometricEnabled ? t('account.biometricAdd') : t('account.biometricEnroll')}
          </button>
          {profile?.biometricEnabled ? (
            <button type="button" className="btn-secondary" disabled={secBusy} onClick={() => void clearBiometric()}>
              {t('account.biometricClear')}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

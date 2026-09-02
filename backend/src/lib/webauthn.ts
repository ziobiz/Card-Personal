import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticatorTransport,
  type VerifiedAuthenticationResponse,
  type VerifiedRegistrationResponse,
} from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { config } from '../config.js';
import { store, type AppUser, type WebAuthnCredential } from '../data/store.js';

const challenges = new Map<string, { challenge: string; exp: number }>();

function rp() {
  return {
    rpID: config.webauthnRpId,
    rpName: config.webauthnRpName,
    origin: config.webauthnOrigin,
  };
}

function putChallenge(userId: string, challenge: string) {
  challenges.set(userId, { challenge, exp: Date.now() + 5 * 60_000 });
}

function takeChallenge(userId: string): string | null {
  const row = challenges.get(userId);
  challenges.delete(userId);
  if (!row || row.exp < Date.now()) return null;
  return row.challenge;
}

function toAuthenticator(c: WebAuthnCredential) {
  return {
    id: c.id,
    publicKey: Buffer.from(c.publicKey, 'base64url'),
    counter: c.counter,
    transports: c.transports as AuthenticatorTransport[] | undefined,
  };
}

export const webauthnService = {
  hasCredentials(user: AppUser): boolean {
    return Boolean(user.webauthnCredentials && user.webauthnCredentials.length > 0);
  },

  async registrationOptions(user: AppUser) {
    const { rpID, rpName } = rp();
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: user.email,
      userDisplayName: user.email,
      userID: new TextEncoder().encode(user.id),
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      excludeCredentials: (user.webauthnCredentials || []).map((c) => ({
        id: c.id,
        transports: c.transports as AuthenticatorTransport[] | undefined,
      })),
    });
    putChallenge(user.id, options.challenge);
    return options;
  },

  async verifyRegistration(user: AppUser, response: RegistrationResponseJSON): Promise<VerifiedRegistrationResponse> {
    const expectedChallenge = takeChallenge(user.id);
    if (!expectedChallenge) throw new Error('Challenge expired');
    const { rpID, origin } = rp();
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo) {
      throw new Error('WebAuthn registration failed');
    }
    const info = verification.registrationInfo;
    const cred: WebAuthnCredential = {
      id: info.credential.id,
      publicKey: Buffer.from(info.credential.publicKey).toString('base64url'),
      counter: info.credential.counter,
      transports: response.response.transports,
      deviceType: info.credentialDeviceType,
      backedUp: info.credentialBackedUp,
      createdAt: new Date().toISOString(),
    };
    store.addWebauthnCredential(user.id, cred);
    return verification;
  },

  async authenticationOptions(user: AppUser) {
    const { rpID } = rp();
    const allow = user.webauthnCredentials || [];
    if (!allow.length) throw new Error('No biometric credentials');
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'required',
      allowCredentials: allow.map((c) => ({
        id: c.id,
        transports: c.transports as AuthenticatorTransport[] | undefined,
      })),
    });
    putChallenge(user.id, options.challenge);
    return options;
  },

  async verifyAuthentication(
    user: AppUser,
    response: AuthenticationResponseJSON
  ): Promise<VerifiedAuthenticationResponse> {
    const expectedChallenge = takeChallenge(user.id);
    if (!expectedChallenge) throw new Error('Challenge expired');
    const cred = (user.webauthnCredentials || []).find((c) => c.id === response.id);
    if (!cred) throw new Error('Unknown credential');
    const { rpID, origin } = rp();
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: toAuthenticator(cred),
    });
    if (!verification.verified) throw new Error('WebAuthn authentication failed');
    store.updateWebauthnCounter(user.id, cred.id, verification.authenticationInfo.newCounter);
    return verification;
  },
};

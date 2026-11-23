import type { VerifiedUser } from './types';

const JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

interface JwkKey extends JsonWebKey {
  kid: string;
}

let cachedJwks: { keys: JwkKey[]; expiresAt: number } | null = null;

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const binary = atob(padded + '='.repeat(padLen));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function decodeJsonPart<T>(part: string): T {
  const bytes = base64UrlToBytes(part);
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text) as T;
}

async function fetchJwks(forceRefresh = false): Promise<JwkKey[]> {
  const now = Date.now();
  if (!forceRefresh && cachedJwks && cachedJwks.expiresAt > now) {
    return cachedJwks.keys;
  }

  const res = await fetch(JWKS_URL);
  if (!res.ok) {
    throw new Error(`Unable to fetch Firebase public keys (HTTP ${res.status})`);
  }

  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = /max-age=(\d+)/i.exec(cacheControl);
  const maxAgeSec = maxAgeMatch ? Math.min(Number(maxAgeMatch[1]), 21600) : 3600;

  const data = (await res.json()) as { keys?: JwkKey[] };
  if (!Array.isArray(data.keys) || data.keys.length === 0) {
    throw new Error('Firebase JWKS response contained no keys');
  }

  cachedJwks = {
    keys: data.keys,
    expiresAt: now + maxAgeSec * 1000,
  };
  return data.keys;
}

interface JwtHeader {
  alg?: string;
  kid?: string;
}

interface FirebaseJwtPayload {
  aud?: string;
  iss?: string;
  sub?: string;
  exp?: number;
  iat?: number;
  auth_time?: number;
  email?: string;
  admin?: boolean;
}

export async function verifyFirebaseIdToken(
  token: string,
  projectId: string
): Promise<VerifiedUser> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = decodeJsonPart<JwtHeader>(headerB64);
  const payload = decodeJsonPart<FirebaseJwtPayload>(payloadB64);

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Unsupported token algorithm or missing key ID');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= nowSec) {
    throw new Error('Firebase ID token has expired');
  }
  if (!payload.iat || payload.iat > nowSec + 300) {
    throw new Error('Firebase ID token issued-at time is invalid');
  }
  if (payload.aud !== projectId) {
    throw new Error('Firebase ID token audience mismatch');
  }
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error('Firebase ID token issuer mismatch');
  }
  if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length > 128) {
    throw new Error('Firebase ID token subject missing');
  }

  let keys = await fetchJwks(false);
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    keys = await fetchJwks(true);
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) {
    throw new Error('Matching Firebase signing key not found');
  }

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signatureBytes = base64UrlToBytes(signatureB64);

  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    signatureBytes,
    signingInput
  );

  if (!valid) {
    throw new Error('Invalid Firebase ID token signature');
  }

  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : null,
    isAdmin: payload.admin === true,
  };
}

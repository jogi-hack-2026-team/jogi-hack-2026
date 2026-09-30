// Supporting Artifact / Not a Source of Truth (Issue #84).
import { betterAuth } from 'better-auth';
import type { Pool } from 'pg';

export type AuthConfig = {
  pool: Pool;
  secret: string;
  baseURL: string;
  rateLimitStorage?: 'database' | 'memory';
  /** Header Better Auth reads the client IP from (used as the rate-limit key). */
  ipHeader?: string;
  signInMax?: number;
  signInWindowSec?: number;
  signUpMax?: number;
  /** Limit for every other auth endpoint (incl. get-session), per IP per minute. Library default: 100. */
  generalMax?: number;
};

export function createAuth(c: AuthConfig) {
  return betterAuth({
    database: c.pool,
    secret: c.secret,
    baseURL: c.baseURL,
    trustedOrigins: [c.baseURL],
    emailAndPassword: { enabled: true, minPasswordLength: 12 },
    rateLimit: {
      enabled: true, // disabled outside production unless set explicitly
      storage: c.rateLimitStorage ?? 'database',
      window: 60,
      max: c.generalMax ?? 100,
      customRules: {
        '/sign-in/email': { window: c.signInWindowSec ?? 60, max: c.signInMax ?? 5 },
        '/sign-up/email': { window: 60, max: c.signUpMax ?? 5 },
      },
    },
    advanced: {
      ipAddress: { ipAddressHeaders: [c.ipHeader ?? 'x-forwarded-for'] },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

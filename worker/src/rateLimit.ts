import type { Env, QuotaStatus, VerifiedUser } from './types';

// In-memory fallback for local `wrangler dev` when QUOTA_KV is not yet bound
const memoryQuota = new Map<string, number>();

function getUtcDayInfo(): { dayKey: string; resetAt: string } {
  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10);
  const nextUtcMidnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0)
  );
  return { dayKey, resetAt: nextUtcMidnight.toISOString() };
}

function getDailyLimit(env: Env, user: VerifiedUser): number {
  const raw = user.isAdmin ? env.DAILY_LIMIT_ADMIN : env.DAILY_LIMIT_LEARNER;
  const parsed = Number.parseInt(raw || '', 10);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return user.isAdmin ? 300 : 30;
}

export async function getQuotaStatus(env: Env, user: VerifiedUser): Promise<QuotaStatus> {
  const { dayKey, resetAt } = getUtcDayInfo();
  const limit = getDailyLimit(env, user);
  const key = `quota:${user.uid}:${dayKey}`;

  if (env.QUOTA_KV) {
    const raw = await env.QUOTA_KV.get(key);
    const used = raw ? Number.parseInt(raw, 10) || 0 : 0;
    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      reset_at: resetAt,
      storage: 'kv',
    };
  }

  const used = memoryQuota.get(key) || 0;
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    reset_at: resetAt,
    storage: 'memory',
  };
}

export async function consumeQuota(
  env: Env,
  user: VerifiedUser
): Promise<{ allowed: boolean; quota: QuotaStatus }> {
  const { dayKey, resetAt } = getUtcDayInfo();
  const limit = getDailyLimit(env, user);
  const key = `quota:${user.uid}:${dayKey}`;

  const current = await getQuotaStatus(env, user);
  if (current.used >= limit) {
    return { allowed: false, quota: current };
  }

  const nextUsed = current.used + 1;
  if (env.QUOTA_KV) {
    await env.QUOTA_KV.put(key, String(nextUsed), { expirationTtl: 172800 });
  } else {
    memoryQuota.set(key, nextUsed);
  }

  return {
    allowed: true,
    quota: {
      used: nextUsed,
      limit,
      remaining: Math.max(0, limit - nextUsed),
      reset_at: resetAt,
      storage: env.QUOTA_KV ? 'kv' : 'memory',
    },
  };
}

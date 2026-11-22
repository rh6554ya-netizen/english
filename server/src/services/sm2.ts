export interface Sm2Input {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
}

export interface Sm2Result extends Sm2Input {
  next_review_at: string;
  last_reviewed_at: string;
}

/**
 * Standard SM-2 spaced repetition algorithm.
 * quality: 0 (Again), 3 (Hard), 4 (Good), 5 (Easy)
 */
export function calculateSm2(card: Sm2Input, quality: number): Sm2Result {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  let { ease_factor, interval_days, repetitions } = card;

  if (q < 3) {
    repetitions = 0;
    interval_days = 1;
  } else {
    if (repetitions === 0) {
      interval_days = 1;
    } else if (repetitions === 1) {
      interval_days = 6;
    } else {
      interval_days = Math.round(interval_days * ease_factor);
    }
    repetitions += 1;
  }

  ease_factor = Number(
    Math.max(1.3, ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))).toFixed(2)
  );

  const now = new Date();
  const next = new Date(now.getTime() + interval_days * 24 * 60 * 60 * 1000);

  return {
    ease_factor,
    interval_days,
    repetitions,
    last_reviewed_at: now.toISOString(),
    next_review_at: next.toISOString(),
  };
}

// Progressive client-side lockout for the login endpoint.
// Complements the server-side rate limiting already applied by Lovable Cloud / Supabase Auth.
// Stored per email in localStorage so it survives reloads but not incognito/other browsers.

const KEY = "vp_login_attempts_v1";

type Record = { fails: number; lockedUntil: number };
type Store = Record & { email: string };

function load(): Store[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store[]) : [];
  } catch {
    return [];
  }
}

function save(list: Store[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-20)));
  } catch {
    /* ignore quota */
  }
}

function findOrCreate(email: string): { list: Store[]; rec: Store } {
  const list = load();
  let rec = list.find((r) => r.email === email);
  if (!rec) {
    rec = { email, fails: 0, lockedUntil: 0 };
    list.push(rec);
  }
  return { list, rec };
}

/** Returns milliseconds remaining if the email is currently locked, else 0. */
export function getLockRemaining(email: string): number {
  const key = email.trim().toLowerCase();
  if (!key) return 0;
  const { rec } = findOrCreate(key);
  const rem = rec.lockedUntil - Date.now();
  return rem > 0 ? rem : 0;
}

/** Register a failed login attempt and apply progressive delay. Returns new lock ms remaining. */
export function registerFail(email: string): number {
  const key = email.trim().toLowerCase();
  if (!key) return 0;
  const { list, rec } = findOrCreate(key);
  rec.fails += 1;
  // Progressive delays:  <5 nothing · 5=1min · 7=5min · 10=30min · 12+=2h
  let delayMs = 0;
  if (rec.fails >= 12) delayMs = 2 * 60 * 60 * 1000;
  else if (rec.fails >= 10) delayMs = 30 * 60 * 1000;
  else if (rec.fails >= 7) delayMs = 5 * 60 * 1000;
  else if (rec.fails >= 5) delayMs = 60 * 1000;
  if (delayMs > 0) rec.lockedUntil = Date.now() + delayMs;
  save(list);
  return delayMs;
}

/** Clear the lock/fails after a successful login. */
export function clearFails(email: string) {
  const key = email.trim().toLowerCase();
  if (!key) return;
  const list = load().filter((r) => r.email !== key);
  save(list);
}

export function formatRemaining(ms: number): string {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.ceil(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.ceil(m / 60);
  return `${h} h`;
}

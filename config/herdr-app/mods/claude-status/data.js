// Pure helpers for the Claude Code status line data. No Herdr imports, so tests
// can load this file with plain Node.

export const WINDOWS = [
  { key: "five_hour", label: "5h", name: "5-hour limit", seconds: 5 * 3600 },
  { key: "seven_day", label: "7d", name: "Weekly limit", seconds: 7 * 86400 },
  { key: "spend_limit", label: "$", name: "Spend limit", seconds: null },
];
export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad = (n) => String(n).padStart(2, "0");
export const clock = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// A duration for people: 7m, 2h 05m, 3d 4h.
export function span(seconds) {
  const m = Math.max(0, Math.round(seconds / 60));
  if (m < 60) return `${m}m`;
  if (m < 24 * 60) return `${Math.floor(m / 60)}h ${pad(m % 60)}m`;
  return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
}

// One limit window at `now` (epoch seconds), or null if the input has none.
// `passed`: the part of the window behind us; `pace`: the percentage at the
// reset if the use goes on at the same rate.
export function windowState(w, limits, now) {
  const l = limits?.[w.key];
  if (typeof l?.used_percentage !== "number" || typeof l?.resets_at !== "number") return null;
  const left = l.resets_at - now;
  if (left <= 0) return { ...w, reset: true, used: 0, left: 0, passed: null, pace: null };
  const passed = w.seconds ? Math.min(1, Math.max(0, 1 - left / w.seconds)) : null;
  // Too early in a window to project from: the first 5% would swing wildly.
  const pace = passed !== null && passed >= 0.05 ? l.used_percentage / passed : null;
  return { ...w, reset: false, used: l.used_percentage, left, at: l.resets_at, passed, pace, usd: l.used_usd, limit: l.limit_usd };
}

// 240.9k, 1M, 950.
export function tokens(n) {
  if (typeof n !== "number") return "–";
  if (n >= 1e6) return `${Math.round(n / 1e5) / 10}M`;
  if (n >= 1e3) return `${Math.round(n / 100) / 10}k`;
  return String(n);
}

export const money = (usd) => (typeof usd === "number" ? `$${usd < 10 ? usd.toFixed(2) : usd.toFixed(1)}` : "–");

// The xterm 256-color palette entry as #rrggbb (16..255; 0..15 depend on the theme).
export function xterm(n) {
  if (n >= 232) {
    const v = (8 + (n - 232) * 10).toString(16).padStart(2, "0");
    return `#${v}${v}${v}`;
  }
  if (n < 16) return null;
  const c = n - 16;
  const step = (i) => (i === 0 ? 0 : 55 + i * 40).toString(16).padStart(2, "0");
  return `#${step(Math.floor(c / 36))}${step(Math.floor(c / 6) % 6)}${step(c % 6)}`;
}

// The bracketed badges in the rendered status line, such as `[TDD]` from a
// plugin's status line script, each with the 256-color foreground it was printed in.
export function badges(line) {
  const out = [];
  let color = null;
  const re = /\x1b\[([\d;]*)m|\[([A-Z][A-Z0-9 _:.-]{0,23})\]/g;
  for (const m of (line ?? "").matchAll(re)) {
    if (m[1] !== undefined) {
      const codes = m[1].split(";").map(Number);
      const i = codes.indexOf(38);
      if (i >= 0 && codes[i + 1] === 5) color = xterm(codes[i + 2]);
      else if (m[1] === "" || codes.includes(0) || codes.includes(39)) color = null;
    } else if (!out.some((b) => b.text === m[2])) out.push({ text: m[2], color });
  }
  return out;
}

// The last folder names of a path: …/work/acme-api.
export function shortPath(path, home, keep = 2) {
  if (!path) return "";
  const p = home && path.startsWith(home) ? `~${path.slice(home.length)}` : path;
  const parts = p.split("/").filter(Boolean);
  return parts.length > keep + 1 ? `…/${parts.slice(-keep).join("/")}` : p;
}

// A terminal address that is safe as a file name (the status line script uses the same rule).
export const safeId = (id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id);

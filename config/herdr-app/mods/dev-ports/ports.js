// Pure helpers (no Herdr imports): parse lsof and ps, give each listener to the
// terminal whose shell started it, and tell debugger ports from servers.

export const EPHEMERAL = 49152;

// `lsof -nP -iTCP -sTCP:LISTEN -Fpcn`: p<pid>, c<command>, n<address:port> lines.
// Returns [{ pid, cmd, port, host }], host as lsof printed it ("127.0.0.1", "[::1]", "*").
export function parseLsof(out) {
  const list = [];
  let pid = null, cmd = "";
  for (const line of String(out).split("\n")) {
    const key = line[0], value = line.slice(1);
    if (key === "p") { pid = Number(value); cmd = ""; }
    else if (key === "c") cmd = value;
    else if (key === "n" && pid) {
      const m = value.match(/^(.*):(\d+)$/);
      // 49152 and up is the ephemeral range: ports programs open for themselves (an
      // agent's helpers, IDE bridges), not servers someone started.
      if (m && Number(m[2]) < EPHEMERAL) list.push({ pid, cmd, port: Number(m[2]), host: m[1] });
    }
  }
  return list;
}

// `ps -Ao pid=,ppid=`: pid -> parent pid.
export function parsePs(out) {
  const parent = new Map();
  for (const line of String(out).split("\n")) {
    const m = line.trim().match(/^(\d+)\s+(\d+)$/);
    if (m) parent.set(Number(m[1]), Number(m[2]));
  }
  return parent;
}

// roots: shell pid -> terminal address. Returns [{ terminal, ports: [{ port, pid, host }], cmds }],
// one entry per terminal, ports sorted and listed once (IPv4 and IPv6 of one port are one).
// Listeners no terminal started are left out.
export function attribute(listeners, parent, roots) {
  const byTerminal = new Map();
  for (const l of listeners) {
    let pid = l.pid, terminal = null;
    for (let i = 0; i < 64 && pid > 1; i++) {
      if (roots.has(pid)) { terminal = roots.get(pid); break; }
      pid = parent.get(pid) ?? 0;
    }
    if (!terminal) continue;
    const entry = byTerminal.get(terminal) ?? { terminal, ports: new Map(), cmds: new Set() };
    if (!entry.ports.has(l.port)) entry.ports.set(l.port, { port: l.port, pid: l.pid, host: l.host });
    if (l.cmd) entry.cmds.add(l.cmd);
    byTerminal.set(terminal, entry);
  }
  return [...byTerminal.values()].map((e) => ({
    terminal: e.terminal,
    ports: [...e.ports.values()].sort((a, b) => a.port - b.port),
    cmds: [...e.cmds],
  }));
}

// The URL to ask a listener for its DevTools version: "*" and "0.0.0.0" listen on
// every address, so ask loopback.
export function versionUrl({ host, port }) {
  const h = host === "*" || host === "0.0.0.0" ? "127.0.0.1" : host === "[::]" ? "[::1]" : host;
  return `http://${h}:${port}/json/version`;
}

// A debugger answers /json/version with the Chrome DevTools Protocol's JSON
// (node --inspect, Miniflare/workerd, Chrome's remote debugging). A dev server
// answers with HTML, a 404 or nothing.
export function isDebugger(body) {
  try {
    const j = JSON.parse(String(body));
    return Boolean(j) && typeof j === "object" && ("Protocol-Version" in j || "webSocketDebuggerUrl" in j);
  } catch {
    return false;
  }
}

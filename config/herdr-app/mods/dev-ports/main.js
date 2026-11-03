// Dev servers in the status bar: every TCP port that a process started from a
// Herdr terminal listens on, as "⚡ :5173 ayaka". Click one to go to its pane.
// Samples every 5 s while the window is in front, every 30 s behind; redraws only
// when the list changes. Runs lsof and ps, and `hc get` once per new terminal.
// Debugger ports (they answer /json/version with DevTools JSON: node --inspect,
// Miniflare) are left out of the bar and named in the tooltip; each new port is
// asked once with curl.
import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { exec, theme, panes, spaces, terminals, run, window, shared, setShared } from "herdr";
import { parseLsof, parsePs, attribute, versionUrl, isDebugger } from "./ports.js";

const EVERY = 5000;
const AWAY = 30000;

export default class DevPorts extends View {
  init(_props, cx) {
    this.servers = [];
    this.key = "";
    this.pids = new Map(); // terminal address -> its shell pid
    this.debug = new Map(); // "pid:port" -> true when it is a debugger
    this.busy = false;
    this.last = 0;
    this.scan(cx);
    cx.timer.every(1000, (cx) => {
      if (Date.now() - this.last >= (window().active ? EVERY : AWAY) - 100) this.scan(cx);
    });
  }

  // Shell pids of this computer's live terminals; asks hc only for new ones.
  async roots() {
    const live = (terminals() ?? [])
      .filter((t) => t?.state === "live" && typeof t.address === "string" && !t.address.includes("/"))
      .map((t) => t.address);
    for (const a of [...this.pids.keys()]) if (!live.includes(a)) this.pids.delete(a);
    for (const a of live) {
      if (this.pids.has(a)) continue;
      try {
        const r = await exec("hc", ["get", a, "--json"]);
        const pid = Number(JSON.parse(r.stdout).pid);
        if (pid > 1) this.pids.set(a, pid);
      } catch {}
    }
    return new Map([...this.pids].map(([a, pid]) => [pid, a]));
  }

  scan(cx) {
    if (this.busy) return;
    this.busy = true;
    this.last = Date.now();
    cx.spawn(async (cx) => {
      try {
        const [lsof, ps] = await Promise.all([
          exec("lsof", ["-nP", "-iTCP", "-sTCP:LISTEN", "-Fpcn"]),
          exec("ps", ["-Ao", "pid=,ppid="]),
        ]);
        const found = attribute(parseLsof(lsof.stdout), parsePs(ps.stdout), await this.roots());
        await this.classify(found);
        const servers = found.map((s) => ({ ...s,
          ports: s.ports.map((p) => ({ port: p.port, debug: this.debug.get(`${p.pid}:${p.port}`) === true })) }));
        const key = JSON.stringify(servers);
        if (key !== this.key) { this.key = key; this.servers = servers; cx.notify(); }
        this.publish();
      } catch {} finally {
        this.busy = false;
      }
    });
  }

  // Asks each port not seen before whether it is a debugger. A port that gives no
  // answer within a second is asked again next time; any other result is kept.
  async classify(found) {
    const live = new Set();
    const ask = [];
    for (const s of found) for (const p of s.ports) {
      const key = `${p.pid}:${p.port}`;
      live.add(key);
      if (!this.debug.has(key)) ask.push({ key, p });
    }
    for (const key of [...this.debug.keys()]) if (!live.has(key)) this.debug.delete(key);
    await Promise.all(ask.map(async ({ key, p }) => {
      try {
        const r = await exec("curl", ["-s", "-m", "1", "--max-filesize", "65536", "--noproxy", "*", versionUrl(p)]);
        if (r.code === 28) return; // timed out
        this.debug.set(key, r.code === 0 && isDebugger(r.stdout));
      } catch {}
    }));
  }

  // For other mods (the spaces-ports sidebar): "dev-ports.spaces" = space id -> its
  // server ports, debuggers left out. Written only when it changes.
  publish() {
    const bySpace = {};
    for (const s of this.servers) {
      const where = this.place(s.terminal);
      const ports = s.ports.filter((p) => !p.debug).map((p) => p.port);
      if (!where || !ports.length) continue;
      bySpace[where.space.id] = [...new Set([...(bySpace[where.space.id] ?? []), ...ports])].sort((a, b) => a - b);
    }
    if (JSON.stringify(bySpace) !== JSON.stringify(shared("dev-ports.spaces") ?? {})) setShared("dev-ports.spaces", bySpace);
  }

  // Where a terminal is shown: its pane, tab and space.
  place(terminal) {
    const pane = (panes() ?? []).find((p) => p.terminal === terminal);
    if (!pane) return null;
    const list = spaces() ?? [];
    const index = list.findIndex((s) => s.tabs.some((t) => t.id === pane.tab));
    if (index < 0) return null;
    const space = list[index], tab = space.tabs.find((t) => t.id === pane.tab);
    return { pane, space, tab, index };
  }

  go(where) {
    run("space.select", { id: where.space.id });
    run("tab.select", { id: where.tab.id });
    run("pane.focus", { pane: where.pane.pane });
  }

  render() {
    const t = theme();
    // The shown space first, then the spaces in sidebar order.
    const rows = this.servers.map((s) => ({ ...s, where: this.place(s.terminal),
        shown: s.ports.filter((p) => !p.debug), debuggers: s.ports.filter((p) => p.debug) }))
      .filter((s) => s.where && s.shown.length)
      .sort((a, b) => (b.where.space.active - a.where.space.active) || (a.where.index - b.where.index));
    const root = h_flex().id("dev-ports").size_full().px(14).gap(12).items_center().justify_end().overflow_hidden()
      .bg(t.chrome).border_t(1).border_color(t.border).text_size(11.8).text_color(t.muted);
    if (!rows.length) return root.child(div().text_color(t.dim).child("No dev servers"));
    return root.children(rows.map((s) => {
      const here = s.where.space.active;
      return h_flex().id(`dp-${s.terminal}`).flex_none().gap(4).items_center().cursor_pointer()
        .hover((st) => st.text_color(t.foreground))
        .tooltip(`${s.cmds.join(", ") || "server"} · ${s.where.space.name} / ${s.where.tab.name}`
          + (s.debuggers.length ? `\nDebugger: ${s.debuggers.map((p) => `:${p.port}`).join(" ")}` : "")
          + "\nClick to go to the pane")
        .on_click(() => this.go(s.where))
        .child(div().text_color(here ? t.ansi3 : t.dim).child("⚡"))
        .child(div().font_family("JetBrains Mono").text_color(here ? t.foreground : t.muted).child(s.shown.map((p) => `:${p.port}`).join(" ")))
        .when(!here, (el) => el.child(div().text_color(t.dim).child(s.where.space.name)));
    }));
  }
}

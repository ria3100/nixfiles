// The Claude Code session of the shown tab: model, context, cost, time, lines,
// prompt cache and the badges of the person's own status line. The block shows
// only while the shown tab has a Claude Code agent: this part hides and shows
// its own block (props().block) with layout.hide / layout.show.
import { div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { readTextFile, appHome, home, theme, focused, panes, terminals, run } from "herdr";
import * as fs from "fs/promises";
import { span, tokens, money, badges, shortPath, safeId } from "./data.js";

const DIR = () => `${appHome()}/claude-status/sessions`;
const TICK = 500; // ms: how fast the block follows the shown tab
const READ_EVERY = 4; // ticks between reads of the shown session's file
const CLEAN_EVERY = 120; // ticks between removals of files of ended terminals

const isClaude = (p) => p.app === "claude-code" || p.program?.key === "claude";

export default class Session {
  constructor(props) {
    this.block = props.block ?? null;
    this.visible = undefined;
    this.pane = null;
    this.data = undefined; // undefined: not read yet, null: no file
    this.line = "";
    this.ticks = 0;
  }

  init(cx) {
    this.sync(cx);
    this.clean(cx);
    cx.timer.every(TICK, (cx) => {
      this.ticks++;
      this.sync(cx);
      if (this.ticks % READ_EVERY === 0 && this.visible) this.read(cx);
      if (this.ticks % CLEAN_EVERY === 0) this.clean(cx);
    });
  }

  // The Claude Code pane to show: the focused one, else the one shown last, else the first.
  pick() {
    const tab = focused()?.tab;
    if (!tab) return null;
    const ps = panes().filter((p) => p.tab === tab && p.terminal && isClaude(p));
    return ps.find((p) => p.focused) ?? ps.find((p) => p.terminal === this.pane?.terminal) ?? ps[0] ?? null;
  }

  sync(cx) {
    const pane = this.pick();
    const want = Boolean(pane);
    if (this.block && want !== this.visible) run(want ? "layout.show" : "layout.hide", { id: this.block });
    this.visible = want;
    const changed = pane?.terminal !== this.pane?.terminal;
    if (changed || pane?.cwd !== this.pane?.cwd || pane?.branch !== this.pane?.branch) {
      this.pane = pane;
      if (changed) { this.data = undefined; this.line = ""; this.read(cx); }
      cx.notify();
    }
  }

  read(cx) {
    const id = this.pane?.terminal;
    if (!safeId(id)) return;
    cx.spawn(async (cx) => {
      try {
        const [json, line] = await Promise.all([readTextFile(`${DIR()}/${id}.json`), readTextFile(`${DIR()}/${id}.line`)]);
        if (this.pane?.terminal !== id) return;
        this.data = json ? JSON.parse(json) : null;
        this.line = line ?? "";
        this.error = null;
      } catch (e) {
        this.error = `Cannot read session: ${e}`;
      }
      cx.notify();
    });
  }

  // Files of terminals that no longer exist on this computer. Only judged while
  // the core lists terminals, so a core that is not answering never loses files.
  clean(cx) {
    const live = new Set(terminals().map((t) => t.address).filter((a) => typeof a === "string" && !a.includes("/")));
    if (live.size === 0) return;
    cx.spawn(async () => {
      try {
        for (const name of await fs.readdir(DIR())) {
          // Only the files statusline.sh writes: `<terminal>.json`, `<terminal>.line`, and
          // `<terminal>.<ext>.tmp.<pid>` when Claude Code stopped a status line halfway.
          const m = name.match(/^([A-Za-z0-9_-]{1,64})\.(json|line)(\.tmp\.\d+)?$/);
          if (m && (m[3] || !live.has(m[1]))) await fs.unlink(`${DIR()}/${name}`).catch(() => {});
        }
      } catch {}
    });
  }

  render() {
    const t = theme();
    const p = this.pane;
    const s = this.data?.input;
    const now = Date.now() / 1000;
    const panel = v_flex().id("claude-session").size_full().min_h(0).rounded(10).border(1).border_color(t.border)
      .bg(t.background).text_size(13).text_color(t.foreground).overflow_hidden();
    if (!p) return panel;

    const chip = (text, color, id) =>
      div().id(id).flex_none().h(20).px(7).rounded(5).flex().items_center().text_size(11)
        .bg((color ?? t.dim) + "22").text_color(color ?? t.muted).child(text);
    const icon = p.program?.icon
      ? (p.program.tint ? svg(p.program.icon).size(14).flex_none().text_color(t.muted) : image(p.program.icon).size(14).flex_none())
      : null;

    const header = h_flex().id("cs-header").h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
      .cursor_pointer().on_click(() => run("pane.focus", { terminal: p.terminal }))
      .tooltip("Focus this Claude Code pane")
      .when(Boolean(icon), (el) => el.child(icon))
      .child(div().font_semibold().flex_none().child("Claude Code"))
      .child(div().flex_1().min_w(0))
      .when(Boolean(s?.fast_mode), (el) => el.child(chip("fast", t.ansi3, "cs-fast")))
      .when(Boolean(s?.model?.display_name), (el) => el.child(chip(s.model.display_name, t.accent, "cs-model")))
      .when(Boolean(s?.effort?.level), (el) => el.child(chip(s.effort.level, null, "cs-effort").tooltip("Reasoning effort")));

    const note = (text) => div().p(14).text_size(12).text_color(t.dim).child(text);
    if (!safeId(p.terminal)) return panel.child(header).child(note("Session details are only kept for agents on this computer."));
    if (this.error) return panel.child(header).child(div().p(14).text_size(12).text_color(t.ansi1).child(this.error));
    if (!s) return panel.child(header).child(note(this.data === null
      ? "Waiting for the first response of this session. Connect the Claude Code status line to statusline.sh in the claude-status mod folder if nothing comes."
      : "Loading session…"));

    // Context: the window fills up toward an automatic compact.
    const cw = s.context_window ?? {};
    const pct = typeof cw.used_percentage === "number" ? cw.used_percentage : null;
    const ctxColor = pct === null ? t.dim : pct >= 80 ? t.ansi1 : pct >= 60 ? t.ansi3 : t.accent;
    const context = v_flex().gap(6)
      .child(h_flex().items_center().justify_between()
        .child(div().text_size(11).text_color(t.dim).child("Context"))
        .child(div().text_size(13).font_semibold().text_color(pct === null ? t.dim : pct >= 60 ? ctxColor : t.foreground).child(pct === null ? "–" : `${Math.round(pct)}%`)))
      .child(div().h(8).rounded(4).bg(t.border).overflow_hidden()
        .child(div().h_full().w(`${Math.min(100, pct ?? 0)}%`).rounded(4).bg(ctxColor)))
      .child(h_flex().justify_between().text_size(11).text_color(t.dim)
        .child(div().child(`${tokens(cw.total_input_tokens)} / ${tokens(cw.context_window_size)} tokens`))
        .when(typeof cw.context_window_size === "number" && typeof cw.total_input_tokens === "number", (el) =>
          el.child(div().child(`${tokens(Math.max(0, cw.context_window_size - cw.total_input_tokens))} left`))));

    // Where: session name, folder, branch, pull request.
    const where = [shortPath(s.workspace?.current_dir ?? s.cwd, home()), s.workspace?.git_worktree ? `worktree ${s.workspace.git_worktree}` : p.branch]
      .filter(Boolean).join(" · ");
    const pr = s.pr?.number ? `PR #${s.pr.number}${s.pr.review_state ? ` · ${s.pr.review_state.replace("_", " ")}` : ""}` : null;
    const title = v_flex().gap(2)
      .when(Boolean(s.session_name), (el) => el.child(div().truncate().child(s.session_name)))
      .child(h_flex().gap(6).text_size(11.5).text_color(t.dim).min_w(0)
        .child(div().flex_1().min_w(0).truncate().child(where || "–"))
        .when(Boolean(pr), (el) => el.child(div().flex_none().text_color(s.pr.review_state === "approved" ? t.ansi2 : t.dim).child(pr))));

    // Cost, time, lines: three tiles.
    const c = s.cost ?? {};
    const tile = (id, label, value) => v_flex().id(id).flex_1().min_w(0).gap(2).px(8).py(6).rounded(6).bg(t.raised)
      .child(div().text_size(10.5).text_color(t.dim).child(label)).child(value);
    const big = (text, color) => div().text_size(13).font_semibold().text_color(color ?? t.foreground).truncate().child(text);
    const stats = h_flex().gap(6)
      .child(tile("cs-cost", "Cost", big(money(c.total_cost_usd))).tooltip("Estimated at list price by Claude Code"))
      .child(tile("cs-time", "Time", big(typeof c.total_duration_ms === "number" ? span(c.total_duration_ms / 1000) : "–"))
        .tooltip(typeof c.total_api_duration_ms === "number" ? `Waiting for the API: ${span(c.total_api_duration_ms / 1000)}` : "Session time"))
      .child(tile("cs-lines", "Lines", h_flex().gap(4).text_size(13).font_semibold()
        .child(div().text_color(t.ansi2).child(`+${c.total_lines_added ?? 0}`))
        .child(div().text_color(t.ansi1).child(`−${c.total_lines_removed ?? 0}`))));

    // Prompt cache: warm until expires_at; cold means the next request writes the cache again.
    const pc = s.prompt_cache;
    const warm = pc?.warm && typeof pc.expires_at === "number" && pc.expires_at > now;
    const cache = !pc?.caching_observed ? null : h_flex().id("cs-cache").gap(6).items_center().text_size(11.5).text_color(t.dim)
      .child(div().size(6).flex_none().rounded(3).bg(warm ? t.ansi2 : t.ansi3))
      .child(div().truncate().child(warm
        ? `Cache warm · ${span(pc.expires_at - now)} left${typeof pc.hit_ratio === "number" ? ` · ${Math.round(pc.hit_ratio * 100)}% hits` : ""}`
        : `Cache cold · next request writes ${tokens(pc.recache_tokens_if_cold)}`))
      .tooltip(`Requests ${pc.requests ?? 0}, misses ${pc.misses ?? 0}, TTL ${pc.ttl ?? "–"}`);

    // Badges: what the person's own status line printed in brackets, then session settings.
    const extra = [
      ...badges(this.line).map((b) => ({ text: b.text, color: b.color })),
      s.output_style?.name && s.output_style.name !== "default" ? { text: s.output_style.name } : null,
      s.vim?.mode ? { text: s.vim.mode } : null,
      s.agent?.name ? { text: s.agent.name } : null,
    ].filter(Boolean);
    const chips = extra.length === 0 ? null
      : h_flex().flex_wrap().gap(5).children(extra.map((b, i) => chip(b.text, b.color, `cs-badge-${i}`)));

    return panel.child(header).child(
      v_flex().id("cs-body").flex_1().min_h(0).px(14).py(12).gap(11).overflow_y_scrollbar()
        .child(title).child(context).child(stats)
        .when(Boolean(cache), (el) => el.child(cache))
        .when(Boolean(chips), (el) => el.child(chips)));
  }
}

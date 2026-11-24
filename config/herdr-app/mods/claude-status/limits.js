// The subscription limits as the last Claude Code status line saw them: the 5-hour
// and 7-day windows, each with a mark for how much of the window has passed, so a
// fill ahead of the mark means a pace that runs out before the reset.
// Below them, the Gemini limits of the Antigravity CLI, which `agy -p /usage`
// prints without starting a turn or using quota.
import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, readTextFile, appHome, theme, layout } from "herdr";
import { WINDOWS, DAYS, clock, span, windowState, agyLimits } from "./data.js";

const FILE = () => `${appHome()}/claude-status/limits.json`;
const READ_EVERY = 15000; // ms; the file is small and changes after each Claude Code response
const AGY_EVERY = 2 * 60000; // ms; one `agy -p /usage` takes about 5 seconds

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;

export default class Limits {
  init(cx) {
    this.data = undefined; // undefined: not read yet, null: no file
    this.read(cx);
    cx.timer.every(READ_EVERY, (cx) => this.read(cx));
    // Gemini: undefined until the first answer, null when agy is not installed.
    this.gemini = undefined;
    this.readGemini(cx);
    cx.timer.every(AGY_EVERY, (cx) => this.readGemini(cx));
  }

  readGemini(cx) {
    if (this.geminiBusy || this.gemini === null) return;
    this.geminiBusy = true;
    cx.spawn(async (cx) => {
      try {
        const r = await exec("agy", ["-p", "/usage", "--output-format", "json"], { timeout: 60000 });
        const limits = r.code === 0 ? agyLimits(JSON.parse(r.stdout)) : null;
        this.gemini = limits && Object.keys(limits).length
          ? { at: Date.now() / 1000, limits, error: null }
          : { ...this.gemini, error: `agy /usage failed: ${(r.stderr || r.stdout).trim().split("\n")[0] || `exit ${r.code}`}` };
      } catch (e) {
        // exec rejects when agy cannot start: not installed here, so leave Gemini out.
        this.gemini = /not found|No such file/i.test(String(e)) ? null : { ...this.gemini, error: `Cannot run agy: ${e}` };
      }
      this.geminiBusy = false;
      cx.notify();
    });
  }

  read(cx) {
    cx.spawn(async (cx) => {
      try {
        const text = await readTextFile(FILE());
        this.data = text ? JSON.parse(text) : null;
        this.error = null;
      } catch (e) {
        this.error = `Cannot read usage: ${e}`;
      }
      cx.notify();
    });
  }

  render(cx) {
    const t = theme();
    const now = Date.now() / 1000;
    const claude = WINDOWS.map((w) => windowState(w, this.data?.input?.rate_limits, now)).filter(Boolean);
    const gem = this.gemini ? WINDOWS.map((w) => windowState(w, this.gemini.limits, now)).filter(Boolean) : [];
    const tone = (s) => (s.used >= 90 || s.pace >= 100 ? t.ansi1 : s.used >= 70 || s.pace >= 85 ? t.ansi3 : t.accent);

    const root = v_flex()
      .id("claude-limits")
      .size_full()
      .bg(t.chrome)
      .text_size(12);

    if (narrow()) {
      const cell = (s, prefix) =>
        v_flex().items_center().child(div().text_size(9).text_color(t.dim).child(`${prefix}${s.label}`))
          .child(div().text_size(11).text_color(s.reset ? t.dim : tone(s)).child(`${Math.round(s.used)}%`));
      return root.items_center().justify_center().gap(6)
        .children(claude.filter((s) => s.seconds).map((s) => cell(s, "")))
        .children(gem.map((s) => cell(s, "G ")));
    }

    const tip = (s, source) => {
      if (s.reset) return `${s.name}: the window has reset. New numbers come with the next ${source}.`;
      const lines = [`${s.name}: ${s.used.toFixed(0)}% used`];
      if (s.usd !== undefined && s.limit !== undefined) lines.push(`$${s.usd} of $${s.limit}`);
      const d = new Date(s.at * 1000);
      lines.push(`Resets ${s.left > 86400 ? `${DAYS[d.getDay()]} ` : ""}${clock(d)} (in ${span(s.left)})`);
      if (s.pace !== null) lines.push(`At this pace: ${Math.round(s.pace)}% by the reset`);
      return lines.join("\n");
    };
    const resetText = (s) => {
      if (s.reset) return "reset";
      if (s.left > 86400) {
        const d = new Date(s.at * 1000);
        return `${DAYS[d.getDay()]} ${clock(d)}`;
      }
      return span(s.left);
    };
    const bar = (s) =>
      div().flex_1().h(6).rounded(3).bg(t.border).relative()
        .child(div().h_full().w(`${Math.min(100, s.used)}%`).rounded(3).bg(s.reset ? t.dim : tone(s)))
        .when(s.passed !== null, (el) => el.child(
          div().absolute().top(-3).h(12).w(2).rounded(1).bg(t.foreground).opacity(0.55).left(`${s.passed * 100}%`)));
    const row = (s, id, source) =>
      h_flex().id(`${id}-${s.key}`).h(20).gap(8).items_center().tooltip(tip(s, source))
        .child(div().w(30).flex_none().text_size(11).text_color(t.dim).child(s.label))
        .child(bar(s))
        .child(div().w(32).flex_none().text_right().text_size(11.5).text_color(s.reset ? t.dim : tone(s) === t.accent ? t.foreground : tone(s))
          .child(`${Math.round(s.used)}%`))
        .child(div().w(62).flex_none().text_right().text_size(11).text_color(t.dim).truncate().child(resetText(s)));

    const ago = (at) => (!at ? null : now - at < 60 ? "now" : `${span(now - at)} ago`);
    const header = (id, title, age, ageTip, top) => h_flex().px(16).h(top ? 30 : 24).pt(top ? 8 : 4).flex_none().items_center().justify_between()
      .child(div().text_size(11.5).font_medium().text_color(t.dim).child(title))
      .when(Boolean(age), (el) => el.child(div().id(`${id}-age`).text_size(11).text_color(t.dim).child(age).tooltip(ageTip)));

    const note = (text, color = t.dim) => div().text_size(11).text_color(color).child(text);
    const claudePart = v_flex().id("cl-part").cursor_pointer()
      .on_click(() => exec("open", ["https://claude.ai/settings/usage"]).catch(() => {}))
      .child(header("cl", "Claude", ago(this.data?.at), "When a Claude Code status line last reported these limits", true))
      .child(
        v_flex().px(16).pb(6).gap(1)
          .when(Boolean(this.error), (el) => el.child(note(this.error, t.ansi1)))
          .when(this.data === null, (el) => el.child(note("No usage yet. Connect the Claude Code status line to statusline.sh in this mod's folder.")))
          .when(Boolean(this.data) && claude.length === 0, (el) => el.child(note("No limits in the last report. They come after the first response of a subscription session.")))
          .children(claude.map((s) => row(s, "cl", "Claude Code response"))),
      );
    if (this.gemini === null) return root.child(claudePart);

    // Clicking the Gemini part asks agy again now.
    const geminiPart = v_flex().id("gm-part").cursor_pointer()
      .on_click((_e, cx) => this.readGemini(cx))
      .child(header("gm", "Gemini", ago(this.gemini?.at), "When agy /usage last reported these limits. Click to ask again.", false))
      .child(
        v_flex().px(16).pb(6).gap(1)
          .when(Boolean(this.gemini?.error), (el) => el.child(note(this.gemini.error, t.ansi1)))
          .when(this.gemini === undefined, (el) => el.child(note("Asking agy…")))
          .children(gem.map((s) => row(s, "gm", "agy /usage"))),
      );
    return root.child(claudePart).child(geminiPart);
  }
}

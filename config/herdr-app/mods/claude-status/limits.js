// The subscription limits as the last Claude Code status line saw them: the 5-hour
// and 7-day windows, each with a mark for how much of the window has passed, so a
// fill ahead of the mark means a pace that runs out before the reset.
import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, readTextFile, appHome, theme, layout } from "herdr";
import { WINDOWS, DAYS, clock, span, windowState } from "./data.js";

const FILE = () => `${appHome()}/claude-status/limits.json`;
const READ_EVERY = 15000; // ms; the file is small and changes after each Claude Code response

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

  render() {
    const t = theme();
    const now = Date.now() / 1000;
    const limits = this.data?.input?.rate_limits;
    const shown = WINDOWS.map((w) => windowState(w, limits, now)).filter(Boolean);
    const tone = (s) => (s.used >= 90 || s.pace >= 100 ? t.ansi1 : s.used >= 70 || s.pace >= 85 ? t.ansi3 : t.accent);

    const root = v_flex()
      .id("claude-limits")
      .size_full()
      .bg(t.chrome)
      .text_size(12)
      .cursor_pointer()
      .on_click(() => exec("open", ["https://claude.ai/settings/usage"]).catch(() => {}));

    if (narrow()) {
      return root.items_center().justify_center().gap(6).children(
        shown.filter((s) => s.seconds).map((s) =>
          v_flex().items_center().child(div().text_size(9).text_color(t.dim).child(s.label))
            .child(div().text_size(11).text_color(s.reset ? t.dim : tone(s)).child(`${Math.round(s.used)}%`))));
    }

    const tip = (s) => {
      if (s.reset) return `${s.name}: the window has reset. New numbers come with the next Claude Code response.`;
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
    const row = (s) =>
      h_flex().id(`cl-${s.key}`).h(20).gap(8).items_center().tooltip(tip(s))
        .child(div().w(30).flex_none().text_size(11).text_color(t.dim).child(s.label))
        .child(bar(s))
        .child(div().w(32).flex_none().text_right().text_size(11.5).text_color(s.reset ? t.dim : tone(s) === t.accent ? t.foreground : tone(s))
          .child(`${Math.round(s.used)}%`))
        .child(div().w(62).flex_none().text_right().text_size(11).text_color(t.dim).truncate().child(resetText(s)));

    const age = !this.data?.at ? null : now - this.data.at < 60 ? "now" : `${span(now - this.data.at)} ago`;
    const header = h_flex().px(16).h(30).pt(8).flex_none().items_center().justify_between()
      .child(div().text_size(11.5).font_medium().text_color(t.dim).child("Claude"))
      .when(Boolean(age), (el) => el.child(div().id("cl-age").text_size(11).text_color(t.dim).child(age)
        .tooltip("When a Claude Code status line last reported these limits")));

    const note = (text, color = t.dim) => div().text_size(11).text_color(color).child(text);
    return root.child(header).child(
      v_flex().px(16).pb(6).gap(1)
        .when(Boolean(this.error), (el) => el.child(note(this.error, t.ansi1)))
        .when(this.data === null, (el) => el.child(note("No usage yet. Connect the Claude Code status line to statusline.sh in this mod's folder.")))
        .when(Boolean(this.data) && shown.length === 0, (el) => el.child(note("No limits in the last report. They come after the first response of a subscription session.")))
        .children(shown.map(row)),
    );
  }
}

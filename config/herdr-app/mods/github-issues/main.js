// GitHub issues assigned to me (github.com/issues/assigned), in any repository, by how
// far Claude's automatic implementation has got: claude:ready, claude:in-progress,
// claude:pr-open, then the rest. A row opens its issue in a web pane; an issue whose
// worktree (~/.herdr/worktrees/<repo>/*-<number>) is open as a space gets a button
// that goes there. Reads `gh search issues` on start, every 3 minutes, and on refresh.
// Props: { panel: true } in the side panel, where it draws its own card.
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, theme, spaces, panes, run, home, settings, props } from "herdr";
import { SEARCH, parseIssues, group, byRepo, spaceFor, inkOn } from "./issues.js";

const EVERY = 180000;
// A gh call that never answers is given up after this; the next refresh starts afresh.
const STUCK = 60000;
const icon = (name) => `mods/github-issues/icons/${name}.svg`;
const pad2 = (n) => String(n).padStart(2, "0");
const clock = (ms) => { const d = new Date(ms); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };

export default class GithubIssues extends View {
  init(_props, cx) {
    this.panel = props()?.panel === true;
    this.issues = null; // null until the first answer
    this.error = null;
    this.loading = false;
    this.started = 0;
    this.fetched = null;
    this.refresh(cx);
    cx.timer.every(EVERY, (cx) => this.refresh(cx));
  }

  refresh(cx) {
    if (this.loading && Date.now() - this.started < STUCK) return;
    const run = this.run = (this.run ?? 0) + 1;
    this.loading = true;
    this.started = Date.now();
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        const r = await exec("gh", SEARCH, { timeout: STUCK });
        if (run !== this.run) return;
        if (r.code !== 0) throw new Error((r.stderr || r.stdout || `gh exited with ${r.code}`).trim().split("\n").pop());
        this.issues = parseIssues(r.stdout);
        this.error = null;
        this.fetched = Date.now();
      } catch (e) {
        if (run !== this.run) return;
        this.error = String(e?.message ?? e);
      } finally {
        if (run === this.run) { this.loading = false; cx.notify(); }
      }
    });
  }

  // This computer's spaces with every folder they are in: where new terminals start and
  // where each of their panes is now.
  spaceFolders() {
    const all = panes() ?? [];
    return (spaces() ?? []).filter((s) => !s.machine).map((s) => {
      const tabs = new Set(s.tabs.map((t) => t.id));
      return { id: s.id, name: s.name, folders: [s.folder, ...all.filter((p) => tabs.has(p.tab)).map((p) => p.cwd)].filter(Boolean) };
    });
  }

  header(t, cx) {
    const count = this.issues?.length;
    return h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
      .child(div().text_size(13).font_semibold().child("Issues"))
      .when(count != null, (e) => e.child(div().text_size(11.5).text_color(t.dim).child(String(count))))
      .child(div().flex_1())
      .when(Boolean(this.fetched), (e) => e.child(div().text_size(11).text_color(t.dim).child(clock(this.fetched))))
      .child(h_flex().id("issues-refresh").size(24).flex_none().items_center().justify_center().rounded(6).cursor_pointer()
        .text_color(t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip("Reload")
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .on_click((_e, cx) => this.refresh(cx))
        .child(svg(icon("refresh")).size(13).when(this.loading, (s) => s.spin(900))));
  }

  label(l, t) {
    return div().h(18).px(6).flex_none().rounded(9).text_size(10.5).font_medium()
      .bg(l.color ?? t.raised).text_color(inkOn(l.color) ?? t.muted).child(l.name);
  }

  // stage: its section's claude:* label, left off the row (the heading says it).
  row(issue, stage, places, t, mono) {
    const labels = issue.labels.filter((l) => l.name !== stage);
    const id = `${issue.owner}/${issue.repo}#${issue.number}`;
    const space = spaceFor(issue, places, home());
    // Under its repository's heading: "#number  title  [space]", labels below.
    return v_flex().id(`issue-${id}`).pl(26).pr(14).py(6).gap(4).cursor_pointer().hover((s) => s.bg(t.hover))
      .tooltip(issue.url)
      .on_click(() => run("web.open", { url: issue.url }))
      .child(h_flex().gap(8).items_start().min_w(0)
        .child(div().flex_none().pt(1).font_family(mono).text_size(11.5).text_color(t.muted).child(`#${issue.number}`))
        .child(div().flex_1().min_w(0).text_size(12.5).text_color(t.foreground).child(issue.title))
        .when(Boolean(space), (e) => e.child(h_flex().id(`issue-go-${id}`).h(20).px(6).gap(4).flex_none().min_w(0).items_center()
          .rounded(6).bg(t.accent + "26").text_color(t.accent).text_size(11).font_medium().cursor_pointer()
          .hover((s) => s.bg(t.accent + "40")).tooltip(`Go to the space ${space.name}`)
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .on_click((_e, cx) => { cx.stop_propagation(); run("space.select", { id: space.id }); })
          .child(svg(icon("terminal")).size(12).flex_none()).child(div().truncate().child(space.name)))))
      .when(labels.length > 0, (e) => e.child(h_flex().flex_wrap().gap(4).children(labels.map((l) => this.label(l, t)))));
  }

  // A heading bar: a stripe in the label's color, its name and how many, set apart
  // from the section above by a line.
  section(s, first, places, t, mono) {
    const color = this.issues.flatMap((i) => i.labels).find((l) => l.name === s.key)?.color ?? s.color ?? t.dim;
    return v_flex().flex_none().when(!first, (e) => e.border_t(1).border_color(t.border))
      .child(h_flex().h(36).pr(14).gap(8).items_center().bg(t.chrome).border_b(1).border_color(t.border)
        .child(div().w(3).h_full().flex_none().bg(color))
        .child(div().pl(8).text_size(13).font_semibold().text_color(t.foreground).child(s.title))
        .child(div().h(18).px(7).flex_none().rounded(9).bg(t.raised).text_size(11).font_medium()
          .text_color(s.issues.length ? t.foreground : t.dim).child(String(s.issues.length))))
      .when(s.issues.length === 0, (e) => e.child(div().px(14).py(8).text_size(11.5).text_color(t.dim).child("None")))
      .children(byRepo(s.issues).map((g) => v_flex().flex_none().pb(4)
        .child(h_flex().h(28).px(14).pt(6).gap(6).items_center()
          .child(svg(icon("repo")).size(13).flex_none().text_color(t.muted))
          .child(div().text_size(12).font_semibold().text_color(t.foreground).child(g.repo))
          .child(div().text_size(11).text_color(t.dim).child(String(g.issues.length))))
        .children(g.issues.map((i) => this.row(i, s.key, places, t, mono)))));
  }

  body(t) {
    const note = (text, color) => div().p(14).text_size(12).text_color(color).child(text);
    if (this.issues === null) return this.error ? note(this.error, t.blocked) : note("Loading…", t.dim);
    const mono = settings().font_family ?? "JetBrains Mono";
    const places = this.spaceFolders();
    return v_flex().id("issues-list").flex_1().min_h(0).overflow_y_scrollbar()
      .when(Boolean(this.error), (e) => e.child(note(this.error, t.blocked)))
      .children(group(this.issues).map((s, i) => this.section(s, i === 0, places, t, mono)));
  }

  render(cx) {
    const t = theme();
    // In the side panel it draws its own card, as git-graph does; as a pane, the pane's frame is the card.
    return v_flex().id("github-issues").size_full().min_h(0).overflow_hidden().bg(t.background)
      .when(this.panel, (e) => e.rounded(10).border_1().border_color(t.border)).text_color(t.foreground).text_size(12.5)
      .child(this.header(t, cx))
      .child(this.body(t));
  }
}

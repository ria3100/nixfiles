// VS Code's Source Control "Changes" for the focused pane's repository: changed files in
// Merge Changes / Staged Changes / Changes, each with its Material Icon Theme icon (borrowed
// from the file-icons mod), name, folder and status letter. In hydln a click opens the file in an
// editor pane with its changes since HEAD shown in the text, as a preview the next click replaces
// (a double-click keeps it), as the Files panel does; the focused editor's file is marked. A
// deleted file, another machine's, or plain Herdr (no editor): nothing opens.
import { View, div, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, watchFolder, theme, settings, run, commands, focused, panes } from "herdr";
import ICONS from "./icons.js";
import { location, placeKey as key } from "./location.js";

const ICON_DIR = "mods/file-icons";
const LIMIT = 2000;

// hydln opens files in its editor panes (editor.open); plain Herdr has no such command.
let editor = null;
// Remembered once seen: right after the app starts, commands() may not list it yet.
const hasEditor = () => editor ||= commands().some(c => c.name === "editor.open");
// Reads write nothing under .git (no index lock, no fsmonitor cookie): the folder watch would see it.
const READ = ["--no-optional-locks", "-c", "core.fsmonitor=false"];

// Material Icon Theme's rules, as the file-icons mod applies them (files only).
function lookup(table, name, dark) { return (dark ? undefined : ICONS.light[table][name]) ?? ICONS[table][name]; }
function icon(path, dark) {
  const parts = path.toLowerCase().split("/"), name = parts[parts.length - 1];
  let id;
  for (let i = 0; !id && i < parts.length - 1; i++) id = lookup("fileNames", parts.slice(i).join("/"), dark);
  id ??= lookup("fileNames", name, dark);
  for (let dot = name.indexOf("."); !id && dot !== -1; dot = name.indexOf(".", dot + 1)) id = lookup("fileExtensions", name.slice(dot + 1), dark);
  return `${ICON_DIR}/icons/${id ?? ICONS.file}.svg`;
}

const CONFLICTS = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);

// `git status --porcelain=v1 -z --no-renames`: "XY path" entries, paths from the repository root.
// Returns the three groups VS Code shows, each entry { path, letter, group }.
function parseStatus(out) {
  const merge = [], staged = [], changes = [];
  for (const entry of out.split("\0").filter(Boolean).slice(0, LIMIT)) {
    const x = entry[0], y = entry[1], path = entry.slice(3);
    if (CONFLICTS.has(x + y)) { merge.push({ path, letter: "!", group: "merge" }); continue; }
    if (x === "?") { changes.push({ path, letter: "U", group: "untracked" }); continue; }
    if (x !== " ") staged.push({ path, letter: x, group: "staged" });
    if (y !== " ") changes.push({ path, letter: y, group: "changes" });
  }
  const byPath = (a, b) => a.path.localeCompare(b.path);
  return [
    { id: "merge", title: "Merge Changes", files: merge.sort(byPath) },
    { id: "staged", title: "Staged Changes", files: staged.sort(byPath) },
    { id: "changes", title: "Changes", files: changes.sort(byPath) },
  ].filter(g => g.files.length);
}

export default class GitChanges extends View {
  init(_props, cx) {
    this.groups = [];
    // Each place's list, shown again at once on coming back.
    this.seen = new Map();
    this.refresh(cx);
    cx.timer.every(10000, cx => this.refresh(cx));
  }

  watch(top, cx) {
    if (this.on || this.watched === top) return;
    this.watched = top;
    cx.spawn(async cx => {
      try { while (this.watched === top) { await watchFolder(top); if (this.watched === top) this.refresh(cx); } }
      catch { if (this.watched === top) this.watched = null; }
    });
  }

  refresh(cx) {
    if (this.loading) return;
    const { cwd, on } = location(), context = key();
    if (context !== this.context) {
      if (this.context) this.seen.set(this.context, { top: this.top, groups: this.groups });
      const seen = this.seen.get(context);
      this.context = context; this.on = on; this.top = seen?.top ?? null; this.groups = seen?.groups ?? []; this.error = null; this.watched = null;
    }
    if (!cwd) return;
    this.loading = true;
    cx.spawn(async cx => {
      try {
        const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd, on }).catch(() => null);
        if (key() !== context) return;
        if (top?.code !== 0) { this.top = null; this.groups = []; this.error = null; return; }
        const root = top.stdout.trim();
        const status = await exec("git", [...READ, "status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all"], { cwd: root, on });
        if (key() !== context) return;
        if (status.code !== 0) { this.error = status.stderr.trim() || "git status failed"; return; }
        this.top = root; this.groups = parseStatus(status.stdout); this.error = null;
        this.watch(root, cx);
      } catch (e) { if (key() === context) this.error = String(e); }
      finally { this.loading = false; cx.notify(); }
    });
  }

  // A click opens the preview; a double-click (its second click) keeps the tab.
  open(file, pin) {
    if (this.on || !hasEditor() || file.letter === "D") return;
    run("editor.open", { path: `${this.top}/${file.path}`, preview: !pin, diff: true });
  }

  // Marks the focused editor's file (`editor.path` in panes()). Called while drawing.
  follow() {
    const f = focused(), pane = f?.pane ? panes().find(p => p.pane === f.pane) : null;
    this.selected = pane?.editor?.path ?? null;
  }

  row(file, t, dark) {
    const slash = file.path.lastIndexOf("/"), name = file.path.slice(slash + 1), folder = slash < 0 ? "" : file.path.slice(0, slash);
    const color = file.letter === "A" || file.letter === "U" ? t.ansi2 : file.letter === "D" || file.letter === "!" ? t.ansi1 : t.blocked;
    return h_flex().id(`change-${file.group}-${file.path}`).h(26).flex_none().pl(14).pr(8).gap(7).items_center().rounded(7).cursor_pointer()
      .when(`${this.top}/${file.path}` === this.selected, el => el.bg(t.selected)).hover(s => s.bg(t.hover))
      .on_click((e) => this.open(file, e.click_count >= 2))
      .child(image(icon(file.path, dark)).size(16).flex_none())
      .child(h_flex().flex_1().min_w(0).gap(6).items_center()
        .child(div().flex_none().max_w_full().truncate().child(name))
        .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.dim).child(folder)))
      .child(div().flex_none().w(12).text_size(11).text_color(color).child(file.letter));
  }

  render(cx) {
    if (key() !== this.context) this.refresh(cx);
    this.follow();
    const t = theme(), dark = Boolean(settings().dark);
    const total = this.groups.reduce((n, g) => n + g.files.length, 0);
    const list = [];
    for (const group of this.groups) {
      list.push(h_flex().id(`group-${group.id}`).h(26).flex_none().px(6).gap(6).items_center().text_size(11).font_semibold().text_color(t.muted)
        .child(div().flex_1().child(group.title.toUpperCase()))
        .child(div().px(6).rounded(8).bg(t.hover).child(String(group.files.length))));
      for (const file of group.files) list.push(this.row(file, t, dark));
    }
    const empty = this.error || (this.loading && !this.top ? "Loading changes…" : !this.top ? "Not a git repository" : total ? null : "No changes");
    return v_flex().id("git-changes").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13)
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().font_semibold().child("Changes"))
        .child(div().flex_1().min_w(0).truncate().text_right().text_size(12).text_color(t.dim).child(this.top?.split(/[\\/]/).pop() ?? "")))
      .child(v_flex().id("git-changes-list").flex_1().min_h(0).overflow_y_scrollbar().p(6).children(list)
        .when(Boolean(empty), el => el.child(div().p(8).text_size(12).text_color(t.dim).child(empty))));
  }
}

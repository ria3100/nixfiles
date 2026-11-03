// VS Code's Source Control "Changes" for the focused pane's repository: changed files in
// Merge Changes / Staged Changes / Changes, each with its Material Icon Theme icon (borrowed
// from the file-icons mod), name, folder and status letter. Clicking a file opens it in a tab of
// the nvim whose folder holds it, or starts nvim in a new tab, and shows its diff with fugitive:
// a staged file as the index against HEAD, an unstaged one as the working file against the index.
import { View, div, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, panes, focused, exec, hc, run, watchFolder, theme, settings } from "herdr";
import ICONS from "./icons.js";

const ICON_DIR = "mods/file-icons";
const LIMIT = 2000;

// Runs the vim expression ($1) in the first nvim whose process descends from one of the
// terminal pids that follow, tried in order, and prints that pid. Exits 1 when none runs nvim.
const NVIM_RUN = `
expr=$1; shift
for want in "$@"; do
  for s in "\${TMPDIR:-/tmp}"/nvim."$USER"/*/nvim.*.0; do
    [ -S "$s" ] || continue
    pid=\${s##*/nvim.}; pid=\${pid%.0}
    for _ in 1 2 3 4; do
      if [ "$pid" = "$want" ]; then
        nvim --server "$s" --remote-expr "$expr" >/dev/null && echo "$want" && exit 0
        break
      fi
      pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
      [ -n "$pid" ] || break
    done
  done
done
exit 1
`;

const shellQuote = text => `'${text.replaceAll("'", `'\\''`)}'`;
const vimString = text => `'${text.replaceAll("'", "''")}'`;
// Reads write nothing under .git (no index lock, no fsmonitor cookie): the folder watch would see it.
const READ = ["--no-optional-locks", "-c", "core.fsmonitor=false"];

function location() {
  const space = spaces().find(s => s.active), f = focused();
  const pane = f?.pane ? panes().find(p => p.pane === f.pane) : null;
  const on = f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] : null) : space?.machine ?? null;
  return { cwd: pane?.cwd || f?.cwd || space?.folder, on };
}
const key = () => JSON.stringify(location());

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

// The Ex commands that show a change once its file is open in the current window.
function diffCommands(file) {
  const load = "silent! Lazy load vim-fugitive";
  const edit = object => `exe 'Gedit ' . fnameescape(${vimString(object)})`;
  if (file.group === "staged") {
    if (file.letter === "A") return [load, edit(`:${file.path}`)];
    if (file.letter === "D") return [load, edit(`HEAD:${file.path}`)];
    return [load, edit(`:${file.path}`), "Gvdiffsplit HEAD"];
  }
  if (file.group === "changes") return file.letter === "D" ? [load, edit(`:${file.path}`)] : [load, "Gvdiffsplit"];
  return [];
}

export default class GitChanges extends View {
  init(_props, cx) {
    this.groups = [];
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
      this.context = context; this.on = on; this.top = null; this.groups = []; this.error = null; this.watched = null;
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

  // Opens the file in a tab of the nvim whose folder holds it (this space's first, the deepest
  // folder first) and focuses its pane; with none, in a new tab whose shell runs nvim.
  open(file, cx) {
    const top = this.top, on = this.on, abs = `${top}/${file.path}`, space = spaces().find(s => s.active);
    const commands = diffCommands(file);
    const here = new Set(space?.tabs.map(t => t.id) ?? []);
    const candidates = panes().filter(p => p.terminal && p.cwd && abs.startsWith(p.cwd.replace(/\/$/, "") + "/"))
      .sort((a, b) => Number(here.has(b.tab)) - Number(here.has(a.tab)) || b.cwd.length - a.cwd.length);
    const expr = `execute(['tab drop ' . fnameescape(${vimString(abs)}), 'silent! only'${commands.map(c => `, ${vimString(c)}`).join("")}])`;
    cx.spawn(async () => {
      const pids = new Map();
      for (const pane of candidates) {
        const got = await hc(["get", pane.terminal]).catch(() => null);
        const pid = got?.code === 0 ? JSON.parse(got.stdout).pid : null;
        if (pid) pids.set(String(pid), pane);
      }
      const ran = pids.size ? await exec("sh", ["-c", NVIM_RUN, "nvim-run", expr, ...pids.keys()], { on }).catch(() => null) : null;
      const pane = ran?.code === 0 ? pids.get(ran.stdout.trim()) : null;
      if (!pane) {
        const args = [shellQuote(abs), ...commands.map(c => `-c ${shellQuote(c)}`)].join(" ");
        run("tab.new", { space: space?.id, folder: top, argv: ["/bin/zsh", "-l", "-c", `nvim ${args}; exec /bin/zsh -l`] });
        return;
      }
      const owner = spaces().find(s => s.tabs.some(t => t.id === pane.tab));
      if (owner) run("space.select", { id: owner.id });
      run("tab.select", { id: pane.tab });
      run("pane.focus", { pane: pane.pane });
    });
  }

  row(file, t, dark) {
    const slash = file.path.lastIndexOf("/"), name = file.path.slice(slash + 1), folder = slash < 0 ? "" : file.path.slice(0, slash);
    const color = file.letter === "A" || file.letter === "U" ? t.ansi2 : file.letter === "D" || file.letter === "!" ? t.ansi1 : t.blocked;
    return h_flex().id(`change-${file.group}-${file.path}`).h(26).flex_none().pl(14).pr(8).gap(7).items_center().rounded(7).cursor_pointer().hover(s => s.bg(t.hover))
      .on_click((_e, cx) => this.open(file, cx))
      .child(image(icon(file.path, dark)).size(16).flex_none())
      .child(h_flex().flex_1().min_w(0).gap(6).items_center()
        .child(div().flex_none().max_w_full().truncate().child(name))
        .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.dim).child(folder)))
      .child(div().flex_none().w(12).text_size(11).text_color(color).child(file.letter));
  }

  render(cx) {
    if (key() !== this.context) this.refresh(cx);
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

// Herdr's Files panel with VS Code's Material Icon Theme icons: a lazy file browser for the
// focused pane's folder. Clicking a file opens it in nvim in a Herdr tab of its own, reusing the
// tab nobody has edited yet as VS Code's preview does; a double-click keeps the tab (nvim.js).
// Focusing such a tab opens the folders down to its file and marks the file's row. Changed files and the folders
// above them take their git status color, and a right-click opens a menu (menu.js) of copies and
// folder actions.
//
// Modified from Herdr's shipped `files` mod (https://github.com/herdrdev/herdr-app, Apache-2.0):
// added DIR, icon() and the Material Icon Theme icons in the rows and the preview header, and
// openInNvim() (nvim.js) in place of the read-only preview on click, the status colors and the menu.
import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, Editor, EditorState } from "gpui-base";
import { spaces, panes, focused, exec, props, openOverlay, readTextFile, watchFolder, theme, settings, window } from "herdr";
import ICONS from "./icons.js";
import { openInNvim, filesId, nvimFile } from "./nvim.js";
import { Menu, menuItems, menuHeight } from "./menu.js";

// One mod, two roles: the panel, and over the window its right-click menu (props.role "menu").

// Monokai for the file preview.
const MONOKAI = { keyword: "#f92672", operator: "#f92672", string: "#e6db74", "string.escape": "#ae81ff", comment: "#75715e",
  function: "#a6e22e", type: "#66d9ef", number: "#ae81ff", constant: "#ae81ff", boolean: "#ae81ff", variable: "#f8f8f2", punctuation: "#f8f8f2" };

// While a new tab's pane or its folder isn't known yet, the panel stays where it was.
let last = null;
function location() {
  const space = spaces().find(s => s.active), f = focused();
  const pane = f?.pane ? panes().find(p => p.pane === f.pane) : null;
  const unknown = f?.pane ? !pane || (pane.terminal && !pane.cwd) : f && !f.terminal;
  if (unknown && last) return last;
  const on = f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] : null) : space?.machine ?? null;
  return last = { cwd: pane?.cwd || f?.cwd || space?.folder, on };
}
const key = () => JSON.stringify(location());
const LANG = { ts: "js", tsx: "js", mts: "js", cts: "js", jsx: "js", mjs: "js", toml: "yaml", jsonc: "json", svelte: "html", vue: "html" };
const PER_FOLDER = 500, TOTAL = 5000;
const DIR = "mods/file-icons";
const URGENCY = ["A", "M", "D", "U"];

// Material Icon Theme's rules, as VS Code applies them: names match case-insensitively; a
// path rule (".github/workflows") beats a name, a name beats an extension, and the longest
// extension wins ("spec.ts" over "ts"). Light themes check the theme's light table first.
const bare = name => name.replace(/^__(.+)__$/, "$1").replace(/^[._-]/, "");
const opened = id => id.endsWith("_light") ? `${id.slice(0, -6)}-open_light` : `${id}-open`;
function lookup(table, key, dark) { return (dark ? undefined : ICONS.light[table][key]) ?? ICONS[table][key]; }
function icon(path, dir, open, dark) {
  const parts = path.toLowerCase().split("/"), name = parts[parts.length - 1];
  const table = dir ? "folderNames" : "fileNames", find = key => lookup(table, key, dark) ?? (dir ? lookup(table, bare(key), dark) : undefined);
  let id;
  for (let i = 0; !id && i < parts.length - 1; i++) id = find(parts.slice(i).join("/"));
  if (dir) {
    id ??= find(name) ?? ICONS.folder;
    return `${DIR}/icons/${open ? opened(id) : id}.svg`;
  }
  id ??= lookup(table, name, dark);
  for (let dot = name.indexOf("."); !id && dot !== -1; dot = name.indexOf(".", dot + 1)) id = lookup("fileExtensions", name.slice(dot + 1), dark);
  return `${DIR}/icons/${id ?? ICONS.file}.svg`;
}

async function directory(path, on) {
  if (!on && window()?.platform === "windows") {
    const r = await exec("powershell", ["-NoProfile", "-Command", "& { param($p) @(Get-ChildItem -LiteralPath $p -Force -ErrorAction Stop | Where-Object Name -ne '.git' | Select-Object -First 501 | ForEach-Object { @{ name=$_.Name; dir=($_.PSIsContainer -and -not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint)) } }) | ConvertTo-Json -Compress }", path]);
    if (r.code !== 0) throw new Error(r.stderr || "Cannot list this folder");
    const result = JSON.parse(r.stdout || "[]");
    return Array.isArray(result) ? result : [result];
  }
  const script = 'n=0; for p in "$1"/* "$1"/.[!.]* "$1"/..?*; do [ -e "$p" ] || [ -L "$p" ] || continue; name=${p##*/}; [ "$name" = .git ] && continue; if [ -d "$p" ] && [ ! -L "$p" ]; then kind=d; else kind=f; fi; printf "%s\\0%s\\0" "$kind" "$name"; n=$((n+1)); [ "$n" -gt 500 ] && break; done; test -d "$1"';
  const r = await exec("sh", ["-c", script, "files", path], { on });
  if (r.code !== 0) throw new Error(r.stderr || "Cannot list this folder");
  const fields = r.stdout.split("\0"), out = [];
  for (let i = 0; i + 1 < fields.length; i += 2) out.push({ name: fields[i + 1], dir: fields[i] === "d" });
  return out;
}

export default class Files extends View {
  init(_props, cx) {
    if (props()?.role === "menu") { this.menu = new Menu(); this.menu.init(cx); return; }
    this.entries = new Map(); this.folders = new Set(); this.pending = new Set(); this.marks = {};
    // Each place the panel showed: its open folders and listings, shown again at once on coming back.
    this.opened = new Map();
    this.refresh(cx);
    cx.timer.every(10000, cx => this.refresh(cx));
  }

  watch(root, cx) {
    if (this.on || this.watched === root) return;
    this.watched = root;
    cx.spawn(async cx => {
      try { while (this.watched === root) { await watchFolder(root); if (this.watched === root) this.refresh(cx); } }
      catch { if (this.watched === root) this.watched = null; }
    });
  }

  async loadFolder(path, context) {
    const on = this.on, root = this.root;
    const entries = await directory(path ? `${root}/${path}` : root, on);
    if (key() !== context || (path && !this.folders.has(path))) return;
    const used = [...this.entries.entries()].filter(([p]) => p !== path).reduce((n, [, e]) => n + e.length, 0);
    this.entries.set(path, entries.slice(0, Math.max(0, Math.min(PER_FOLDER, TOTAL - used))).sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name)));
    if (entries.length > PER_FOLDER || used + entries.length > TOTAL) this.limited = true;
  }

  refresh(cx) {
    if (this.loading) return;
    const { cwd, on } = location(), context = key();
    if (context !== this.context) {
      if (this.context) this.opened.set(this.context, { folders: this.folders, entries: this.entries, marks: this.marks, folderMarks: this.folderMarks, top: this.top });
      const seen = this.opened.get(context);
      this.context = context; this.root = cwd; this.on = on; this.entries = new Map(seen?.entries); this.folders = new Set(seen?.folders);
      this.pending = new Set(); this.marks = seen?.marks ?? {}; this.folderMarks = seen?.folderMarks ?? {}; this.top = seen?.top ?? null;
      this.show(null); this.watched = null; this.error = null; this.limited = false;
    }
    if (!cwd) return;
    this.loading = true;
    this.limited = false;
    cx.spawn(async cx => {
      try {
        for (const path of ["", ...this.folders]) await this.loadFolder(path, context);
        const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd, on }).catch(() => null);
        const marks = {}, folderMarks = {};
        if (top?.code === 0) {
          // Writes nothing under .git (index lock, fsmonitor cookie): the folder watch would refresh again.
          const status = await exec("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", "status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=normal"], { cwd, on }).catch(() => null);
          if (status?.code === 0) for (const entry of status.stdout.split("\0").filter(Boolean).slice(0, TOTAL)) {
            const xy = entry.slice(0, 2);
            // An untracked folder comes as "dir/": it is marked itself, its files inherit it in rows().
            const root = top.stdout.trim(), path = `${root}/${entry.slice(3).replace(/\/$/, "")}`;
            const mark = xy === "??" || xy.includes("A") ? "A" : xy.includes("U") ? "U" : xy.includes("D") ? "D" : "M";
            marks[path] = mark;
            // As VS Code does, every folder above a change takes the most urgent mark below it.
            for (let dir = path.slice(0, path.lastIndexOf("/")); dir.length > root.length; dir = dir.slice(0, dir.lastIndexOf("/")))
              if (URGENCY.indexOf(mark) > URGENCY.indexOf(folderMarks[dir])) folderMarks[dir] = mark;
          }
        }
        if (key() !== context) return;
        this.top = top?.code === 0 ? top.stdout.trim() : null;
        this.marks = marks; this.folderMarks = folderMarks; this.error = null; this.watch(cwd, cx);
      } catch (e) { if (key() === context) this.error = String(e); }
      finally { this.loading = false; cx.notify(); }
    });
  }

  toggle(path, cx) {
    if (this.folders.has(path)) {
      for (const folder of [...this.folders]) if (folder === path || folder.startsWith(path + "/")) {
        this.folders.delete(folder);
        this.entries.delete(folder);
      }
    } else this.expand(path, cx);
    cx.notify();
  }

  expand(path, cx) {
    this.folders.add(path);
    if (this.entries.has(path) || this.pending.has(path)) return;
    const context = this.context;
    this.pending.add(path);
    cx.spawn(async cx => {
      try { await this.loadFolder(path, context); }
      catch (e) { if (key() === context) this.error = String(e); }
      finally { this.pending.delete(path); cx.notify(); }
    });
  }

  // The focused pane is a Files nvim: open the folders down to its file and mark it. Again when
  // its title (folder/file) changes, i.e. nvim moved to another file, or the panel's place does.
  follow(cx) {
    const f = focused(), pane = f?.pane ? panes().find(p => p.pane === f.pane) : null;
    const id = pane ? filesId(pane) : null, seen = id ? `${pane.pane}\0${pane.title}\0${this.context}` : null;
    if (seen === this.following) return;
    this.following = seen;
    if (!id) { this.selected = null; return; }
    const on = this.on;
    cx.spawn(async cx => {
      const file = await nvimFile(id, on);
      if (this.following !== seen || !file || !this.root || !file.startsWith(this.root + "/")) return;
      const rel = file.slice(this.root.length + 1), parts = rel.split("/");
      for (let i = 1; i < parts.length; i++) this.expand(parts.slice(0, i).join("/"), cx);
      this.selected = rel;
      cx.notify();
    });
  }

  // A click opens the preview; a double-click (its second click) keeps the tab.
  openInNvim(path, pin, cx) {
    const file = `${this.root}/${path}`, on = this.on, folder = this.root;
    cx.spawn(async () => { await openInNvim(file, { on, folder, pin }); });
  }

  // Paths relative to the repository root when there is one (as VS Code's workspace), else to the panel's folder.
  openMenu(path, entry) {
    const abs = `${this.root}/${path}`, base = this.top && abs.startsWith(this.top + "/") ? this.top : this.root;
    const target = { abs, rel: abs.slice(base.length + 1), name: entry.name, dir: entry.dir, on: this.on, root: this.root };
    openOverlay({ mod: "file-icons", kind: "popup", at: "pointer", width: 240, height: menuHeight(menuItems(target)), props: { role: "menu", target } });
  }

  show(path, cx) {
    this.code?.release(); this.code = null; this.file = path; this.fileError = null;
    if (!path || !cx) return;
    const context = this.context, root = this.root, on = this.on;
    cx.spawn(async cx => {
      try {
        const text = await readTextFile(`${root}/${path}`, { on });
        if (this.file !== path || key() !== context) return;
        if (text === null) { this.fileError = "This file is no longer available"; return; }
        if (text.includes("\0")) { this.fileError = "Binary file · no text preview"; return; }
        const t = theme(), ext = path.includes(".") ? path.split(".").pop() : "txt";
        this.code = EditorState.new({ language: LANG[ext] ?? ext, readonly: true,
          value: text.length > 400000 ? text.slice(0, 400000) + "\n… (file truncated)" : text,
          font_family: settings().font_family, font_size: 12,
          syntax: MONOKAI });
      } catch { if (this.file === path && key() === context) this.fileError = "Cannot preview this file (binary, too large, or unreadable)"; }
      finally { cx.notify(); }
    });
  }

  // Inside a folder git reports as untracked as a whole.
  untrackedAbove(abs) {
    for (let dir = abs.slice(0, abs.lastIndexOf("/")); dir.length > (this.root?.length ?? 0); dir = dir.slice(0, dir.lastIndexOf("/")))
      if (this.marks[dir] === "A") return true;
    return false;
  }

  rows(prefix, depth, out, t, dark) {
    if (out.length >= TOTAL || depth > 40) return out;
    for (const entry of this.entries.get(prefix) ?? []) {
      if (out.length >= TOTAL) break;
      const path = prefix ? `${prefix}/${entry.name}` : entry.name, open = this.folders.has(path), abs = `${this.root}/${path}`;
      const own = this.marks[abs] ?? (this.untrackedAbove(abs) ? "A" : undefined);
      const mark = own ?? (entry.dir ? this.folderMarks?.[abs] : undefined), dot = !own && Boolean(mark);
      const markColor = mark === "A" ? t.ansi2 : mark === "D" || mark === "U" ? t.ansi1 : t.blocked;
      out.push(h_flex().id(`file-${path}`).h(28).flex_none().pl(8 + depth * 18).pr(8).gap(7).items_center().rounded(7).cursor_pointer().when(path === this.selected, el => el.bg(t.selected)).hover(s => s.bg(t.hover))
        .on_click((e, cx) => entry.dir ? this.toggle(path, cx) : this.openInNvim(path, e.click_count >= 2, cx))
        .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); this.openMenu(path, entry); })
        .child(entry.dir ? svg(`${DIR}/chevron-${open ? "down" : "right"}.svg`).size(12).flex_none().text_color(t.dim) : div().w(12).flex_none())
        .child(image(icon(path, entry.dir, open, dark)).size(16).flex_none())
        .child(div().flex_1().min_w(0).truncate().when(Boolean(mark), el => el.text_color(markColor)).child(entry.name))
        .when(Boolean(mark), el => el.child(div().text_size(11).text_color(markColor).child(dot ? "•" : mark))));
      if (entry.dir && open) this.rows(path, depth + 1, out, t, dark);
    }
    return out;
  }

  render(cx) {
    if (this.menu) return this.menu.render(cx);
    if (key() !== this.context) this.refresh(cx);
    this.follow(cx);
    const t = theme(), dark = Boolean(settings().dark);
    return v_flex().id("files").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13)
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .when(Boolean(this.file), el => el.child(div().id("files-back").w(20).cursor_pointer().text_color(t.muted).on_click((_e, cx) => { this.show(null); cx.notify(); }).child("←")))
        .child(div().font_semibold().child("Files"))
        .child(h_flex().flex_1().min_w(0).gap(6).justify_end().items_center().text_size(12).text_color(t.dim)
          .when(Boolean(this.file), el => el.child(image(icon(this.file, false, false, dark)).size(14).flex_none()))
          .child(div().min_w(0).truncate().child(this.file ?? this.root?.split(/[\\/]/).pop() ?? ""))))
      .when(!this.file, el => el.child(v_flex().id("files-tree").flex_1().min_h(0).overflow_y_scrollbar().p(6).children(this.rows("", 0, [], t, dark))
        .when(Boolean(this.error) || !this.entries.get("")?.length, el => el.child(div().p(8).text_size(12).text_color(t.dim).child(this.error || (this.loading ? "Loading files…" : this.root ? "No files" : "No folder"))))
        .when(this.limited, el => el.child(div().p(8).text_size(11).text_color(t.dim).child("File list limited to 500 entries per folder and 5,000 total")))))
      .when(Boolean(this.file), el => el.child(this.code ? Editor.new(this.code).flex_1().min_h(0) : div().p(12).text_color(t.dim).child(this.fileError || "Loading file…")));
  }
}

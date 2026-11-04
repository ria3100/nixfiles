// Everything Herdr does with nvim, so nvim's own config knows nothing of Herdr. Used by the Files
// panel and its menu, the Changes panel (git-changes) and tabs-graph (tab names, cmd-w).
//
// As VS Code's editor tabs: each file opens in a Herdr tab of its own running nvim, and the tab
// nobody has edited yet (the preview) is reused for the next file; a double-click keeps (pins) it.
// These "Files nvims" are started with --listen on ${TMPDIR:-/tmp}/herdr-files-<id>.sock (their
// terminal's argv carries the id) and with SETUP: a "folder/file" title for the tab name, and
// g:herdr_edited once anything was changed, which keeps the tab. The tab closes when nvim exits.
import { spaces, panes, focused, terminals, exec, run } from "herdr";

const SETUP = [
  "set title titlestring=%{expand('%:p:h:t')}/%t",
  "autocmd BufModifiedSet * if &modified | let g:herdr_edited = 1 | endif",
];
const PIN = "let g:herdr_edited = 1";
// Deletes the listed buffers other than the current one (a preview's earlier files; none is modified).
const DROP_OTHERS = "lua for _, b in ipairs(vim.api.nvim_list_bufs()) do if b ~= vim.api.nvim_get_current_buf() and vim.bo[b].buflisted and not vim.bo[b].modified then pcall(vim.api.nvim_buf_delete, b, {}) end end";

// The id of the Files nvim a pane runs, or null.
export function filesId(pane) {
  const argv = terminals().find(t => t.address === pane?.terminal)?.argv ?? [];
  return argv.join(" ").match(/herdr-files-([a-z0-9]+)\.sock/)?.[1] ?? null;
}

// Evaluates a Vim expression in a Files nvim. code 9: nothing listens on its socket.
const REMOTE = `s="\${TMPDIR:-/tmp}/herdr-files-$1.sock"; [ -S "$s" ] || exit 9; nvim --server "$s" --remote-expr "$2"`;
const remote = (id, expr, on) => exec("sh", ["-c", REMOTE, "nvim-remote", id, expr], { on }).catch(() => null);
const vimString = text => `'${text.replaceAll("'", "''")}'`;
const shellString = text => `'${text.replaceAll("'", `'\\''`)}'`;

// The file the current window shows: for a fugitive buffer (a diff's index or HEAD side), its work tree file.
const SHOWN = "exists('*FugitiveReal') ? FugitiveReal(@%) : expand('%:p')";

// The file a Files nvim shows, or null.
export async function nvimFile(id, on = null) {
  const got = await remote(id, SHOWN, on);
  return got?.code === 0 && got.stdout.trim() || null;
}

// The focused pane's Files nvim, if it is one: { id, seen } where `seen` changes with the pane and
// its title (folder/file), i.e. when nvim moves to another file.
export function focusedNvim() {
  const f = focused(), pane = f?.pane ? panes().find(p => p.pane === f.pane) : null;
  const id = pane ? filesId(pane) : null;
  return id ? { id, seen: `${pane.pane}\0${pane.title}` } : null;
}

// `:confirm qall`: nvim asks about unsaved changes, and this resolves once it has the answer.
// False when no nvim listens.
export async function quitNvim(id, on = null) {
  return (await remote(id, "execute('confirm qall')", on))?.code !== 9;
}

// One open at a time: a double-click's second open must see the tab its first click made.
let queue = Promise.resolve();
export function openInNvim(file, options) {
  const opened = queue.then(() => open(file, options));
  queue = opened.catch(() => {});
  return opened;
}

// Focuses the file's tab in this space if it has one, else opens the file in the preview, else in
// a new tab of this space started in `folder`. `pin`: the tab is kept as if edited. `commands`:
// Ex commands run once the file is in the window (Changes' diff), in a tab cleared of other windows.
async function open(file, { on = null, folder, pin = false, commands = [] } = {}) {
  const space = spaces().find(s => s.active);
  const here = new Set(space?.tabs.map(t => t.id) ?? []);
  const nvims = [];
  for (const pane of panes().filter(p => here.has(p.tab))) {
    const id = filesId(pane);
    if (!id || panes().some(p => p.tab === pane.tab && p.pane !== pane.pane)) continue;
    const got = await remote(id, `json_encode([${SHOWN}, &modified || get(g:, 'herdr_edited', 0)])`, on);
    const [shown, edited] = (() => { try { return JSON.parse(got?.stdout); } catch { return []; } })();
    if (got?.code === 0) nvims.push({ id, pane, shown, edited });
  }
  // As Vim expressions, for execute([...]). A preview drops what it showed before, as VS Code's does.
  const show = [vimString("silent! only"), vimString("diffoff!"), `'edit ' . fnameescape(${vimString(file)})`];
  let target = nvims.find(n => n.shown === file), ex = commands.length ? show : [];
  if (!target) { target = nvims.find(n => !n.edited); ex = [...show, vimString(DROP_OTHERS)]; }
  ex = ex.length ? [...ex, ...commands.map(vimString)] : [];
  // A command failing (a diff fugitive can't show) still leaves the file there: only a gone nvim falls through.
  if (target && ex.length && [undefined, 9].includes((await remote(target.id, `execute([${ex.join(", ")}])`, on))?.code)) target = null;
  if (target) {
    if (pin) await remote(target.id, `execute(${vimString(PIN)})`, on);
    run("tab.select", { id: target.pane.tab });
    run("pane.focus", { pane: target.pane.pane });
    return;
  }
  const id = Math.random().toString(36).slice(2, 10);
  const startup = pin ? [...SETUP, PIN] : SETUP;
  const args = ["--listen", `"\${TMPDIR:-/tmp}/herdr-files-${id}.sock"`, ...startup.flatMap(c => ["-c", shellString(c)]), "--", shellString(file)];
  // Herdr runs argv in a shell that stays after it: hang that shell up so the tab closes with nvim.
  run("tab.new", { space: space?.id, folder: folder ?? file.slice(0, file.lastIndexOf("/")), argv: ["/bin/zsh", "-l", "-c", `nvim ${args.join(" ")}; kill -HUP $PPID`] });
  // Until it answers (3s at most), so the next open finds it. The commands go then, not with -c:
  // plugins nvim loads lazily (fugitive) aren't there yet at startup.
  for (let i = 0; i < 30 && (await remote(id, "1", on))?.code !== 0; i++) await exec("sleep", ["0.1"]).catch(() => null);
  if (commands.length) await remote(id, `execute([${commands.map(vimString).join(", ")}])`, on);
}

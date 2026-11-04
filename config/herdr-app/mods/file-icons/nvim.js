// Everything Herdr does with nvim, so nvim's own config knows nothing of Herdr. Used by the Files
// panel and its menu, and by tabs-graph (tab names, cmd-w).
//
// As VS Code's editor tabs: each file opens in a Herdr tab of its own running nvim, and the tab
// nobody has edited yet (the preview) is reused for the next file; a double-click keeps (pins) it.
// These "Files nvims" are started with --listen on ${TMPDIR:-/tmp}/herdr-files-<id>.sock (their
// terminal's argv carries the id) and with SETUP: a "folder/file" title for the tab name, and
// g:herdr_edited once anything was changed, which keeps the tab. The tab closes when nvim exits.
import { spaces, panes, terminals, exec, run } from "herdr";

const SETUP = [
  "set title titlestring=%{expand('%:p:h:t')}/%t",
  "autocmd BufModifiedSet * if &modified | let g:herdr_edited = 1 | endif",
];
const PIN = "let g:herdr_edited = 1";

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

// The file a Files nvim shows, or null.
export async function nvimFile(id, on = null) {
  const got = await remote(id, "expand('%:p')", on);
  return got?.code === 0 && got.stdout.trim() || null;
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
// a new tab of this space started in `folder`. `pin`: the tab is kept as if edited.
async function open(file, { on = null, folder, pin = false } = {}) {
  const space = spaces().find(s => s.active);
  const here = new Set(space?.tabs.map(t => t.id) ?? []);
  const nvims = [];
  for (const pane of panes().filter(p => here.has(p.tab))) {
    const id = filesId(pane);
    if (!id || panes().some(p => p.tab === pane.tab && p.pane !== pane.pane)) continue;
    const got = await remote(id, "json_encode([expand('%:p'), &modified || get(g:, 'herdr_edited', 0)])", on);
    const [shown, edited] = (() => { try { return JSON.parse(got?.stdout); } catch { return []; } })();
    if (got?.code === 0) nvims.push({ id, pane, shown, edited });
  }
  let target = nvims.find(n => n.shown === file);
  if (!target) {
    target = nvims.find(n => !n.edited);
    if (target && (await remote(target.id, `execute('edit ' . fnameescape(${vimString(file)}))`, on))?.code !== 0) target = null;
  }
  if (target) {
    if (pin) await remote(target.id, `execute(${vimString(PIN)})`, on);
    run("tab.select", { id: target.pane.tab });
    run("pane.focus", { pane: target.pane.pane });
    return;
  }
  const id = Math.random().toString(36).slice(2, 10);
  const commands = pin ? [...SETUP, PIN] : SETUP;
  const args = ["--listen", `"\${TMPDIR:-/tmp}/herdr-files-${id}.sock"`, ...commands.flatMap(c => ["-c", shellString(c)]), "--", shellString(file)];
  // Herdr runs argv in a shell that stays after it: hang that shell up so the tab closes with nvim.
  run("tab.new", { space: space?.id, folder: folder ?? file.slice(0, file.lastIndexOf("/")), argv: ["/bin/zsh", "-l", "-c", `nvim ${args.join(" ")}; kill -HUP $PPID`] });
  // Until it answers (3s at most), so the next open finds it.
  for (let i = 0; i < 30 && (await remote(id, "1", on))?.code !== 0; i++) await exec("sleep", ["0.1"]).catch(() => null);
}

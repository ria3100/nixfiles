// Opening a file in nvim, shared by the panel and its right-click menu. As VS Code's editor tabs:
// each file gets its own Herdr tab running nvim, and the tab nobody has edited yet (the preview)
// is reused for the next file (a double-click keeps the tab: pin); the tab closes when nvim exits. tabs-graph names these tabs after
// nvim's title (folder/file) and quits them with nvim's `:confirm qall` on cmd-w.
import { spaces, panes, terminals, exec, run } from "herdr";

// A Files nvim listens on ${TMPDIR:-/tmp}/herdr-files-<id>.sock; its terminal's argv carries the id.
const ID = /herdr-files-([a-z0-9]+)\.sock/;
export const filesId = pane => {
  const argv = terminals().find(t => t.address === pane?.terminal)?.argv ?? [];
  return argv.join(" ").match(ID)?.[1] ?? null;
};

// Prints "<id>\t<json>" for each id: [file, modified, edited] of that nvim (json "null" when it doesn't answer).
// The file a Files nvim shows, or null.
export async function nvimFile(id, on = null) {
  const got = await exec("nvim", ["--server", `${await tmp(on)}/herdr-files-${id}.sock`, "--remote-expr", "expand('%:p')"], { on }).catch(() => null);
  return got?.code === 0 && got.stdout.trim() ? got.stdout.trim() : null;
}
const tmps = new Map();
async function tmp(on) {
  if (!tmps.has(on)) tmps.set(on, (await exec("sh", ["-c", 'printf %s "${TMPDIR:-/tmp}"'], { on }).catch(() => null))?.stdout.replace(/\/$/, "") || "/tmp");
  return tmps.get(on);
}

const QUERY = `
expr="json_encode([expand('%:p'), &modified, get(g:, 'herdr_edited', 0)])"
for id in "$@"; do
  r=$(nvim --server "\${TMPDIR:-/tmp}/herdr-files-$id.sock" --remote-expr "$expr" 2>/dev/null) || r=null
  printf '%s\\t%s\\n' "$id" "\${r:-null}"
done
`;
const PIN = `nvim --server "\${TMPDIR:-/tmp}/herdr-files-$1.sock" --remote-expr "execute('let g:herdr_edited = 1')"`;
// Waits (3s at most) until a new nvim answers, so the next open finds its tab.
const READY = `s="\${TMPDIR:-/tmp}/herdr-files-$1.sock"; i=0; while [ $i -lt 30 ]; do nvim --server "$s" --remote-expr 1 >/dev/null 2>&1 && exit 0; sleep 0.1; i=$((i+1)); done; exit 1`;
const EDIT = `nvim --server "\${TMPDIR:-/tmp}/herdr-files-$1.sock" --remote-expr "execute('edit ' . fnameescape('$(printf %s "$2" | sed "s/'/''/g")'))"`;

// The title tabs-graph shows ("folder/file"), and "edited" once any buffer was changed: the tab is kept then.
const SETUP = [
  "set title titlestring=%{expand('%:p:h:t')}/%t",
  "autocmd BufModifiedSet * if &modified | let g:herdr_edited = 1 | endif",
];

const quote = text => `'${text.replaceAll("'", `'\\''`)}'`;

// One open at a time: a double-click's second open must see the tab its first click made.
let queue = Promise.resolve();
export function openInNvim(file, options) {
  const opened = queue.then(() => open(file, options));
  queue = opened.catch(() => {});
  return opened;
}

// Focuses the file's tab in this space if it has one, else opens it in the unedited Files nvim
// (the preview), else in a new tab of this space. `pin`: the tab is kept as if edited.
async function open(file, { on = null, folder, pin = false } = {}) {
  const space = spaces().find(s => s.active);
  const here = new Set(space?.tabs.map(t => t.id) ?? []);
  const tabs = new Map();
  for (const pane of panes().filter(p => here.has(p.tab))) {
    const id = filesId(pane);
    if (id && panes().filter(p => p.tab === pane.tab).length === 1) tabs.set(id, pane);
  }
  const states = [];
  if (tabs.size) {
    const got = await exec("sh", ["-c", QUERY, "nvim-query", ...tabs.keys()], { on }).catch(() => null);
    for (const line of got?.code === 0 ? got.stdout.trim().split("\n") : []) {
      const [id, json] = line.split("\t");
      const state = (() => { try { return JSON.parse(json); } catch { return null; } })();
      if (Array.isArray(state) && tabs.has(id)) states.push({ id, pane: tabs.get(id), file: state[0], modified: state[1], edited: state[2] });
    }
  }
  let target = states.find(s => s.file === file);
  if (!target) {
    target = states.find(s => !s.modified && !s.edited);
    const edited = target ? await exec("sh", ["-c", EDIT, "nvim-edit", target.id, file], { on }).catch(() => null) : null;
    if (edited?.code !== 0) target = null;
  }
  if (!target) {
    const id = Math.random().toString(36).slice(2, 10);
    const setup = pin ? [...SETUP, "let g:herdr_edited = 1"] : SETUP;
    const args = ["--listen", `"\${TMPDIR:-/tmp}/herdr-files-${id}.sock"`, ...setup.flatMap(c => ["-c", quote(c)]), "--", quote(file)];
    // Herdr runs argv in a shell that stays after it: hang that shell up so the tab closes with nvim.
    run("tab.new", { space: space?.id, folder: folder ?? file.slice(0, file.lastIndexOf("/")), argv: ["/bin/zsh", "-l", "-c", `nvim ${args.join(" ")}; kill -HUP $PPID`] });
    await exec("sh", ["-c", READY, "nvim-ready", id], { on }).catch(() => null);
    return;
  }
  if (pin) await exec("sh", ["-c", PIN, "nvim-pin", target.id], { on }).catch(() => null);
  run("tab.select", { id: target.pane.tab });
  run("pane.focus", { pane: target.pane.pane });
}

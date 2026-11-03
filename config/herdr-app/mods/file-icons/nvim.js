// Opening a file in nvim, shared by the panel and its right-click menu.
import { spaces, panes, exec, hc, run } from "herdr";

// Opens the file ($1) in a tab of the first nvim (`tab drop`: its tab if already open) whose process
// descends from one of the terminal pids that follow, tried in order, and prints that pid.
// Exits 1 when none of them runs nvim.
const NVIM_OPEN = `
file=$1; shift
expr="execute('tab drop ' . fnameescape('$(printf %s "$file" | sed "s/'/''/g")'))"
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

const quote = text => `'${text.replaceAll("'", `'\\''`)}'`;

// Opens the file in a tab of the nvim whose folder holds it (this space's first, the deepest folder
// first) and focuses its pane; with none, in a new tab of this space whose shell runs nvim in `folder`.
export async function openInNvim(file, { on = null, folder } = {}) {
  const space = spaces().find(s => s.active);
  const here = new Set(space?.tabs.map(t => t.id) ?? []);
  const candidates = panes().filter(p => p.terminal && p.cwd && file.startsWith(p.cwd.replace(/\/$/, "") + "/"))
    .sort((a, b) => Number(here.has(b.tab)) - Number(here.has(a.tab)) || b.cwd.length - a.cwd.length);
  const pids = new Map();
  for (const pane of candidates) {
    const got = await hc(["get", pane.terminal]).catch(() => null);
    const pid = got?.code === 0 ? JSON.parse(got.stdout).pid : null;
    if (pid) pids.set(String(pid), pane);
  }
  const opened = pids.size ? await exec("sh", ["-c", NVIM_OPEN, "nvim-open", file, ...pids.keys()], { on }).catch(() => null) : null;
  const pane = opened?.code === 0 ? pids.get(opened.stdout.trim()) : null;
  if (!pane) {
    run("tab.new", { space: space?.id, folder: folder ?? file.slice(0, file.lastIndexOf("/")), argv: ["/bin/zsh", "-l", "-c", `nvim ${quote(file)}; exec /bin/zsh -l`] });
    return;
  }
  const owner = spaces().find(s => s.tabs.some(t => t.id === pane.tab));
  if (owner) run("space.select", { id: owner.id });
  run("tab.select", { id: pane.tab });
  run("pane.focus", { pane: pane.pane });
}

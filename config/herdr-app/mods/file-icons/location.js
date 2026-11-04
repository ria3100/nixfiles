// Where the Files and Changes panels look: the focused pane's folder, and the machine it is on.
// While a new tab's pane or its folder isn't known yet, they stay where they were.
import { spaces, panes, focused } from "herdr";

let last = null;
export function location() {
  const space = spaces().find(s => s.active), f = focused();
  const pane = f?.pane ? panes().find(p => p.pane === f.pane) : null;
  const unknown = f?.pane ? !pane || (pane.terminal && !pane.cwd) : f && !f.terminal;
  if (unknown && last) return last;
  const on = f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] : null) : space?.machine ?? null;
  return last = { cwd: pane?.cwd || f?.cwd || space?.folder, on };
}

export const placeKey = () => JSON.stringify(location());

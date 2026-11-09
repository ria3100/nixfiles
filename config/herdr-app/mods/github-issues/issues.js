// Pure helpers (no Herdr imports): the gh query, sorting issues into the
// sections Claude's labels make, and finding an issue's worktree space.

// What github.com/issues/assigned lists: open issues assigned to me, in any repository.
export const SEARCH = ["search", "issues", "--assignee", "@me", "--state", "open", "--limit", "200",
  "--json", "repository,number,title,labels,url,updatedAt"];

// Claude's automatic implementation goes ready -> in-progress -> pr-open. An issue
// with more than one of them shows under the furthest.
// color: the label's color on GitHub, for a heading whose section has no issue to take it from.
export const SECTIONS = [
  { key: "claude:ready", title: "claude:ready", color: "#0e8a16" },
  { key: "claude:in-progress", title: "claude:in-progress", color: "#fbca04" },
  { key: "claude:pr-open", title: "claude:pr-open", color: "#1d76db" },
  { key: "other", title: "Other", color: null },
];
const STAGES = ["claude:pr-open", "claude:in-progress", "claude:ready"];

// `gh search issues --json ...` -> [{ repo, owner, number, title, labels: [{ name, color }], url, updated }].
export function parseIssues(out) {
  const list = JSON.parse(String(out) || "[]");
  return (Array.isArray(list) ? list : []).map((i) => {
    const full = i.repository?.nameWithOwner ?? "";
    return {
      repo: i.repository?.name ?? full.split("/").pop() ?? "",
      owner: full.split("/")[0] ?? "",
      number: Number(i.number),
      title: String(i.title ?? ""),
      labels: (i.labels ?? []).map((l) => ({ name: String(l.name), color: /^[0-9a-f]{6}$/i.test(l.color ?? "") ? `#${l.color}` : null })),
      url: String(i.url ?? ""),
      updated: Date.parse(i.updatedAt) || 0,
    };
  });
}

export function stageOf(issue) {
  const names = new Set(issue.labels.map((l) => l.name));
  return STAGES.find((s) => names.has(s)) ?? "other";
}

// [{ ...section, issues }] in SECTIONS order, newest first inside each; empty sections kept.
export function group(issues) {
  return SECTIONS.map((s) => ({ ...s,
    issues: issues.filter((i) => stageOf(i) === s.key).sort((a, b) => b.updated - a.updated) }));
}

// An issue's worktree: ~/.herdr/worktrees/<repo>/<branch>-<number>. Issue numbers repeat
// across repositories, so the repository's folder is part of the match.
export function isWorktreeOf(path, issue, home) {
  if (!path) return false;
  const base = `${home}/.herdr/worktrees/${issue.repo}/`;
  if (!path.startsWith(base)) return false;
  const dir = path.slice(base.length).split("/")[0];
  return new RegExp(`-${issue.number}$`).test(dir);
}

// spaces: [{ id, name, folders: [path] }] (each space's folder and its panes' live folders).
// Returns the first space one of whose folders is the issue's worktree, or null.
export function spaceFor(issue, spaces, home) {
  return spaces.find((s) => s.folders.some((f) => isWorktreeOf(f, issue, home))) ?? null;
}

const hex = (c, i) => parseInt(c.slice(i, i + 2), 16);
// Dark or light text on a label's own color, as GitHub draws it.
export function inkOn(color) {
  if (!color) return null;
  const l = (0.299 * hex(color, 1) + 0.587 * hex(color, 3) + 0.114 * hex(color, 5)) / 255;
  return l > 0.6 ? "#1f2328" : "#ffffff";
}

// A section's issues by repository: [{ key: "owner/repo", repo, issues }], repositories in
// name order, each keeping the issues' order.
export function byRepo(issues) {
  const groups = new Map();
  for (const i of issues) {
    const key = `${i.owner}/${i.repo}`;
    if (!groups.has(key)) groups.set(key, { key, repo: i.repo, issues: [] });
    groups.get(key).issues.push(i);
  }
  return [...groups.values()].sort((a, b) => a.repo.localeCompare(b.repo) || a.key.localeCompare(b.key));
}

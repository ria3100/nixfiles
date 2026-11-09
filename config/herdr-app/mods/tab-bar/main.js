import { View, div, svg, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { spaces, panes, run, openOverlay, closeOverlay, theme, window, shared, setShared, layout, settings, terminals, nextCommand, props, hc } from "herdr";
import { filesId, quitNvim, PREVIEW } from "./nvim.js";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

export default class Tabs extends View {
  init(_props, cx) {
    if (props()?.role === "confirm") { this.confirm = new Confirm(); this.confirm.init(cx); return; }
    this.pressed = null;
    this.panels = JSON.parse(localStorage.getItem("panels") ?? "{}");
    this.quitting = new Set();
    // cmd-w (keys.json: "tab-bar.close").
    cx.spawn(async () => { for (;;) if (await nextCommand() === "close") closeTab(this.quitting).catch(() => {}); });
  }

  // The side panel is remembered per space: switching shows that space's choice
  // (closed if it never had one), and opening or closing it records it.
  syncPanel(space, panel, body, enabled) {
    if (!space || !panel) return;
    const now = panel.hidden ? null : body?.active ?? null;
    if (space.id !== this.space) {
      const first = this.space === undefined;
      this.space = space.id; this.pending = null;
      if (!(first && !(space.id in this.panels))) {
        const stored = this.panels[space.id] ?? null, want = enabled.includes(stored) ? stored : null;
        if (want !== now) {
          this.pending = { want, until: Date.now() + 1000 };
          if (want) { run("layout.select", { stack: "panel-body", child: want }); run("layout.show", { id: "panel" }); }
          else run("layout.hide", { id: "panel" });
          return;
        }
      }
    }
    // Until the restore lands (or something else won), the old state isn't a choice.
    if (this.pending) {
      if (this.pending.want !== now && Date.now() < this.pending.until) return;
      this.pending = null;
    }
    if (this.panels[space.id] === now) return;
    this.panels[space.id] = now;
    localStorage.setItem("panels", JSON.stringify(this.panels));
  }

  // The dialog closed by Herdr (Esc, a layout switch) lets cmd-w through again.
  async close() {
    if (this.confirm) setShared(CONFIRMING, null);
  }

  render(cx) {
    if (this.confirm) return this.confirm.render(cx);
    const t = theme();
    const space = spaces().find(p => p.active);
    const shown = space?.tabs ?? [];
    const stop = (_e, cx) => cx.stop_propagation();
    const button = (id, label, action) => div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(6).text_color(t.dim).hover(s => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", stop).on_click(action).child(label);
    const item = (c, i) => {
      const { name, program, command, preview, dirty } = tabName(c);
      return h_flex().id(`tab-${c.id}`).h(29).px(10).gap(7).rounded(7).items_center().flex_none().text_size(12.8)
        .border(1).border_color(c.active ? t.border : t.chrome).bg(c.active ? t.raised : t.chrome).text_color(c.active ? t.foreground : t.muted)
        .hover(s => s.bg(t.hover))
        .on_mouse_down("left", (e, cx) => { cx.stop_propagation(); this.pressed = i; if (e.click_count === 2) run("tab.rename", { id: c.id }); })
        .on_mouse_up("left", () => {
          const from = this.pressed; this.pressed = null;
          if (from !== null && from !== i) run("tab.move", { id: shown[from].id, index: space.tabs.findIndex(x => x.id === c.id) + 1 });
          else run("tab.select", { id: c.id });
        })
        .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "menu", kind: "popup", width: 200, props: { tab: "tab", target: { id: c.id, space: space.id } } }); })
        .when(Boolean(program?.icon) && !command, el => el.child(program.tint ? svg(program.icon).size(14).text_color(t.muted) : image(program.icon).size(14)))
        .child(div().max_w(170).truncate().when(preview, el => el.font_family(".SystemUIFont").italic()).child(c.zoomed ? `${name} Z` : name))
        .when(dirty, el => el.child(div().size(7).flex_none().rounded(4).bg(c.active ? t.foreground : t.muted)))
        .when(c.status === "working", el => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900)))
        .when(c.status === "blocked" || c.status === "done", el => el.child(div().size(6).rounded(3).bg(t[c.status])))
        .when(c.active, el => el.child(div().id(`close-${c.id}`).text_color(t.dim).on_mouse_down("left", stop).on_click((_e, cx) => { cx.stop_propagation(); closeTab(this.quitting, c.id).catch(() => {}); }).child(svg("mods/pane/close.svg").size(12))));
    };
    const root = layout(), sidebar = find(root, "sidebar"), w = window();
    // Old saved rails and a dragged-narrow sidebar can be smaller than the window buttons.
    const lightsPadding = w?.platform === "macos" && w.titlebar === "none" && !w.fullscreen && root?.traffic_lights
      ? Math.max(10, (root.traffic_lights[0] + 64) / settings().zoom - (sidebar?.hidden ? 0 : sidebar?.size?.px ?? 0))
      : 10;
    const panel = find(root, "panel"), body = find(root, "panel-body");
    // Changes is shown under Files (layouts/my-main.json), not as a panel of its own.
    const enabled = [...(shared("workspace.panels") ?? ["files"]).filter(id => id !== "changes"), "graph"];
    this.syncPanel(space, panel, body, enabled);
    const panelButton = (id, label, icon) => {
      const on = panel && !panel.hidden && body?.active === id;
      return h_flex().id(`panel-${id}`).h(26).px(8).gap(5).flex_none().items_center().rounded(6)
        .text_size(12).bg(on ? t.selected : t.chrome).text_color(on ? t.foreground : t.muted)
        .hover(s => s.bg(t.hover)).on_mouse_down("left", stop)
        .on_click(() => {
          if (on) run("layout.hide", { id: "panel" });
          else { run("layout.select", { stack: "panel-body", child: id }); run("layout.show", { id: "panel" }); }
        }).child(svg(icon).size(14)).child(label);
    };
    return h_flex().size_full().min_w(0).px(10).pl(lightsPadding).gap(3).items_center().bg(t.chrome).border_b(1).border_color(t.border)
      .on_mouse_up("left", () => { this.pressed = null; })
      .on_scroll_wheel(e => { if (Math.abs(e.delta.y) >= 1) run(e.delta.y > 0 ? "tab.prev" : "tab.next"); })
      .child(h_flex().id("tab-scroll").flex_1().min_w(0).h_full().items_center().gap(3).overflow_x_scrollbar().children(shown.map(item)))
      .child(button("tab-new", "+", () => openOverlay({ mod: "new-menu", kind: "popup", width: 250, height: 512 })))
      .when(enabled.includes("files"), el => el.child(panelButton("files", "Files", "mods/files/file.svg")))
      .child(panelButton("graph", "Git", "mods/git-graph/icons/graph.svg"))
      .when(w?.buttons, el => el.child(button("minimize", w.platform === "windows" ? svg("mods/tab-bar/win-min.svg").size(16) : "−", () => run("window.minimize")))
        .child(button("maximize", w.platform === "windows" ? svg(`mods/tab-bar/${w.maximized ? "win-restore" : "win-max"}.svg`).size(16) : "□", () => run("window.maximize")))
        .child(button("close-window", w.platform === "windows" ? svg("mods/tab-bar/win-close.svg").size(16) : svg("mods/pane/close.svg").size(13), () => run("window.close"))));
  }
}

// What the tab bar calls a tab: its name if someone named it, else what runs in it.
function tabName(c) {
  const inTab = panes().filter(p => p.tab === c.id);
  const program = (inTab.find(p => p.program?.agent) ?? inTab.find(p => p.program && p.program.key !== "shell") ?? inTab[0])?.program;
  // A shell started as `zsh -c "nvim file; exec zsh"` (git-changes' open in editor) shows as the shell: name the command instead.
  const command = program?.key === "shell" ? launched(inTab.find(p => p.program === program)) : null;
  // A Files nvim (file-icons/nvim.js) titles itself "folder/file", marked while it is a preview: shown in
  // italics, in the system font since the UI font (Geist) has no italic face.
  const title = inTab.length === 1 && filesId(inTab[0]) ? inTab[0].title : null;
  const preview = Boolean(title?.startsWith(PREVIEW)), files = preview ? title.slice(PREVIEW.length) : title;
  // hydln: a tab whose only pane is an editor's preview is in italics too; one with unsaved changes in
  // an editor gets a dot after its name.
  const editorPreview = inTab.length === 1 && Boolean(inTab[0].editor?.preview);
  const dirty = inTab.some(p => p.editor?.dirty);
  return { name: c.named ? c.name : files || (command ?? program?.name ?? c.name), program, command, preview: (preview && !c.named) || editorPreview, dirty };
}

// The command a shell was started to run with -c, e.g. "nvim" from `zsh -l -c "nvim 'a.nix'; exec zsh -l"`.
function launched(pane) {
  const argv = terminals().find(t => t.address === pane?.terminal)?.argv ?? [];
  const i = argv.lastIndexOf("-c");
  const word = i >= 0 ? String(argv[i + 1] ?? "").trim().split(/[\s;]/)[0] : "";
  const base = word.split("/").pop();
  return base && !/^(\w*sh|exec)$/.test(base) ? base : null;
}

const CONFIRMING = "tab-bar.confirming";

// cmd-w, or a tab's close button (`id`; default: the shown tab). A Files nvim quits with
// `:confirm qall` (it asks about unsaved changes; its tab closes as it exits), a tab of shells
// doing nothing (and hydln's web panes and editors with nothing unsaved) closes, and anything else running asks first. While nvim or the dialog asks,
// closing that tab again does nothing.
async function closeTab(quitting, id = null) {
  const space = spaces().find(s => s.active), tab = space?.tabs.find(t => id ? t.id === id : t.active);
  if (!tab || quitting.has(tab.id)) return;
  const asking = shared(CONFIRMING);
  if (asking?.tab === tab.id && Date.now() - asking.at < 60000) return;
  const inTab = panes().filter(p => p.tab === tab.id);
  const nvim = inTab.length === 1 ? filesId(inTab[0]) : null;
  if (nvim) {
    quitting.add(tab.id);
    // nvim asks inside its tab: show it.
    if (!tab.active) run("tab.select", { id: tab.id });
    try { if (await quitNvim(nvim, space.machine ?? null)) return; }
    finally { quitting.delete(tab.id); }
  }
  const running = [];
  for (const pane of inTab) {
    // hydln: an editor pane with nothing unsaved closes as it is.
    if (pane.editor) { if (pane.editor.dirty) running.push(`${pane.title} (unsaved)`); continue; }
    // hydln: a web pane (a GitHub issue opened from github-issues, ...) closes as it is.
    if (pane.web) continue;
    if (!pane.terminal) { running.push(pane.title || pane.mod || "mod"); continue; }
    const got = await hc(["get", pane.terminal]).catch(() => null);
    const info = got?.code === 0 ? JSON.parse(got.stdout) : null;
    // A shell doing nothing is its own foreground process (a program started without a shell is too).
    if (!info?.pid || info.foreground?.pid !== info.pid || pane.program?.key !== "shell") running.push(info?.foreground?.name ?? pane.program?.name ?? "program");
  }
  if (!running.length) { run("tab.close", { id: tab.id }); return; }
  setShared(CONFIRMING, { tab: tab.id, at: Date.now() });
  openOverlay({ mod: "tab-bar", kind: "dialog", modal: true, width: 380, height: 160,
    props: { role: "confirm", tab: tab.id, name: tabName(tab).name, running: [...new Set(running)] } });
}

// The dialog closeTab opens. Only the Close button closes the tab: Enter and Esc cancel, so a
// repeated cmd-w or Enter can't close it.
class Confirm {
  init(cx) {
    this.handle = cx.focus_handle();
    this.handle.focus();
  }

  done(close) {
    const p = props();
    setShared(CONFIRMING, null);
    closeOverlay(p.overlay);
    if (close) run("tab.close", { id: p.tab });
  }

  render() {
    const t = theme(), p = props() ?? {};
    const button = (id, label, bg, fg, close) => h_flex().id(id).h(32).px(14).items_center().rounded(8).border_1()
      .border_color(close ? bg : t.input).bg(bg).text_color(fg).cursor_pointer().hover(s => s.opacity(0.88)).on_click(() => this.done(close)).child(label);
    return v_flex().id("close-tab").track_focus(this.handle).size_full().min_h(0).p(18).gap(12).bg(t.popover).text_size(13)
      .on_key_down((e, cx) => {
        if (e.key !== "enter" && e.key !== "escape") return;
        this.done(false);
        cx.stop_propagation();
      })
      .child(div().text_size(15).font_semibold().text_color(t.foreground).child(`Close ${p.name ?? "tab"}?`))
      .child(div().flex_1().min_h(0).text_color(t.muted).child(`Still running: ${(p.running ?? []).join(", ")}`))
      .child(h_flex().justify_end().gap(8).text_size(12)
        .child(button("no", "Cancel", t.raised, t.foreground, false))
        .child(button("yes", "Close", t.solid, t.solid_foreground, true)));
  }
}

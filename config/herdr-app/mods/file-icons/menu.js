// The right-click menu of a row, opened as a popup at the pointer with props
// { role: "menu", target: { abs, rel, name, dir, on } }. Styled like git-graph's menu.
import { div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay, notify, theme, run, exec, commands } from "herdr";

const ICON = name => `mods/file-icons/menu/${name}.svg`;
const ROW = 30, SEPARATOR = 9, PADDING = 10;
const ZED = "/Applications/Zed.app/Contents/MacOS/cli";

// hydln opens local files in its editor panes (editor.open); plain Herdr has no such command.
let editor = null;
// Remembered once seen: right after the app starts, commands() may not list it yet.
const hasEditor = () => editor ||= commands().some(c => c.name === "editor.open");

// As VS Code's Explorer: open (files), the three copies, then the folder actions.
export function menuItems(target) {
  const folder = target.dir ? target.abs : target.abs.slice(0, target.abs.lastIndexOf("/"));
  return [
    ...(target.dir || target.on || !hasEditor() ? [] : [{ label: "Open in Editor", icon: "file-text", action: { type: "editor" } }]),
    // Zed runs on this Mac: not for a space on another machine, nor in hydln (its own editor).
    ...(target.on || hasEditor() ? [] : [{ label: "Open in Zed", icon: "code", action: { type: "zed" } }]),
    // A line under the open items, when there is one.
    ...(target.on || (target.dir && hasEditor()) ? [] : [{ separator: true }]),
    { label: "Copy Path", icon: "copy", action: { type: "copy", text: target.abs } },
    { label: "Copy Relative Path", icon: "copy", action: { type: "copy", text: target.rel } },
    { label: "Copy Name", icon: "copy", action: { type: "copy", text: target.name } },
    { separator: true },
    ...(target.on ? [] : [{ label: "Reveal in Finder", icon: "folder", action: { type: "reveal" } }]),
    { label: "Open in Terminal", icon: "terminal", action: { type: "terminal", folder } },
  ];
}

export const menuHeight = items => PADDING + items.reduce((h, it) => h + (it.separator ? SEPARATOR : ROW), 0);

export class Menu {
  init(cx) {
    this.items = menuItems(props().target);
    this.at = -1;
    this.handle = cx.focus_handle();
    this.handle.focus();
  }

  choose(i, cx) {
    const it = this.items[i], { overlay, target } = props();
    if (!it || it.separator) return;
    const a = it.action;
    closeOverlay(overlay);
    if (a.type === "copy") {
      cx.write_to_clipboard(a.text);
      notify({ title: "Copied", body: a.text, level: "success", timeout: 2000 });
    } else if (a.type === "reveal") exec("open", ["-R", target.abs]).catch(() => {});
    else if (a.type === "terminal") run("tab.new", { folder: a.folder });
    // hydln: its editor pane (the one already editing the file, else a new tab).
    else if (a.type === "editor") run("editor.open", { path: target.abs });
    // Zed's CLI: a folder as the project; a file opened in the Files panel's folder as the project.
    else if (a.type === "zed") exec(ZED, target.dir ? [target.abs] : [target.root, target.abs]).catch(() => {});
  }

  move(step) {
    const n = this.items.length;
    for (let k = 1; k <= n; k++) {
      const i = (this.at + step * k + n * 2) % n;
      if (!this.items[i].separator) { this.at = i; return; }
    }
  }

  render(cx) {
    const t = theme();
    return v_flex().id("file-icons-menu").track_focus(this.handle).w_full().min_h(0).p(5).bg(t.popover).text_size(12.8)
      .on_key_down((e, cx) => {
        if (e.key === "down") this.move(1);
        else if (e.key === "up") this.move(-1);
        else if (e.key === "enter") this.choose(this.at, cx);
        else if (e.key === "escape") closeOverlay(props().overlay);
        else return;
        cx.stop_propagation();
        cx.notify();
      })
      .children(this.items.map((it, i) => it.separator
        ? div().mx(7).my(4).h(1).flex_none().bg(t.border)
        : h_flex().id(`fm-${i}`).h(ROW).flex_none().px(8).gap(9).rounded(7).items_center().cursor_pointer().text_color(t.foreground)
          .when(i === this.at, el => el.bg(t.selected)).hover(s => s.bg(t.hover))
          .on_click((_e, cx) => this.choose(i, cx))
          .child(svg(ICON(it.icon)).size(14).flex_none().text_color(t.muted))
          .child(div().flex_1().min_w(0).truncate().child(it.label))));
  }
}

// Claude Code status, from the data that statusline.sh keeps. One mod, two parts,
// picked with props().part: "limits" (the subscription limits, for a sidebar) and
// "session" (the Claude Code session in the shown tab, for a side panel).
import { View } from "gpui-kit";
import { props } from "herdr";
import Limits from "./limits.js";
import Session from "./session.js";

export default class ClaudeStatus extends View {
  init(_props, cx) {
    const p = props() ?? {};
    this.part = p.part === "session" ? new Session(p) : new Limits();
    this.part.init(cx);
  }

  render(cx) {
    return this.part.render(cx);
  }
}

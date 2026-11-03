// A clock for the status bar: "11/03 Tue 14:52:07". Redraws when the second changes.
import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme } from "herdr";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n) => String(n).padStart(2, "0");
const now = () => {
  const d = new Date();
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${DAYS[d.getDay()]} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export default class Clock extends View {
  init(_props, cx) {
    this.text = now();
    // Check often so the change lands within 0.1s of the real second; redraw only on change.
    cx.timer.every(100, (cx) => {
      const text = now();
      if (text !== this.text) { this.text = text; cx.notify(); }
    });
  }

  render() {
    const t = theme();
    return h_flex().size_full().px(14).items_center().justify_end()
      .bg(t.chrome).border_t(1).border_color(t.border)
      .text_size(11.8).text_color(t.muted).font_family("JetBrains Mono")
      .child(div().child(this.text));
  }
}

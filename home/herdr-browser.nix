{ lib, pkgs, inputs, ... }:

# herdr-browser: 専用プロファイルの Chromium を CDP で操作する CLI。
# エージェントが `herdr-browser open/snapshot/click` でページを開いて操作する。
# https://github.com/Abrahamism/herdr-browser （flake.lock でコミットを固定）
#
# - CLI: ソースを flake input から取り、Node で動かすラッパーを PATH に置く
# - スキル: ~/.claude/skills/herdr-browser（手順をエージェントに教える）
# - TUI 版 herdr 向けのプラグイン部分（herdr-plugin.toml）は GUI 版では使わない
let
  herdr-browser = pkgs.writeShellScriptBin "herdr-browser" ''
    exec ${pkgs.nodejs_22}/bin/node ${inputs.herdr-browser}/bin/herdr-browser.mjs "$@"
  '';
in
{
  home.packages = [ herdr-browser ];

  home.file.".claude/skills/herdr-browser/SKILL.md".source = ../config/claude/skills/herdr-browser/SKILL.md;

  # 既定は Brave だが入れていないので Chrome を使う。CLI が自分でも書き込むファイルなので、
  # 無ければリポジトリの内容をコピーするだけにする（Cursor の settings.json と同じ）。
  home.activation.seedHerdrBrowserConfig = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
    target="$HOME/Library/Application Support/herdr-browser/config.json"
    if [ ! -e "$target" ]; then
      mkdir -p "$(dirname "$target")"
      install -m 644 ${../config/herdr-browser/config.json} "$target"
    fi
  '';
}

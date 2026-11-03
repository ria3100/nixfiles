{ config, lib, ... }:

# Herdr (herdr-app) の設定と mod。
#
# Herdr は自分でもこれらのファイルに書き込む（設定画面やテーマ変更で
# settings.json・レイアウトを、起動のたびに各 mod フォルダへ
# gpui-kit.d.ts / herdr.d.ts / jsconfig.json を）。
# Nix ストアへの symlink だと読み取り専用で失敗するため、
# mkOutOfStoreSymlink でリポジトリの実ファイルへ直接リンクする。
# Herdr 上での変更はそのまま config/herdr-app/ の差分になる。
#
# AGENTS.md・*.d.ts・frame/・icons/・同梱の mod とレイアウト
# （main / terminals / win98 など）は Herdr が毎回書き直すので管理しない。
let
  repo = "${config.home.homeDirectory}/nixfiles/config/herdr-app";
  link = path: config.lib.file.mkOutOfStoreSymlink "${repo}/${path}";

  files = [
    "settings.json"
    "keys.json"
    "layouts/my-main.json"
  ];

  mods = [
    "clock"
    "tabs-graph"
    "git-graph"
    "file-icons"
    "machine-vitals"
    "claude-status"
  ];
in
{
  xdg.configFile =
    lib.genAttrs (map (f: "herdr-app/${f}") files) (name: {
      source = link (lib.removePrefix "herdr-app/" name);
    })
    // lib.genAttrs (map (m: "herdr-app/mods/${m}") mods) (name: {
      source = link (lib.removePrefix "herdr-app/" name);
    });
}

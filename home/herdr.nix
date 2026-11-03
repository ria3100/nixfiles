{ config, lib, pkgs, ... }:

# Herdr (herdr-app) の設定と mod。
#
# 設定とレイアウト: Herdr は自分でも書き込む（設定画面やテーマ変更で
# settings.json・レイアウトを）。Nix ストアへの symlink だと読み取り専用で
# 失敗するため、mkOutOfStoreSymlink でリポジトリの実ファイルへ直接リンクする。
# Herdr 上での変更はそのまま config/herdr-app/ の差分になる。
#
# mod: Herdr は symlink 越しの mod フォルダから JS は読めるが、SVG や画像は
# 読み込まない（アイコンが消える）。そのため switch のたびにリポジトリから
# 実フォルダへコピーする。mod を直すときはリポジトリを編集して switch する。
# Herdr が起動のたびに書き込む *.d.ts / jsconfig.json はコピー先に残す。
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
    "dev-ports"
    "spaces-ports"
  ];
in
{
  xdg.configFile = lib.genAttrs (map (f: "herdr-app/${f}") files) (name: {
    source = link (lib.removePrefix "herdr-app/" name);
  });

  home.activation.syncHerdrMods = lib.hm.dag.entryAfter [ "linkGeneration" ] ''
    mods_dir="${config.xdg.configHome}/herdr-app/mods"
    mkdir -p "$mods_dir"
    for mod in ${lib.escapeShellArgs mods}; do
      target="$mods_dir/$mod"
      # 旧構成（symlink）が残っていれば実フォルダへ置き換える
      if [ -L "$target" ]; then
        rm -f "$target"
      fi
      run ${pkgs.rsync}/bin/rsync -a --delete \
        --exclude 'gpui-kit.d.ts' --exclude 'herdr.d.ts' \
        --exclude 'jsconfig.json' --exclude '*.error' \
        "${repo}/mods/$mod/" "$target/"
    done
  '';
}

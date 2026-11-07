{ config, ... }:

# Zed の設定。Zed は設定画面やテーマ切り替えで settings.json に書き込むため、
# Nix ストアへの symlink（読み取り専用）ではなく mkOutOfStoreSymlink で
# リポジトリの実ファイルへ直接リンクする。Zed 上での変更は config/zed/ の差分になる。
# themes/ などほかのファイルは管理しない。
{
  xdg.configFile."zed/settings.json".source =
    config.lib.file.mkOutOfStoreSymlink "${config.home.homeDirectory}/nixfiles/config/zed/settings.json";
}

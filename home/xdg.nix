{ lib, ... }:

{
  xdg.configFile = {
    "ghostty/config".source = ../config/ghostty/config;
    "zellij/config.kdl".source = ../config/zellij/config.kdl;
    "yazi/yazi.toml".source = ../config/yazi/yazi.toml;
    "yazi/theme.toml".source = ../config/yazi/theme.toml;
    "yazi/init.lua".source = ../config/yazi/init.lua;
    "karabiner/karabiner.json".source = ../config/karabiner/karabiner.json;
    "starship.toml".source = ../config/starship.toml;
    "nvim" = {
      source = ../config/nvim;
      recursive = true;
    };
  };

  home.file = {
    ".vimrc".text = ''
      set nowrap
      set number
      set noswapfile
    '';

    # Custom scripts
    ".local/bin/gf" = {
      source = ../config/scripts/gf;
      executable = true;
    };
    ".local/bin/gf-list" = {
      source = ../config/scripts/gf-list;
      executable = true;
    };
    ".local/bin/nvim-remote" = {
      source = ../config/scripts/nvim-remote;
      executable = true;
    };

    # Claude
    ".claude/CLAUDE.md".source = ../config/claude/CLAUDE.md;

    # Codex
    ".codex/AGENTS.md".source = ../config/codex/AGENTS.md;

    # Cursor
    # settings.json は home.file で管理しない（下の activation を参照）
    "Library/Application Support/Cursor/User/keybindings.json".source = ../config/cursor/keybindings.json;
  };

  # Cursor はアップデート時に settings.json へ既定値を書き戻す。
  # Nix ストアへの symlink だと読み取り専用で書き込みに失敗し、
  # 起動のたびに同じ差分と保存エラーが出続けるため、実ファイルとして配置する。
  #
  # 「存在しなければリポジトリの内容をコピーする」挙動なので、
  # config/cursor/settings.json は初期値（シード）という位置づけになる。
  # 手元の変更をリポジトリへ戻したい場合は実ファイルを cp してコミットする。
  home.activation.seedCursorSettings = lib.hm.dag.entryAfter [ "linkGeneration" ] ''
    target="$HOME/Library/Application Support/Cursor/User/settings.json"

    # 旧構成（Nix ストアへの symlink）が残っていれば実ファイルへ置き換える
    if [ -L "$target" ]; then
      rm -f "$target"
    fi

    if [ ! -e "$target" ]; then
      mkdir -p "$(dirname "$target")"
      install -m 644 ${../config/cursor/settings.json} "$target"
    fi
  '';
}

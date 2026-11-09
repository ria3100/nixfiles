{ lib, ... }:

{
  xdg.configFile = {
    "ghostty/config".source = ../config/ghostty/config;
    "zellij/config.kdl".source = ../config/zellij/config.kdl;
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

  # Karabiner の F1 / F2 から呼ぶ明るさ調整コマンド（config/karabiner/brightness.swift）。
  # Command Line Tools の swiftc でビルドし、ソースが変わったときだけビルドし直す。
  home.activation.buildDisplayBrightness = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
    src=${../config/karabiner/brightness.swift}
    out="$HOME/.local/bin/display-brightness"
    if [ ! -x "$out" ] || [ "$(cat "$out.src" 2>/dev/null)" != "$src" ]; then
      run mkdir -p "$HOME/.local/bin"
      run /usr/bin/swiftc -O "$src" -o "$out"
      run sh -c 'echo "$1" > "$2"' sh "$src" "$out.src"
    fi
  '';
}

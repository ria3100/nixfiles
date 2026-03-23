{ ... }:

{
  xdg.configFile = {
    "ghostty/config".source = ../config/ghostty/config;
    "zellij/config.kdl".source = ../config/zellij/config.kdl;
    "yazi/yazi.toml".source = ../config/yazi/yazi.toml;
    "yazi/theme.toml".source = ../config/yazi/theme.toml;
    "yazi/init.lua".source = ../config/yazi/init.lua;
    "karabiner/karabiner.json".source = ../config/karabiner/karabiner.json;
    "mise/config.toml".source = ../config/mise/config.toml;
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
    ".claude/settings.json".source = ../config/claude/settings.json;
    ".claude/CLAUDE.md".source = ../config/claude/CLAUDE.md;

    # Codex
    ".codex/AGENTS.md".source = ../config/codex/AGENTS.md;

    # Cursor
    "Library/Application Support/Cursor/User/settings.json".source = ../config/cursor/settings.json;
    "Library/Application Support/Cursor/User/keybindings.json".source = ../config/cursor/keybindings.json;
  };
}

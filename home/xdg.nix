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

  home.file.".vimrc".text = ''
    set nowrap
    set number
    set noswapfile
  '';
}

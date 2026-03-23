{ pkgs, ... }:

{
  home.packages = with pkgs; [
    # Core
    git
    gh
    jq
    tree
    wget
    fd
    ripgrep
    bat
    eza
    fzf
    zoxide
    direnv

    # Shell
    starship
    zsh-completions
    zellij

    # Editor
    neovim
    yazi

    # Git
    tig
    jj

    # Dev tools
    mise
    uv
    rustup
    wasm-pack
    cargo-watch

    # Infra
    cloudflared
  ];
}

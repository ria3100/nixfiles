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
    sheldon
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
    chezmoi
    rustup
    wasm-pack
    cargo-watch

    # Infra
    cloudflared
  ];
}

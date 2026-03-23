{ pkgs, lib, ... }:

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

    # Runtimes
    nodejs_22
    pnpm
    python312

    # Dev tools
    uv
    rustup
    wasm-pack
    cargo-watch

    # Infra
    cloudflared
  ];

  home.activation.installGlobalNpmPackages = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
    export PNPM_HOME="$HOME/Library/pnpm"
    export PATH="$PNPM_HOME:$PATH"
    ${pkgs.pnpm}/bin/pnpm add -g vite-plus
  '';
}

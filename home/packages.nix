{ pkgs, ... }:

let
  vite-plus = pkgs.stdenv.mkDerivation {
    pname = "vite-plus";
    version = "0.1.13";
    src = pkgs.fetchurl {
      url = "https://registry.npmjs.org/@voidzero-dev/vite-plus-cli-darwin-arm64/-/vite-plus-cli-darwin-arm64-0.1.13.tgz";
      sha256 = "sha256-p6gVBCvS1cZSMLuzwYVQ9qHyIhmuvuk+fR/vLu7zBC8=";
    };
    sourceRoot = ".";
    unpackPhase = ''
      tar xzf $src
    '';
    installPhase = ''
      mkdir -p $out/bin
      cp package/vp $out/bin/vp
      chmod +x $out/bin/vp
    '';
  };
in
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
    vite-plus

    # Infra
    cloudflared
  ];
}

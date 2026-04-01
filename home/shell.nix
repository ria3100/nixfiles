{ pkgs, ... }:

{
  programs.zsh = {
    enable = true;

    envExtra = ''
      [[ -f /opt/homebrew/bin/brew ]] && eval "$(/opt/homebrew/bin/brew shellenv)"
      [[ -f "$HOME/.cargo/env" ]] && . "$HOME/.cargo/env"
    '';

    initContent = ''
      # PATH
      export PATH="$HOME/Library/pnpm:$HOME/.local/bin:$HOME/.antigravity/antigravity/bin:/Applications/Codex.app/Contents/Resources:$PATH"

      # Secrets
      [[ -f "$HOME/.secrets" ]] && source "$HOME/.secrets"

      # メール通知を無効化
      unset MAILCHECK

      # Zellij with random star name
      zj() {
        local stars=(
          "Sirius" "Vega" "Altair" "Deneb" "Rigel"
          "Betelgeuse" "Antares" "Spica" "Pollux" "Canopus"
          "Arcturus" "Capella" "Aldebaran" "Regulus" "Castor"
          "Fomalhaut" "Achernar" "Procyon" "Bellatrix" "Polaris"
          "Mira" "Algol" "Atlas" "Electra" "Merope"
        )
        local name=''${stars[$RANDOM % ''${#stars[@]} + 1]}
        zellij attach "$name" 2>/dev/null || zellij -s "$name" "$@"
      }

    '';

    shellAliases = {
      vim = "nvim --listen /tmp/nvim.sock";
      nvim = "nvim --listen /tmp/nvim.sock";
      ls = "eza";
      yazi = "yazi --client-id 1";
      codex = "codex --sandbox danger-full-access";
    };

    plugins = [
      {
        name = "base16-shell";
        src = pkgs.fetchFromGitHub {
          owner = "tinted-theming";
          repo = "base16-shell";
          rev = "f0aeff4ae264e72c8dc1315881f204c229e13eec";
          sha256 = "sha256-Sr4GRbczqQXN/WJDkpwqxpqe10HKPYcvTaXVF30XvEs=";
        };
      }
      {
        name = "zsh-autosuggestions";
        src = pkgs.fetchFromGitHub {
          owner = "zsh-users";
          repo = "zsh-autosuggestions";
          rev = "v0.7.1";
          sha256 = "sha256-vpTyYq9ZgfgdDsWzjxVAE7FZH4MALMNZIFyEOBLm5Qo=";
        };
      }
      {
        name = "zsh-syntax-highlighting";
        src = pkgs.fetchFromGitHub {
          owner = "zsh-users";
          repo = "zsh-syntax-highlighting";
          rev = "0.8.0";
          sha256 = "sha256-iJdWopZwHpSyYl5/FQXEW7gl/SrKaYDEtTH9cGP7iPo=";
        };
      }
    ];
  };

  programs.starship = {
    enable = true;
    enableZshIntegration = true;
  };

  programs.zoxide = {
    enable = true;
    enableZshIntegration = true;
  };

  programs.direnv = {
    enable = true;
    enableZshIntegration = true;
    nix-direnv.enable = true;
    config.global.hide_env_diff = true;
  };

  home.sessionVariables = {
    EDITOR = "nvim";
    NPM_TOKEN = "";
    PNPM_HOME = "$HOME/Library/pnpm";
  };
}

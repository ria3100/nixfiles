{ config, lib, pkgs, ... }:

let
  # starship / zoxide / direnv の初期化スクリプトはビルド時に生成し、起動時は読むだけにする
  # （毎回 `eval "$(starship init zsh)"` などでコマンドを起動しない）
  initScript = name: command: pkgs.runCommand "${name}-init.zsh" { } ''
    HOME=$TMPDIR ${command} > $out
  '';
  starshipInit = initScript "starship" "${config.programs.starship.package}/bin/starship init zsh --print-full-init";
  zoxideInit = initScript "zoxide" "${config.programs.zoxide.package}/bin/zoxide init zsh";
  direnvInit = initScript "direnv" "${config.programs.direnv.package}/bin/direnv hook zsh";
in
{
  programs.zsh = {
    enable = true;

    # 補完の安全確認（compaudit）と .zcompdump の作り直しは、.zcompdump が 24 時間より古いときだけ。
    # switch で消すので（下の activation）、新しく入れたコマンドの補完はすぐ使える
    completionInit = ''
      autoload -U compinit
      zcompdump_old=(''${ZDOTDIR:-$HOME}/.zcompdump(N.mh+24))
      if (( $#zcompdump_old )); then
        compinit
      else
        compinit -C
      fi
      unset zcompdump_old
    '';

    # `brew shellenv` の出力と同じ内容を直接書く（zsh を起動するたびに brew を起動しない）。
    # FPATH は export しない: 子の zsh で fpath が重複するため
    envExtra = ''
      typeset -U path fpath
      if [[ -d /opt/homebrew ]]; then
        export HOMEBREW_PREFIX=/opt/homebrew HOMEBREW_CELLAR=/opt/homebrew/Cellar HOMEBREW_REPOSITORY=/opt/homebrew
        path=(/opt/homebrew/bin /opt/homebrew/sbin $path)
        fpath=(/opt/homebrew/share/zsh/site-functions $fpath)
        [[ -n ''${MANPATH-} ]] && export MANPATH=":''${MANPATH#:}"
        export INFOPATH="/opt/homebrew/share/info:''${INFOPATH:-}"
      fi
      [[ -f "$HOME/.cargo/env" ]] && . "$HOME/.cargo/env"
    '';

    initContent = lib.mkMerge [
      (lib.mkOrder 2000 ''
        if [[ $TERM != "dumb" ]]; then
          source ${starshipInit}
        fi
        source ${zoxideInit}
        source ${direnvInit}
      '')
      ''
      # PATH
      export PATH="$HOME/Library/pnpm/bin:$HOME/Library/pnpm:$HOME/.local/bin:$HOME/.antigravity/antigravity/bin:$PATH"

      # Secrets（NPM_TOKEN など。実値は git 管理外の ~/.secrets に置く）
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

      # プロジェクトに vite-plus があればそちらの vp を使う（グローバル版とのバージョン不一致を避ける）
      vp() {
        local d=$PWD
        while [[ $d != / ]]; do
          [[ -x $d/node_modules/.bin/vp ]] && { "$d/node_modules/.bin/vp" "$@"; return }
          d=''${d:h}
        done
        command vp "$@"
      }
    ''
    ];

    shellAliases = {
      vim = "nvim";
      ls = "eza";
      codex = "codex --sandbox danger-full-access";
    };

    plugins = [
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

  # zsh への組み込みは上の initContent（ビルド時に生成したスクリプト）で行う
  programs.starship = {
    enable = true;
    enableZshIntegration = false;
  };

  programs.zoxide = {
    enable = true;
    enableZshIntegration = false;
  };

  programs.direnv = {
    enable = true;
    enableZshIntegration = false;
    nix-direnv.enable = true;
    config.global.hide_env_diff = true;
  };

  home.activation.resetZcompdump = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
    run rm -f "$HOME/.zcompdump"
  '';

  home.sessionVariables = {
    EDITOR = "nvim";
    PNPM_HOME = "$HOME/Library/pnpm";
  };
}

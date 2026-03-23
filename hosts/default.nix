{ pkgs, ... }:

{
  # Nix is managed by Determinate installer
  nix.enable = false;

  # Allow unfree packages
  nixpkgs.config.allowUnfree = true;

  # System-level packages
  environment.systemPackages = [ ];

  # Homebrew (Cask / mas only)
  homebrew = {
    enable = true;
    onActivation = {
      autoUpdate = true;
      cleanup = "zap";
    };

    casks = [
      "chatgpt"
      "claude-code"
      "codex"
      "codex-app"
      "cursor"
      "discord"
      "elgato-wave-link"
      "figma"
      "ghostty"
      "google-chrome"
      "azookey"
      "karabiner-elements"
      "nani"
      "notion"
      "obs"
      "raycast"
      "slack"
      "zed"
      "zen"

      # Fonts
      "font-jetbrains-mono"
      "font-jetbrains-mono-nerd-font"
      "font-udev-gothic"
      "font-udev-gothic-nf"
    ];

    masApps = {
      Amphetamine = 937984704;
    };
  };

  # macOS system settings
  security.pam.services.sudo_local.touchIdAuth = true;

  system.defaults = {
    NSGlobalDomain = {
      AppleInterfaceStyle = "Dark";
      KeyRepeat = 2;
      InitialKeyRepeat = 25;
      ApplePressAndHoldEnabled = false;
      NSAutomaticCapitalizationEnabled = false;
      NSAutomaticQuoteSubstitutionEnabled = false;
      NSAutomaticDashSubstitutionEnabled = false;
      NSAutomaticSpellingCorrectionEnabled = false;
      AppleShowAllExtensions = true;
    };

    dock = {
      autohide = true;
      tilesize = 43;
      show-recents = false;
      mru-spaces = false;
    };

    finder = {
      AppleShowAllFiles = true;
      FXPreferredViewStyle = "Nlsv";
      NewWindowTarget = "Home";
      ShowPathbar = true;
      ShowStatusBar = true;
    };

    trackpad = {
      Clicking = true;
    };

    screencapture = {
      location = "~/Pictures";
    };

    WindowManager = {
      GloballyEnabled = false;
      EnableStandardClickToShowDesktop = false;
    };
  };

  # macOS defaults not covered by system.defaults module
  system.activationScripts.postActivation.text = ''
    # Finder
    defaults write com.apple.finder WarnOnEmptyTrash -bool false

    # Input
    defaults write NSGlobalDomain WebAutomaticSpellingCorrectionEnabled -bool false

    # Menu bar clock
    defaults write com.apple.menuextra.clock ShowSeconds -bool true

    # Safari
    defaults write com.apple.Safari IncludeDevelopMenu -bool true 2>/dev/null || true
    defaults write com.apple.Safari WebKitDeveloperExtrasEnabledPreferenceKey -bool true 2>/dev/null || true

    # Google Chrome: disable "Email Link" and "Print" shortcuts
    defaults write com.google.Chrome NSUserKeyEquivalents -dict \
      "リンクをメールで送信" "@\$p" \
      "印刷..." "@\$p"

    # azooKey
    defaults write dev.ensan.inputmethod.azooKeyMac "dev.ensan.inputmethod.azooKeyMac.preference.enableLiveConversion" -bool true
    defaults write dev.ensan.inputmethod.azooKeyMac "dev.ensan.inputmethod.azooKeyMac.preference.enableZenzai" -bool true
    defaults write dev.ensan.inputmethod.azooKeyMac "dev.ensan.inputmethod.azooKeyMac.preference.typeHalfSpace" -bool true
    defaults write dev.ensan.inputmethod.azooKeyMac "dev.ensan.inputmethod.azooKeyMac.preference.zenzaiInferenceLimit" -int 1

    # Amphetamine
    defaults write com.if.Amphetamine "Hide Dock Icon" -bool true
    defaults write com.if.Amphetamine "Start Session At Launch" -bool true
    defaults write com.if.Amphetamine "Allow Display Sleep" -bool false
    defaults write com.if.Amphetamine "Allow Screen Saver" -bool false
    defaults write com.if.Amphetamine "Icon Style" -int 6
    defaults write com.if.Amphetamine "Lower Icon Opacity" -bool true
    defaults write com.if.Amphetamine "Show Welcome Window" -bool false

    # Dev tools setup
    if command -v ya &>/dev/null; then
      sudo -u ria ya pkg add yazi-rs/plugins:git 2>/dev/null || true
      sudo -u ria ya pkg add yazi-rs/plugins:no-status 2>/dev/null || true
      sudo -u ria ya pkg add sanjinso/monokai-vibrant 2>/dev/null || true
    fi

    if command -v npm &>/dev/null; then
      sudo -u ria npm i -g oxlint oxfmt 2>&1 || true
    fi

    if command -v rustup &>/dev/null; then
      sudo -u ria rustup default stable 2>&1 || true
      sudo -u ria rustup target add wasm32-unknown-unknown 2>&1 || true
    fi

    # SSH keys from Keychain
    SSH_DIR="/Users/ria/.ssh"
    mkdir -p "$SSH_DIR"
    SSH_PRIV=$(sudo -u ria security find-generic-password -s "ssh-id_ed25519_github" -a "ria" -w 2>/dev/null || echo "")
    SSH_PUB=$(sudo -u ria security find-generic-password -s "ssh-id_ed25519_github-pub" -a "ria" -w 2>/dev/null || echo "")
    if [ -n "$SSH_PRIV" ] && [ ! -f "$SSH_DIR/id_ed25519_github" ]; then
      echo "$SSH_PRIV" > "$SSH_DIR/id_ed25519_github"
      chmod 600 "$SSH_DIR/id_ed25519_github"
      chown ria "$SSH_DIR/id_ed25519_github"
    fi
    if [ -n "$SSH_PUB" ] && [ ! -f "$SSH_DIR/id_ed25519_github.pub" ]; then
      echo "$SSH_PUB" > "$SSH_DIR/id_ed25519_github.pub"
      chmod 644 "$SSH_DIR/id_ed25519_github.pub"
      chown ria "$SSH_DIR/id_ed25519_github.pub"
    fi

    # Generate .secrets from Keychain
    SECRETS="/Users/ria/.secrets"
    true > "$SECRETS"
    for secret_name in NPM_TOKEN CLAUDE_CODE_OAUTH_TOKEN FIGMA_OAUTH_TOKEN; do
      val=$(sudo -u ria security find-generic-password -s "secret-$secret_name" -a "ria" -w 2>/dev/null || echo "")
      [ -n "$val" ] && echo "export $secret_name=\"$val\"" >> "$SECRETS"
    done
    chown ria "$SECRETS"
    chmod 600 "$SECRETS"

    # Generate .npmrc from Keychain
    GITHUB_TOKEN=$(sudo -u ria security find-generic-password -s "npm-github-packages" -a "ria" -w 2>/dev/null || echo "")
    NPM_TOKEN=$(sudo -u ria security find-generic-password -s "npm-registry" -a "ria" -w 2>/dev/null || echo "")
    if [ -n "$GITHUB_TOKEN" ] || [ -n "$NPM_TOKEN" ]; then
      NPMRC="/Users/ria/.npmrc"
      true > "$NPMRC"
      [ -n "$GITHUB_TOKEN" ] && echo "//npm.pkg.github.com/:_authToken=$GITHUB_TOKEN" >> "$NPMRC"
      [ -n "$NPM_TOKEN" ] && echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" >> "$NPMRC"
      chown ria "$NPMRC"
      chmod 600 "$NPMRC"
    fi
  '';

  # Primary user (required for homebrew, etc.)
  system.primaryUser = "ria";

  # Used for backwards compatibility
  system.stateVersion = 6;

  # The platform the configuration will be used on
  nixpkgs.hostPlatform = "aarch64-darwin";

  # User
  users.users.ria = {
    name = "ria";
    home = "/Users/ria";
  };
}

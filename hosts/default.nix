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

{ pkgs, ... }:

{
  imports = [
    ./packages.nix
  ];

  home.stateVersion = "25.05";

  programs.home-manager.enable = true;
}

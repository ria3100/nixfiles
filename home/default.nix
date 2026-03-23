{ pkgs, ... }:

{
  imports = [
    ./packages.nix
    ./git.nix
    ./shell.nix
    ./ssh.nix
    ./xdg.nix
  ];

  home.stateVersion = "25.05";

  programs.home-manager.enable = true;
}

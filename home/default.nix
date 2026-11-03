{ pkgs, ... }:

{
  imports = [
    ./packages.nix
    ./git.nix
    ./shell.nix
    ./ssh.nix
    ./xdg.nix
    ./herdr.nix
  ];

  home.stateVersion = "25.05";

  programs.home-manager.enable = true;
}

{
  description = "ria's nix-darwin + home-manager configuration";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";

    nix-darwin = {
      url = "github:LnL7/nix-darwin/master";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    # Chromium を CDP で操作する CLI（home/herdr-browser.nix）。flake ではないのでソースだけ取る
    herdr-browser = {
      url = "github:Abrahamism/herdr-browser";
      flake = false;
    };
  };

  outputs = inputs@{ nixpkgs, nix-darwin, home-manager, ... }: {
    darwinConfigurations."rias-MacBook-Pro-N7LC95WKMG" = nix-darwin.lib.darwinSystem {
      system = "aarch64-darwin";
      modules = [
        ./hosts/default.nix
        home-manager.darwinModules.home-manager
        {
          home-manager.useGlobalPkgs = true;
          home-manager.useUserPackages = true;
          home-manager.backupFileExtension = "bak";
          home-manager.extraSpecialArgs = { inherit inputs; };
          home-manager.users.ria = import ./home;
        }
      ];
    };
  };
}

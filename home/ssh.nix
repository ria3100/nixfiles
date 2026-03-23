{ ... }:

{
  programs.ssh = {
    enable = true;
    enableDefaultConfig = false;

    matchBlocks = {
      "github.com" = {
        identityFile = "~/.ssh/id_ed25519_github";
        user = "git";
      };
      "*" = {
        extraOptions = {
          UseKeychain = "yes";
          AddKeysToAgent = "yes";
          IdentitiesOnly = "yes";
        };
      };
    };
  };

  home.file.".ssh/allowed_signers".text = ''
    ria000130@gmail.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIP2Ft+vsxOM4fQMp2qEodjZJzPh0XLPM1yp7zXFzSYQH rias-MacBook-Pro-N7LC95WKMG
  '';
}

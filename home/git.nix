{ ... }:

{
  programs.git = {
    enable = true;

    signing = {
      key = "~/.ssh/id_ed25519_github.pub";
      signByDefault = true;
      format = "ssh";
    };

    settings = {
      user = {
        name = "Ria";
        email = "ria000130@gmail.com";
      };
      gpg.ssh.allowedSignersFile = "~/.ssh/allowed_signers";
      core.editor = ''nvim -c "set fenc=utf-8"'';
      init.defaultBranch = "main";
      pull.rebase = true;
      push.autoSetupRemote = true;
      rerere.enabled = true;
      diff.algorithm = "histogram";
      merge.conflictstyle = "zdiff3";
      fetch.prune = true;
      alias = {
        co = "checkout";
        st = "status";
        br = "branch";
        sw = "switch";
        lg = "log --oneline --graph";
      };
    };

    ignores = [
      ".DS_Store"
      ".idea/"
      "node_modules/"
      ".envrc"
      ".claude/settings.local.json"
      ".mcp.json"
    ];
  };
}

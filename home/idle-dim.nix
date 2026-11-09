{ config, lib, ... }:

# idle-dim: 動いている間は画面ロックさせず（Amphetamine の代わり）、
# 一定時間（既定 30 分）操作がなければ画面の明るさを最低にし、操作で元に戻す常駐プログラム。
# ソースは config/idle-dim/idle-dim.swift。ログイン時に LaunchAgent で起動する。
# 暗くするまでの時間は config/idle-dim/config.json（dimAfterMinutes）。リポジトリの実ファイルへ直接
# リンクするので、編集すれば switch なしで効く。
let
  bin = "${config.home.homeDirectory}/.local/bin/idle-dim";
  label = "org.nix-community.home.idle-dim";
in
{
  # Built with the system swiftc (like display-brightness), before the LaunchAgent is set up;
  # a rebuilt binary restarts the running agent.
  home.activation.buildIdleDim = lib.hm.dag.entryBetween [ "setupLaunchAgents" ] [ "writeBoundary" ] ''
    src=${../config/idle-dim/idle-dim.swift}
    out="${bin}"
    if [ ! -x "$out" ] || [ "$(cat "$out.src" 2>/dev/null)" != "$src" ]; then
      run mkdir -p "$(dirname "$out")"
      run /usr/bin/swiftc -O "$src" -o "$out"
      run sh -c 'echo "$1" > "$2"' sh "$src" "$out.src"
      run /bin/launchctl kickstart -k "gui/$(id -u)/${label}" 2>/dev/null || true
    fi
  '';

  xdg.configFile."idle-dim/config.json".source =
    config.lib.file.mkOutOfStoreSymlink "${config.home.homeDirectory}/nixfiles/config/idle-dim/config.json";

  launchd.agents.idle-dim = {
    enable = true;
    config = {
      ProgramArguments = [ bin ];
      RunAtLoad = true;
      KeepAlive = true;
      ProcessType = "Interactive";
      StandardErrorPath = "${config.home.homeDirectory}/Library/Logs/idle-dim.log";
    };
  };
}

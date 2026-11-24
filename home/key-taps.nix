{ config, lib, ... }:

# key-taps: 修飾キーの単押しに動作を割り当てる常駐プログラム（Karabiner の代わり）。
#   左 Command → 英数、右 Command → かな、右 Option → Herdr と直前のアプリを行き来する
# ソースは config/key-taps/main.swift。~/Applications/KeyTaps.app にビルドし、ログイン時に LaunchAgent で起動する。
# キー入力を書き換えるため「アクセシビリティ」の許可が要る。macOS はこの許可を署名に結び付けるので、
# ログインキーチェーンの自己署名証明書「KeyTaps Local Signing」で署名し、ビルドし直しても許可が残るようにする
# （作り方は ~/app/slack-command/README.md の DayTrigger の証明書と同じで、CN だけ変える）。
# 証明書がなければ ad-hoc 署名になり、ビルドのたびに許可を取り直すことになる。
let
  name = "KeyTaps";
  id = "local.ria.key-taps";
  app = "${config.home.homeDirectory}/Applications/${name}.app";
  label = "org.nix-community.home.key-taps";
  cert = "KeyTaps Local Signing";
  # The source the installed app was built from.
  stamp = "${config.home.homeDirectory}/.local/state/key-taps/source";
in
{
  # Built with the system swiftc before the LaunchAgent is set up; a rebuilt app restarts the running agent.
  home.activation.buildKeyTaps = lib.hm.dag.entryBetween [ "setupLaunchAgents" ] [ "writeBoundary" ] ''
    src=${../config/key-taps/main.swift}
    app="${app}"
    if [ ! -x "$app/Contents/MacOS/${name}" ] || [ "$(cat "${stamp}" 2>/dev/null)" != "$src" ]; then
      build=$(mktemp -d)
      run mkdir -p "$build/${name}.app/Contents/MacOS"
      run /usr/bin/swiftc -O "$src" -o "$build/${name}.app/Contents/MacOS/${name}"
      cat > "$build/${name}.app/Contents/Info.plist" <<PLIST
    <?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
    <plist version="1.0"><dict>
      <key>CFBundleExecutable</key><string>${name}</string>
      <key>CFBundleIdentifier</key><string>${id}</string>
      <key>CFBundleName</key><string>${name}</string>
      <key>CFBundlePackageType</key><string>APPL</string>
      <key>LSUIElement</key><true/>
    </dict></plist>
    PLIST
      if /usr/bin/security find-identity -p codesigning | grep -q '"${cert}"'; then sign="${cert}"; else sign=-; fi
      run /usr/bin/codesign --force --sign "$sign" --identifier ${id} "$build/${name}.app"
      run mkdir -p "$(dirname "$app")"
      run rm -rf "$app"
      run mv "$build/${name}.app" "$app"
      run rm -rf "$build"
      run mkdir -p "$(dirname "${stamp}")"
      run sh -c 'echo "$1" > "$2"' sh "$src" "${stamp}"
      run /bin/launchctl kickstart -k "gui/$(id -u)/${label}" 2>/dev/null || true
    fi
  '';

  launchd.agents.key-taps = {
    enable = true;
    config = {
      ProgramArguments = [ "${app}/Contents/MacOS/${name}" ];
      RunAtLoad = true;
      KeepAlive = true;
      ProcessType = "Interactive";
      StandardErrorPath = "${config.home.homeDirectory}/Library/Logs/key-taps.log";
    };
  };
}

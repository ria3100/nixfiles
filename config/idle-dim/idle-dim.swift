// 常駐して、動いている間は画面ロックさせず（Amphetamine の代わり）、
// 設定した時間（~/.config/idle-dim/config.json の dimAfterMinutes、既定 30 分）操作がなければメインディスプレイの明るさを最低にし、操作があれば元の明るさに戻す。
// ディスプレイとシステムのスリープを電源アサーションで止めるので、画面が消えず、ロックもかからない。
// 操作の有無は HIDIdleTime（最後の入力からの経過時間）で見るため、アクセシビリティの許可は要らない。
// 設定ファイルは毎回読み直すので、変更は再起動なしで 30 秒以内に効く。
// 明るさは display-brightness と同じく DisplayServices（非公開フレームワーク）で設定する。
import CoreGraphics
import Foundation
import IOKit
import IOKit.pwr_mgt

// Seconds of no input before dimming, from ~/.config/idle-dim/config.json ({"dimAfterMinutes": 30}).
let configURL = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".config/idle-dim/config.json")
func dimAfter() -> Double {
  guard let data = try? Data(contentsOf: configURL),
        let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
        let minutes = (json["dimAfterMinutes"] as? NSNumber)?.doubleValue, minutes > 0 else { return 30 * 60 }
  return minutes * 60
}

typealias GetBrightness = @convention(c) (CGDirectDisplayID, UnsafeMutablePointer<Float>) -> Int32
typealias SetBrightness = @convention(c) (CGDirectDisplayID, Float) -> Int32

guard let lib = dlopen("/System/Library/PrivateFrameworks/DisplayServices.framework/DisplayServices", RTLD_NOW),
      let getSym = dlsym(lib, "DisplayServicesGetBrightness"),
      let setSym = dlsym(lib, "DisplayServicesSetBrightness") else { exit(1) }
let getBrightness = unsafeBitCast(getSym, to: GetBrightness.self)
let setBrightness = unsafeBitCast(setSym, to: SetBrightness.self)

func log(_ message: String) {
  FileHandle.standardError.write("\(Date()) \(message)\n".data(using: .utf8)!)
}

// Seconds since the last keyboard, mouse or trackpad input.
func idleSeconds() -> Double {
  let service = IOServiceGetMatchingService(kIOMainPortDefault, IOServiceMatching("IOHIDSystem"))
  defer { IOObjectRelease(service) }
  guard service != 0,
        let value = IORegistryEntryCreateCFProperty(service, "HIDIdleTime" as CFString, kCFAllocatorDefault, 0)?
          .takeRetainedValue() as? NSNumber else { return 0 }
  return value.doubleValue / 1_000_000_000
}

var assertions: [IOPMAssertionID] = []
for type in [kIOPMAssertionTypePreventUserIdleDisplaySleep, kIOPMAssertionTypePreventUserIdleSystemSleep] {
  var id = IOPMAssertionID(0)
  if IOPMAssertionCreateWithName(type as CFString, IOPMAssertionLevel(kIOPMAssertionLevelOn),
                                 "idle-dim: keep the screen unlocked" as CFString, &id) == kIOReturnSuccess {
    assertions.append(id)
  } else {
    log("could not create \(type)")
  }
}

// The display that was dimmed and its brightness before, while dimmed.
var dimmed: (display: CGDirectDisplayID, brightness: Float)?

func restore() {
  guard let d = dimmed else { return }
  _ = setBrightness(d.display, d.brightness)
  dimmed = nil
  log("restored \(d.brightness)")
}

var signalSources: [DispatchSourceSignal] = []
// Put the brightness back when stopped (launchctl, logout) while dimmed.
for sig in [SIGTERM, SIGINT, SIGHUP] {
  signal(sig, SIG_IGN)
  let source = DispatchSource.makeSignalSource(signal: sig, queue: .main)
  source.setEventHandler {
    restore()
    assertions.forEach { IOPMAssertionRelease($0) }
    exit(0)
  }
  source.resume()
  signalSources.append(source)
}

func tick() {
  let idle = idleSeconds()
  let threshold = dimAfter()
  var next: Double
  if dimmed != nil {
    if idle < 2 { restore() }
    next = dimmed == nil ? threshold : 0.3
  } else if idle >= threshold {
    let display = CGMainDisplayID()
    var now: Float = 0
    if getBrightness(display, &now) == 0 {
      dimmed = (display, now)
      _ = setBrightness(display, 0)
      log("dimmed from \(now)")
    }
    next = 0.3
  } else {
    next = threshold - idle
  }
  // At most 30 s apart while waiting, so a changed config takes effect without a restart.
  DispatchQueue.main.asyncAfter(deadline: .now() + min(30, max(0.3, next))) { tick() }
}

log("started")
tick()
dispatchMain()

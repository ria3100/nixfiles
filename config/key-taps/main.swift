// 修飾キーの単押しに動作を割り当てる常駐プログラム（Karabiner の代わり）。
//   左 Command の単押し → 英数、右 Command の単押し → かな
//   右 Option の単押し → Herdr が前面なら直前のアプリへ戻る。それ以外は Herdr を前面に出す（なければ起動）
// 修飾キーを押した時点ではその入力を止めておき、ほかのキー・クリック・スクロールが来たら先に送る
// （通常の修飾キーとして働く）。何も来ずに離されたら止めた入力は捨て、単押しの動作だけをする。
// 押したまま aloneLimit を過ぎたら、修飾キーとして送る（単押しにはならない）。
// キー入力を書き換えるため「アクセシビリティ」の許可が要る。
import AppKit
import CoreGraphics

let aloneLimit: TimeInterval = 1.0
let herdr = "dev.herdr.app"
// Marks events this program posts, so its own tap lets them through.
let ownMark: Int64 = 0x6B65_7974

// Device-dependent modifier flags (IOLLEvent.h) that tell left and right apart.
let targets: [Int64: UInt64] = [
  55: 0x08, // left command
  54: 0x10, // right command
  61: 0x40, // right option
]

func log(_ message: String) {
  FileHandle.standardError.write("\(Date()) \(message)\n".data(using: .utf8)!)
}

func postKey(_ code: CGKeyCode) {
  let source = CGEventSource(stateID: .privateState)
  for down in [true, false] {
    guard let e = CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: down) else { continue }
    e.flags = []
    e.setIntegerValueField(.eventSourceUserData, value: ownMark)
    e.post(tap: .cgSessionEventTap)
  }
}

// The app that was frontmost before Herdr, to go back to.
var previousApp: NSRunningApplication?
NSWorkspace.shared.notificationCenter.addObserver(
  forName: NSWorkspace.didDeactivateApplicationNotification, object: nil, queue: .main
) { note in
  if let app = note.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication,
     app.bundleIdentifier != herdr {
    previousApp = app
  }
}

func open(_ url: URL?) {
  guard let url else { return }
  let config = NSWorkspace.OpenConfiguration()
  config.activates = true
  NSWorkspace.shared.openApplication(at: url, configuration: config) { _, error in
    if let error { log("could not open \(url.path): \(error.localizedDescription)") }
  }
}

func toggleHerdr() {
  if NSWorkspace.shared.frontmostApplication?.bundleIdentifier == herdr {
    if let app = previousApp, !app.isTerminated { open(app.bundleURL) }
  } else {
    open(NSWorkspace.shared.urlForApplication(withBundleIdentifier: herdr))
  }
}

func tapped(_ code: Int64) {
  switch code {
  case 55: postKey(102) // 英数
  case 54: postKey(104) // かな
  case 61: DispatchQueue.main.async { toggleHerdr() }
  default: break
  }
}

// The modifier press being held back, waiting to see whether it is pressed alone.
struct Pending {
  let code: Int64
  let event: CGEvent
  let time: Date
}
var pending: Pending?
var tap: CFMachPort?

// Sends the held-back press ahead of the event being handled.
func flush(_ proxy: CGEventTapProxy) {
  guard let p = pending else { return }
  pending = nil
  p.event.tapPostEvent(proxy)
}

func handle(_ proxy: CGEventTapProxy, _ type: CGEventType, _ event: CGEvent) -> Unmanaged<CGEvent>? {
  if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
    if let tap { CGEvent.tapEnable(tap: tap, enable: true) }
    return Unmanaged.passUnretained(event)
  }
  if event.getIntegerValueField(.eventSourceUserData) == ownMark { return Unmanaged.passUnretained(event) }

  guard type == .flagsChanged else {
    flush(proxy)
    return Unmanaged.passUnretained(event)
  }
  let code = event.getIntegerValueField(.keyboardEventKeycode)
  guard let mask = targets[code] else {
    flush(proxy)
    return Unmanaged.passUnretained(event)
  }
  if event.flags.rawValue & mask != 0 {
    // Pressed: hold it back. Another target key already held back counts as used.
    flush(proxy)
    guard let copy = event.copy() else { return Unmanaged.passUnretained(event) }
    let p = Pending(code: code, event: copy, time: Date())
    pending = p
    // Held alone too long: it is a modifier after all (e.g. Command while pointing at a link).
    DispatchQueue.main.asyncAfter(deadline: .now() + aloneLimit) {
      guard let now = pending, now.time == p.time else { return }
      pending = nil
      now.event.setIntegerValueField(.eventSourceUserData, value: ownMark)
      now.event.post(tap: .cgSessionEventTap)
    }
    return nil
  }
  // Released.
  if let p = pending, p.code == code {
    pending = nil
    tapped(code)
    return nil
  }
  return Unmanaged.passUnretained(event)
}

let mask: CGEventMask = [
  CGEventType.flagsChanged, .keyDown, .leftMouseDown, .rightMouseDown, .otherMouseDown, .scrollWheel,
].reduce(0) { $0 | (1 << $1.rawValue) }

func installTap() {
  tap = CGEvent.tapCreate(
    tap: .cghidEventTap, place: .headInsertEventTap, options: .defaultTap, eventsOfInterest: mask,
    callback: { proxy, type, event, _ in handle(proxy, type, event) }, userInfo: nil)
  guard let tap else {
    // Not allowed yet: ask once, then keep trying until Accessibility is granted.
    log("no Accessibility access yet")
    DispatchQueue.main.asyncAfter(deadline: .now() + 5) { installTap() }
    return
  }
  CFRunLoopAddSource(CFRunLoopGetMain(), CFMachPortCreateRunLoopSource(nil, tap, 0), .commonModes)
  CGEvent.tapEnable(tap: tap, enable: true)
  log("started")
}

_ = AXIsProcessTrustedWithOptions([kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary)
let app = NSApplication.shared
app.setActivationPolicy(.prohibited)
installTap()
app.run()

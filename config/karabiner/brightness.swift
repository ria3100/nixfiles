// メインディスプレイの明るさを 1/16 ずつ上げ下げする（Karabiner の F1 / F2 から呼ぶ）。
//   display-brightness up|down
// Karabiner の仮想キーボードが送る明るさキーは Studio Display に効かないため、
// DisplayServices（非公開フレームワーク）で明るさを直接設定する。段階は macOS の明るさキーと同じ。
import CoreGraphics
import Foundation

typealias GetBrightness = @convention(c) (CGDirectDisplayID, UnsafeMutablePointer<Float>) -> Int32
typealias SetBrightness = @convention(c) (CGDirectDisplayID, Float) -> Int32

guard let lib = dlopen("/System/Library/PrivateFrameworks/DisplayServices.framework/DisplayServices", RTLD_NOW),
      let getSym = dlsym(lib, "DisplayServicesGetBrightness"),
      let setSym = dlsym(lib, "DisplayServicesSetBrightness") else { exit(1) }
let get = unsafeBitCast(getSym, to: GetBrightness.self)
let set = unsafeBitCast(setSym, to: SetBrightness.self)

let display = CGMainDisplayID()
var now: Float = 0
guard get(display, &now) == 0 else { exit(1) }
let step: Float = 1.0 / 16
let sign: Float = CommandLine.arguments.dropFirst().first == "up" ? 1 : -1
exit(set(display, min(1, max(0, ((now / step).rounded() + sign) * step))))

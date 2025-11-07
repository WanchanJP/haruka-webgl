import { captureManager } from "./capture-manager";

let installed = false;

/**
 * window.onUnityImageReceived を CaptureManager にブリッジ
 * 既存の /debug/unity との衝突を防ぐため、一度だけ登録
 */
export function installUnityReceiverBridge() {
  if (installed) {
    console.log(
      "[installUnityReceiverBridge] Already installed, skipping"
    );
    return;
  }

  if (typeof window === "undefined") {
    return;
  }

  console.log("[installUnityReceiverBridge] Installing Unity receiver bridge");

  // window.onUnityImageReceived を上書き
  (window as any).onUnityImageReceived = (
    b64: string,
    w: number,
    h: number,
    index = 0
  ) => {
    console.log(
      `[onUnityImageReceived] Received: ${b64.length} chars, ${w}x${h}, index=${index}`
    );
    // CaptureManager へブリッジ
    captureManager.emit(b64, w, h, index);
  };

  installed = true;
}

/**
 * ブリッジがインストール済みかチェック
 */
export function isReceiverBridgeInstalled(): boolean {
  return installed;
}

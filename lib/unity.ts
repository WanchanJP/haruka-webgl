/**
 * Unity WebGL Loader
 * Unity WebGLビルド成果物を動的にロードし、インスタンスを作成する
 */

// ========================================
// ⚙️ ビルド設定（Unityのビルド名に合わせて変更）
// ========================================
const BUILD_BASE = "/unity/Build/haruka"; // ← Unityのビルド名に応じて編集

// ========================================
// 型定義
// ========================================
interface UnityConfig {
  dataUrl: string;
  frameworkUrl: string;
  codeUrl: string;
  streamingAssetsUrl: string;
  companyName: string;
  productName: string;
  productVersion: string;
}

declare global {
  interface Window {
    createUnityInstance?: (
      canvas: HTMLCanvasElement,
      config: UnityConfig
    ) => Promise<any>;
    unityInstance?: any;
    onUnityImageReceived?: (
      b64: string,
      w: number,
      h: number,
      index?: number
    ) => void;
  }
}

// ========================================
// ヘルパー関数
// ========================================

/**
 * スクリプトを動的に読み込む
 */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error(`Failed to load script: ${src}`));
    document.body.appendChild(script);
  });
}

// ========================================
// Unity初期化
// ========================================

/**
 * Unity WebGLインスタンスをロードして初期化
 * @param onProgress - 進行状況コールバック（オプション）
 * @throws {Error} キャンバス要素が見つからない、またはロードに失敗した場合
 */
export async function loadUnity(
  onProgress?: (progress: number) => void
): Promise<void> {
  try {
    console.log("[Unity] Starting Unity initialization...");

    // キャンバス要素を取得
    const canvas = document.getElementById("unity-canvas") as HTMLCanvasElement;
    if (!canvas) {
      throw new Error(
        'Canvas element with id "unity-canvas" not found in the DOM'
      );
    }
    console.log("[Unity] Canvas element found:", canvas);

    // Unityローダースクリプトを読み込む
    const loaderUrl = `${BUILD_BASE}.loader.js`;
    console.log(`[Unity] Loading Unity loader from: ${loaderUrl}`);
    await loadScript(loaderUrl);
    console.log("[Unity] Loader script loaded successfully");

    // createUnityInstance関数が読み込まれたか確認
    if (typeof window.createUnityInstance !== "function") {
      throw new Error(
        "createUnityInstance is not available after loading the loader script"
      );
    }
    console.log("[Unity] createUnityInstance function is available");

    // Unity設定
    const config: UnityConfig = {
      dataUrl: `${BUILD_BASE}.data`,
      frameworkUrl: `${BUILD_BASE}.framework.js`,
      codeUrl: `${BUILD_BASE}.wasm`,
      streamingAssetsUrl: "StreamingAssets",
      companyName: "DefaultCompany",
      productName: "Haruka WebGL",
      productVersion: "0.3.0",
    };

    console.log("[Unity] Creating Unity instance with config:", config);
    console.log("[Unity] This may take a while for large builds...");

    // Unityインスタンスを作成（進行状況コールバック付き）
    const instance = await window.createUnityInstance(canvas, config);

    // グローバルに保存
    window.unityInstance = instance;

    console.log("[Unity] ✅ Unity instance created successfully!");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[Unity] ❌ Failed to load Unity:", error);
    throw new Error(`Unity load failed: ${errorMessage}`);
  }
}

/**
 * Unity側にメッセージを送信
 * @param gameObjectName - Unity側のGameObject名
 * @param methodName - Unity側のメソッド名
 * @param param - 送信するパラメータ（オプション）
 * @throws {Error} Unity instanceが未初期化の場合
 */
export function sendMessageToUnity(
  gameObjectName: string,
  methodName: string,
  param?: string | number
): void {
  const instance = window.unityInstance;

  if (!instance) {
    console.warn(
      `[Unity] Cannot send message: Unity instance is not ready yet. (${gameObjectName}.${methodName})`
    );
    return;
  }

  try {
    if (param === undefined) {
      instance.SendMessage(gameObjectName, methodName);
      console.log(`[Unity] Sent: ${gameObjectName}.${methodName}()`);
    } else {
      instance.SendMessage(gameObjectName, methodName, param);
      console.log(
        `[Unity] Sent: ${gameObjectName}.${methodName}(${param})`
      );
    }
  } catch (error) {
    console.error(
      `[Unity] Failed to send message to ${gameObjectName}.${methodName}:`,
      error
    );
    throw error;
  }
}

// ========================================
// Canvas描画関数
// ========================================

/**
 * Base64 PNG画像をCanvasに描画（高DPI対応）
 * @param b64 - Base64エンコードされた画像データ（data:image/png;base64, プレフィックスなし）
 * @param w - CSS幅（ピクセル）
 * @param h - CSS高さ（ピクセル）
 * @param index - Canvas番号（デフォルト: 0 → #rt-canv-0）
 */
export function drawBase64ToCanvas(
  b64: string,
  w: number,
  h: number,
  index = 0
): void {
  const cvs = document.getElementById(
    `rt-canv-${index}`
  ) as HTMLCanvasElement | null;
  if (!cvs) {
    console.warn(`[drawBase64ToCanvas] canvas #rt-canv-${index} not found`);
    return;
  }

  // 高DPI対応：実画素を確保
  const dpr = window.devicePixelRatio || 1;
  cvs.width = Math.max(1, Math.floor(w * dpr));
  cvs.height = Math.max(1, Math.floor(h * dpr));
  cvs.style.width = `${w}px`;
  cvs.style.height = `${h}px`;

  const ctx = cvs.getContext("2d");
  if (!ctx) {
    console.error("[drawBase64ToCanvas] 2D context not available");
    return;
  }

  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    ctx.drawImage(img, 0, 0, cvs.width, cvs.height);
    console.log(`[drawBase64ToCanvas] ✅ Image rendered to #rt-canv-${index}`);
  };
  img.onerror = (e) => {
    console.error("[drawBase64ToCanvas] image load error", e);
  };
  img.src = `data:image/png;base64,${b64}`;
}

// ========================================
// グローバル受け口の登録（ブラウザ環境のみ）
// ========================================

if (typeof window !== "undefined") {
  window.onUnityImageReceived = (b64: string, w: number, h: number, index = 0) => {
    console.log(`[onUnityImageReceived] Received: ${b64.length} chars, ${w}x${h}, index=${index}`);
    drawBase64ToCanvas(b64, w, h, index);
  };
}

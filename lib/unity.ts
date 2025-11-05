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
 * @param value - 送信する値（オプション）
 */
export function sendMessageToUnity(
  gameObjectName: string,
  methodName: string,
  value?: string | number
): void {
  if (!window.unityInstance) {
    console.warn("Unity instance is not ready yet");
    return;
  }

  try {
    window.unityInstance.SendMessage(gameObjectName, methodName, value);
    console.log(
      `Sent message to Unity: ${gameObjectName}.${methodName}`,
      value
    );
  } catch (error) {
    console.error("Failed to send message to Unity:", error);
  }
}

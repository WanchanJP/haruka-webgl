/**
 * グローバル型定義
 * Window オブジェクトの拡張とグローバル型の定義
 */

declare global {
  /**
   * Unity WebGL ビルド設定
   */
  interface UnityConfig {
    dataUrl: string;
    frameworkUrl: string;
    codeUrl: string;
    streamingAssetsUrl?: string;
    companyName?: string;
    productName?: string;
    productVersion?: string;
  }

  /**
   * Unity WebGL インスタンス
   */
  interface UnityInstance {
    SendMessage(objectName: string, methodName: string, value?: string | number): void;
    Quit(): Promise<void>;
    SetFullscreen?(fullscreen: boolean): void;
  }

  /**
   * Unity Module（createUnityInstance の戻り値に含まれる場合がある）
   */
  interface UnityModule {
    canvas: HTMLCanvasElement;
  }

  /**
   * Unity WebGL ローダー関数
   * *.loader.js によってグローバルスコープに追加される
   */
  function createUnityInstance(
    canvas: HTMLCanvasElement,
    config: UnityConfig,
    onProgress?: (progress: number) => void
  ): Promise<UnityInstance>;
  interface Window {
    /**
     * Unity WebGLインスタンス
     * loadUnity()によって初期化される
     */
    unityInstance?: UnityInstance;

    /**
     * Unity WebGLローダーが提供する関数
     * *.loader.js によって動的に追加される
     */
    createUnityInstance?: typeof createUnityInstance;

    /**
     * Unity → JavaScript への画像データ受信ハンドラ
     * Unity側の jslib から呼び出される
     *
     * @param b64 - Base64エンコードされたPNG画像データ（プレフィックスなし）
     * @param w - 画像の幅（ピクセル）
     * @param h - 画像の高さ（ピクセル）
     * @param index - Canvas番号（デフォルト: 0 → #rt-canv-0）
     *
     * @example
     * window.onUnityImageReceived = (b64, w, h, index = 0) => {
     *   const canvas = document.getElementById(`rt-canv-${index}`) as HTMLCanvasElement;
     *   const ctx = canvas.getContext("2d");
     *   const img = new Image();
     *   img.onload = () => ctx.drawImage(img, 0, 0);
     *   img.src = `data:image/png;base64,${b64}`;
     * };
     */
    onUnityImageReceived?: (
      b64: string,
      w: number,
      h: number,
      index?: number
    ) => void;

    /**
     * Unity 側の Bridge が準備完了したかのフラグ
     */
    isBridgeReady?: boolean;

    /**
     * Unity 側から呼ばれる準備完了コールバック
     */
    onBridgeReady?: () => void;
  }
}

// TypeScriptにこのファイルがモジュールであることを認識させる
// これがないとグローバル拡張が正しく機能しない
export {};

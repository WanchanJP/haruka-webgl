/**
 * グローバル型定義
 * Window オブジェクトの拡張とグローバル型の定義
 */

declare global {
  interface Window {
    /**
     * Unity WebGLインスタンス
     * loadUnity()によって初期化される
     *
     * @remarks
     * 現在は any 型だが、将来的には適切な型定義に置き換える予定
     * Unity側のAPIに応じて以下のようなインターフェースを定義することを推奨:
     *
     * @example
     * interface UnityInstance {
     *   SendMessage(gameObjectName: string, methodName: string, value?: string | number): void;
     *   Quit(): Promise<void>;
     *   SetFullscreen(fullscreen: boolean): void;
     * }
     */
    unityInstance?: any;

    /**
     * Unity WebGLローダーが提供する関数
     * *.loader.js によって動的に追加される
     */
    createUnityInstance?: (
      canvas: HTMLCanvasElement,
      config: {
        dataUrl: string;
        frameworkUrl: string;
        codeUrl: string;
        streamingAssetsUrl: string;
        companyName: string;
        productName: string;
        productVersion: string;
      }
    ) => Promise<any>;

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
  }
}

// TypeScriptにこのファイルがモジュールであることを認識させる
// これがないとグローバル拡張が正しく機能しない
export {};

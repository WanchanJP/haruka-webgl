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
  }
}

// TypeScriptにこのファイルがモジュールであることを認識させる
// これがないとグローバル拡張が正しく機能しない
export {};

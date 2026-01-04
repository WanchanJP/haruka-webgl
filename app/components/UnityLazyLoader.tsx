"use client";

import { useRef, useState, useEffect } from "react";

/**
 * UnityLazyLoader プロップス
 */
export interface UnityLazyLoaderProps {
  /** Unity Build フォルダーの相対パス（例: "/unity/Build/haruka"） */
  buildPath: string;

  /** Canvas の CSS 横幅 */
  canvasWidth?: number;

  /** Canvas の CSS 縦幅 */
  canvasHeight?: number;

  /** Unity インスタンス準備完了時のコールバック */
  onUnityReady?: (instance: UnityInstance) => void;

  /** ロード進捗コールバック（0.0 ~ 1.0） */
  onProgress?: (progress: number) => void;

  /** エラー発生時のコールバック */
  onError?: (error: Error) => void;

  /** 追加の UnityConfig（必要に応じてマージ） */
  unityConfig?: Partial<UnityConfig>;
}

/**
 * Unity WebGL 遅延ローダー
 * - ボタン押下までスクリプト読み込みを開始しない
 * - 一度ロードしたらアンマウントまで維持
 */
export default function UnityLazyLoader({
  buildPath,
  canvasWidth = 960,
  canvasHeight = 600,
  onUnityReady,
  onProgress,
  onError,
  unityConfig = {},
}: UnityLazyLoaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const instanceRef = useRef<UnityInstance | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Unity ローダースクリプトを動的にロード
   */
  async function loadUnityScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      // すでにロード済みなら何もしない
      if (typeof window.createUnityInstance !== "undefined") {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = `${buildPath}.loader.js`;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error(`Failed to load Unity loader: ${script.src}`));

      document.body.appendChild(script);
    });
  }

  /**
   * Unity インスタンスを初期化
   */
  async function createUnity() {
    const canvas = canvasRef.current;
    if (!canvas) {
      throw new Error("Canvas element not found");
    }

    // loader.js をロード
    await loadUnityScript();

    if (typeof window.createUnityInstance === "undefined") {
      throw new Error("createUnityInstance is not available");
    }

    // UnityConfig を構築
    const config: UnityConfig = {
      dataUrl: `${buildPath}.data.gz`,
      frameworkUrl: `${buildPath}.framework.js.gz`,
      codeUrl: `${buildPath}.wasm.gz`,
      streamingAssetsUrl: "StreamingAssets",
      companyName: "DefaultCompany",
      productName: "haruka-webgl",
      productVersion: "1.0.0",
      ...unityConfig,
    };

    // Unity インスタンス作成
    const instance = await window.createUnityInstance(
      canvas,
      config,
      (progress) => {
        const p = Math.round(progress * 100) / 100;
        setLoadProgress(p);
        onProgress?.(p);
      }
    );

    return instance;
  }

  /**
   * ロード開始ハンドラ（ボタン押下）
   */
  async function handleLoadUnity() {
    if (isLoading || isReady) return;

    setIsLoading(true);
    setError(null);

    try {
      const instance = await createUnity();
      instanceRef.current = instance;
      setIsReady(true);
      onUnityReady?.(instance);
    } catch (err: any) {
      console.error("[UnityLazyLoader] Load error:", err);
      const errorMsg = err.message || "Unknown error";
      setError(errorMsg);
      onError?.(err);
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * アンマウント時のクリーンアップ
   */
  useEffect(() => {
    return () => {
      if (instanceRef.current) {
        instanceRef.current.Quit().catch((e: unknown) => {
          console.warn("[UnityLazyLoader] Quit error:", e);
        });
      }
    };
  }, []);

  return (
    <div style={{ textAlign: "center", padding: "20px" }}>
      {/* Canvas（常に表示） */}
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        style={{
          display: "block",
          margin: "0 auto",
          maxWidth: "100%",
          border: "1px solid #ddd",
        }}
      />

      {/* ロード開始ボタン */}
      {!isReady && !isLoading && (
        <button
          onClick={handleLoadUnity}
          style={{
            marginTop: "20px",
            padding: "12px 24px",
            fontSize: "16px",
            cursor: "pointer",
          }}
        >
          Unity を起動
        </button>
      )}

      {/* ローディング表示 */}
      {isLoading && (
        <div style={{ marginTop: "20px" }}>
          <p>Loading Unity... {Math.round(loadProgress * 100)}%</p>
          <progress value={loadProgress} max={1} style={{ width: "80%" }} />
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div style={{ marginTop: "20px", color: "red" }}>
          <p>❌ {error}</p>
        </div>
      )}

      {/* 準備完了 */}
      {isReady && (
        <div style={{ marginTop: "20px", color: "green" }}>
          <p>✅ Unity is ready</p>
        </div>
      )}
    </div>
  );
}

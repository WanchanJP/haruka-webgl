import { sendMessageToUnity } from "@/lib/unity";

type CaptureListener = (
  b64: string,
  w: number,
  h: number,
  index: number
) => void;

type Frame = { b64: string; w: number; h: number };

/**
 * Unity キャプチャの発火・停止・受信を管理
 * 可視パネルが存在する時だけ、指定間隔でキャプチャを実行
 */
export class CaptureManager {
  private intervalMs: number;
  private timer: number | null = null;
  private hasVisible = false;
  private listeners = new Set<CaptureListener>();
  private isTabVisible = true;
  private latestByIndex = new Map<number, Frame>();

  constructor(intervalMs = 500) {
    this.intervalMs = intervalMs;

    // タブの可視状態を監視
    if (typeof document !== "undefined") {
      const handleVisibilityChange = () => {
        this.isTabVisible = !document.hidden;

        if (document.hidden) {
          console.log("[CaptureManager] Tab hidden - stopping capture");
          this.stop();
        } else {
          console.log("[CaptureManager] Tab visible - resuming if needed");
          if (this.hasVisible) {
            this.start();
          }
        }
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);
    }
  }

  /**
   * 可視状態を設定
   * @param hasVisible - 可視パネルが1つ以上存在するか
   */
  setVisibleState(hasVisible: boolean) {
    const stateChanged = this.hasVisible !== hasVisible;
    this.hasVisible = hasVisible;

    if (stateChanged) {
      console.log(
        `[CaptureManager] Visible state changed: ${hasVisible ? "has visible panels" : "no visible panels"}`
      );
    }

    if (hasVisible && this.isTabVisible) {
      this.start();
    } else {
      this.stop();
    }
  }

  /**
   * キャプチャループを開始
   */
  private start() {
    if (this.timer !== null) {
      // 既に起動中
      return;
    }

    // Unity インスタンスが準備できているか確認
    if (typeof window !== "undefined" && !(window as any).unityInstance) {
      console.warn(
        "[CaptureManager] Unity instance not ready yet, deferring start"
      );
      return;
    }

    console.log(
      `[CaptureManager] Starting capture loop (${this.intervalMs}ms interval)`
    );

    this.timer = window.setInterval(() => {
      try {
        // Unity 側へキャプチャ要求（単一ストリーム index=0）
        sendMessageToUnity("Bridge", "CaptureAndSend");
        console.log("[CaptureManager] Capture triggered");
      } catch (error) {
        console.error("[CaptureManager] Failed to trigger capture:", error);
      }
    }, this.intervalMs);
  }

  /**
   * キャプチャループを停止
   */
  private stop() {
    if (this.timer === null) {
      return;
    }

    console.log("[CaptureManager] Stopping capture loop");
    clearInterval(this.timer);
    this.timer = null;
  }

  /**
   * 画像受信リスナーを登録
   * @returns アンサブスクライブ関数
   */
  onImage(listener: CaptureListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 受信画像を全リスナーに配信
   */
  emit(b64: string, w: number, h: number, index: number) {
    // index ごとに最新フレームを保存
    this.latestByIndex.set(index, { b64, w, h });

    console.log(
      `[CaptureManager] Emitting image: ${b64.length} chars, ${w}x${h}, index=${index}, listeners=${this.listeners.size}`
    );
    this.listeners.forEach((fn) => {
      try {
        fn(b64, w, h, index);
      } catch (error) {
        console.error("[CaptureManager] Listener error:", error);
      }
    });
  }

  /**
   * 指定されたindexの最新フレームを取得
   */
  getLatest(index: number): Frame | undefined {
    return this.latestByIndex.get(index);
  }

  /**
   * 間隔を変更（実行中の場合は再起動）
   */
  setInterval(ms: number) {
    const wasRunning = this.timer !== null;
    this.stop();
    this.intervalMs = ms;
    if (wasRunning && this.hasVisible && this.isTabVisible) {
      this.start();
    }
  }

  /**
   * 現在の状態を取得
   */
  getState() {
    return {
      intervalMs: this.intervalMs,
      isRunning: this.timer !== null,
      hasVisible: this.hasVisible,
      isTabVisible: this.isTabVisible,
      listenerCount: this.listeners.size,
    };
  }
}

// シングルトンインスタンス（デフォルト500ms間隔）
export const captureManager = new CaptureManager(500);

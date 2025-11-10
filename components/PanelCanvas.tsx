"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { SceneSpec, PanelID, VisibleRange } from "@/lib/layout/panel-types";
import {
  setupCanvasForHighDPI,
  drawScene,
  preloadImages,
  type DrawOptions,
} from "@/lib/layout/draw";
import {
  getVisibleRangeFromContainer,
  getVisiblePanels,
} from "@/lib/layout/visibility";
import { calculateSceneHeight } from "@/lib/layout/panel-sample";
import { captureManager } from "@/lib/capture/capture-manager";
import { installUnityReceiverBridge } from "@/lib/capture/install-receiver";
import { startUnityCapture, stopUnityCapture } from "@/lib/unity";

type PanelCanvasProps = {
  scene: SceneSpec;
  onPanelEnter?: (id: PanelID) => void;
  onPanelLeave?: (id: PanelID) => void;
  debug?: boolean;
  showMask?: boolean;
};

export default function PanelCanvas({
  scene,
  onPanelEnter,
  onPanelLeave,
  debug = false,
  showMask = false,
}: PanelCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [imageCache, setImageCache] = useState<Map<string, HTMLImageElement>>(
    new Map()
  );
  const unityImagesRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const [visibleRange, setVisibleRange] = useState<VisibleRange>({
    top: 0,
    bottom: 0,
  });
  const [visiblePanelIds, setVisiblePanelIds] = useState<Set<PanelID>>(
    new Set()
  );
  const [needsRedraw, setNeedsRedraw] = useState(true);
  const activeUnityIndexes = useRef<Set<number>>(new Set());

  // デバッグパネルの表示/非表示（初回レンダリングは常に true、マウント後に localStorage から復元）
  const [showDebugPanel, setShowDebugPanel] = useState(true);

  // デバッグ情報の状態
  const [debugInfo, setDebugInfo] = useState({
    unityInstance: false,
    bridgeReady: false,
    visibleUnityIndexes: [] as number[],
    lastStartCommand: "",
    lastStopCommand: "",
    lastImageReceived: "",
    imageCount: 0,
    captureManagerState: "",
    memoryMB: 0,
    cachedImagesCount: 0,
    fps: 0,
    storageUsageMB: 0,
    storageQuotaMB: 0,
    localStorageKB: 0,
    sessionStorageKB: 0,
    indexedDBMB: 0,
  });

  // マウント後に localStorage から showDebugPanel を復元（Hydration エラー回避）
  useEffect(() => {
    const saved = localStorage.getItem('showDebugPanel');
    if (saved !== null) {
      setShowDebugPanel(saved === 'true');
    }
  }, []);

  // デバッグパネルのキーボードショートカット（U キー）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // U キー（大文字小文字どちらでも）
      if (e.key === 'u' || e.key === 'U') {
        // input/textarea にフォーカスがある場合は無視
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }

        setShowDebugPanel((prev) => {
          const newValue = !prev;
          localStorage.setItem('showDebugPanel', String(newValue));
          console.log(`[Unity Capture Debug] Panel ${newValue ? 'shown' : 'hidden'} (press U to toggle)`);
          return newValue;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // FPS 計測
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animationFrameId: number;

    const measureFPS = () => {
      frameCount++;
      const currentTime = performance.now();
      const elapsed = currentTime - lastTime;

      // 1秒ごとに FPS を更新
      if (elapsed >= 1000) {
        const fps = Math.round((frameCount * 1000) / elapsed);
        setDebugInfo((prev) => ({ ...prev, fps }));
        frameCount = 0;
        lastTime = currentTime;
      }

      animationFrameId = requestAnimationFrame(measureFPS);
    };

    animationFrameId = requestAnimationFrame(measureFPS);

    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // デバッグ情報の定期更新（メモリ・ストレージ）
  useEffect(() => {
    const updateDebugInfo = async () => {
      // メモリ使用量を取得（Chrome のみ）
      const memoryMB = (window.performance as any).memory
        ? ((window.performance as any).memory.usedJSHeapSize / 1024 / 1024).toFixed(1)
        : 0;

      // Storage API でストレージ使用量を取得
      let storageUsageMB = 0;
      let storageQuotaMB = 0;
      if (navigator.storage && navigator.storage.estimate) {
        try {
          const estimate = await navigator.storage.estimate();
          storageUsageMB = Number(((estimate.usage || 0) / 1024 / 1024).toFixed(1));
          storageQuotaMB = Number(((estimate.quota || 0) / 1024 / 1024).toFixed(0));
        } catch (e) {
          console.warn('[Debug] Storage API error:', e);
        }
      }

      // LocalStorage のサイズを推定
      let localStorageKB = 0;
      try {
        const localStorageStr = JSON.stringify(localStorage);
        localStorageKB = Number((new Blob([localStorageStr]).size / 1024).toFixed(1));
      } catch (e) {
        // localStorage が無効な場合
      }

      // SessionStorage のサイズを推定
      let sessionStorageKB = 0;
      try {
        const sessionStorageStr = JSON.stringify(sessionStorage);
        sessionStorageKB = Number((new Blob([sessionStorageStr]).size / 1024).toFixed(1));
      } catch (e) {
        // sessionStorage が無効な場合
      }

      // IndexedDB のサイズを推定（詳細は取得困難なので Storage API の usage を使用）
      const indexedDBMB = storageUsageMB; // 近似値

      setDebugInfo((prev) => ({
        ...prev,
        unityInstance: !!(window as any).unityInstance,
        bridgeReady: !!(window as any).isBridgeReady,
        captureManagerState: JSON.stringify(captureManager.getState()),
        memoryMB: Number(memoryMB),
        cachedImagesCount: unityImagesRef.current.size,
        storageUsageMB,
        storageQuotaMB,
        localStorageKB,
        sessionStorageKB,
        indexedDBMB,
      }));
    };

    // 初回更新
    updateDebugInfo();

    // 2秒ごとに更新（Storage API は重いため）
    const interval = setInterval(updateDebugInfo, 2000);

    return () => clearInterval(interval);
  }, []);

  // Unity受信ブリッジのインストールとキャプチャ受信
  useEffect(() => {
    console.log("[PanelCanvas] Installing Unity receiver bridge");
    installUnityReceiverBridge();

    const unsubscribe = captureManager.onImage((b64, w, h, index) => {
      console.log(
        `[PanelCanvas] Received Unity capture: ${b64.length} chars, ${w}x${h}, index=${index}`
      );

      // デバッグ情報を更新
      setDebugInfo((prev) => ({
        ...prev,
        lastImageReceived: `${w}x${h}, index=${index}, ${new Date().toLocaleTimeString()}`,
        imageCount: prev.imageCount + 1,
      }));

      // index ベースで Unity 画像を保存
      let img = unityImagesRef.current.get(index);
      const isNewImage = !img;

      if (isNewImage) {
        console.log(`[PanelCanvas] Creating new Image for index ${index}`);
        img = new Image();
        unityImagesRef.current.set(index, img);

        // onload は一度だけ設定（重複を防ぐ）
        img.onload = () => {
          console.log(`[PanelCanvas] Unity image loaded for index ${index}, requesting redraw`);
          setNeedsRedraw(true);
        };
      }

      // src を更新（onload は既に設定済み）
      if (img) {
        img.src = `data:image/png;base64,${b64}`;
      }

      // 📊 メモリ使用量のデバッグ（開発時のみ）
      if (process.env.NODE_ENV === 'development' && (performance as any).memory) {
        const memMB = ((performance as any).memory.usedJSHeapSize / 1024 / 1024).toFixed(1);
        if (Math.random() < 0.1) { // 10% の確率でログ出力（spam 防止）
          console.log(`[PanelCanvas] 💾 Memory: ${memMB} MB (${isNewImage ? 'new' : 'updated'} image)`);
        }
      }
    });

    console.log("[PanelCanvas] Unity image listener registered");
    return () => unsubscribe();
  }, []);

  // 画像プリロード
  useEffect(() => {
    const imageSrcs: string[] = [];

    scene.panels.forEach((p) => {
      // source.type === "image" を優先
      if (p.source?.type === "image") {
        imageSrcs.push(p.source.src);
      } else if (p.imageSrc) {
        // 後方互換性: imageSrc が指定されている場合
        imageSrcs.push(p.imageSrc);
      }
    });

    if (imageSrcs.length === 0) return;

    preloadImages(imageSrcs).then((cache) => {
      setImageCache(cache);
      setNeedsRedraw(true);
    });
  }, [scene]);

  // Unity画像取得関数
  const getUnityImage = useCallback((index: number) => {
    const img = unityImagesRef.current.get(index);
    console.log(`[getUnityImage] index=${index}, found=${!!img}, complete=${img?.complete}`);
    return img;
  }, []);

  // Canvas描画関数
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // デバッグ: 描画時の可視パネルを確認
    if (debug) {
      const unityPanels = scene.panels.filter((p) => p.source?.type === "unity");
      console.log(
        `[drawCanvas] Rendering with visible Unity panels:`,
        unityPanels.map((p) => ({
          id: p.id,
          visible: visiblePanelIds.has(p.id),
        }))
      );
    }

    const options: DrawOptions = {
      debug,
      showMask,
      imageCache,
      getUnityImage,
      isPanelVisible: (panelId) => visiblePanelIds.has(panelId),
    };

    drawScene(ctx, scene, options);
  }, [scene, debug, showMask, imageCache, getUnityImage, visiblePanelIds]);

  // 可視範囲の更新
  const updateVisibleRange = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      console.log("[updateVisibleRange] Container not found");
      return;
    }

    const newRange = getVisibleRangeFromContainer(container);
    setVisibleRange(newRange);

    // 可視パネルの計算（80%以上可視で表示）
    const visible = getVisiblePanels(
      scene.panels,
      newRange,
      scene.viewportWidth,
      0.8
    );

    const newVisibleIds = new Set(visible.map((p) => p.id));

    console.log(
      `[updateVisibleRange] 📍 Range: ${newRange.top.toFixed(0)}-${newRange.bottom.toFixed(0)}, Visible panels:`,
      Array.from(newVisibleIds)
    );
    console.log(
      `[updateVisibleRange] 📊 Total panels in scene: ${scene.panels.length}, Visible count: ${visible.length}`
    );

    // Enter/Leaveイベントの発火（前回の状態を参照するためrefを使う）
    setVisiblePanelIds((prevVisibleIds) => {
      // 状態更新後にイベントを発火させるため、queueMicrotaskを使用
      queueMicrotask(() => {
        newVisibleIds.forEach((id) => {
          if (!prevVisibleIds.has(id)) {
            onPanelEnter?.(id);
          }
        });

        prevVisibleIds.forEach((id) => {
          if (!newVisibleIds.has(id)) {
            onPanelLeave?.(id);
          }
        });
      });

      return newVisibleIds;
    });

    // 可視 Unity パネルの index を収集
    const newVisibleUnityIndexes = new Set<number>();
    const allUnityPanels = scene.panels.filter((p) => p.source?.type === "unity");

    console.log(
      `[updateVisibleRange] 🎮 Total Unity panels in scene: ${allUnityPanels.length}`,
      allUnityPanels.map(p => ({
        id: p.id,
        index: p.source?.type === 'unity' ? p.source.index : undefined,
        visible: newVisibleIds.has(p.id)
      }))
    );

    scene.panels.forEach((p) => {
      if (p.source?.type === "unity" && newVisibleIds.has(p.id)) {
        console.log(`[updateVisibleRange] ✅ Adding Unity index ${p.source.index} from panel ${p.id}`);
        newVisibleUnityIndexes.add(p.source.index);
      }
    });

    // 前回との差分を取って Start/Stop を送信
    const prevIndexes = activeUnityIndexes.current;
    console.log(
      `[updateVisibleRange] 🔄 Previous indexes: [${Array.from(prevIndexes).join(", ")}], New indexes: [${Array.from(newVisibleUnityIndexes).join(", ")}]`
    );

    // 新規に可視になった index → Start
    newVisibleUnityIndexes.forEach((index) => {
      if (!prevIndexes.has(index)) {
        console.log(`[updateVisibleRange] Starting Unity capture for index ${index}`);
        startUnityCapture(index, 500);

        // デバッグ情報を更新
        setDebugInfo((prev) => ({
          ...prev,
          lastStartCommand: `index=${index}, ${new Date().toLocaleTimeString()}`,
        }));
      }
    });

    // 可視でなくなった index → Stop & メモリ解放
    prevIndexes.forEach((index) => {
      if (!newVisibleUnityIndexes.has(index)) {
        console.log(`[updateVisibleRange] Stopping Unity capture for index ${index}`);
        stopUnityCapture(index);

        // デバッグ情報を更新
        setDebugInfo((prev) => ({
          ...prev,
          lastStopCommand: `index=${index}, ${new Date().toLocaleTimeString()}`,
        }));

        // 🧹 メモリ最適化：可視範囲外の画像を削除
        // ただし、すぐに再度可視になる可能性があるため、遅延削除
        setTimeout(() => {
          // 5秒後にまだ可視でなければ削除
          if (!activeUnityIndexes.current.has(index)) {
            const img = unityImagesRef.current.get(index);
            if (img) {
              console.log(`[updateVisibleRange] 🧹 Cleaning up image for index ${index}`);
              img.src = ""; // メモリ解放
              unityImagesRef.current.delete(index);
            }
          }
        }, 5000);
      }
    });

    // 現在の可視 index を保存
    activeUnityIndexes.current = newVisibleUnityIndexes;

    // デバッグ情報を更新
    setDebugInfo((prev) => ({
      ...prev,
      visibleUnityIndexes: Array.from(newVisibleUnityIndexes),
    }));

    // 🆕 新方式: 上記の startUnityCapture/stopUnityCapture が Unity 側 Bridge を直接制御
    // 📊 CaptureManager への通知は deprecated だが、画像受信のリスナー登録には必要なので残す
    const hasVisibleUnityPanels = newVisibleUnityIndexes.size > 0;
    console.log(
      `[updateVisibleRange] Unity indexes visible: [${Array.from(newVisibleUnityIndexes).join(", ")}]`
    );

    captureManager.setVisibleState(hasVisibleUnityPanels); // deprecated, 何もしない

    if (debug) {
      const unityPanels = scene.panels.filter((p) => p.source?.type === "unity");
      console.log(
        `[PanelCanvas] Visible range: ${newRange.top.toFixed(0)} - ${newRange.bottom.toFixed(0)}`,
        `Panels: [${Array.from(newVisibleIds).join(", ")}]`,
        `Unity Panels:`,
        unityPanels.map((p) => ({
          id: p.id,
          visible: newVisibleIds.has(p.id),
        })),
        `Capture: ${hasVisibleUnityPanels ? "ACTIVE" : "INACTIVE"}`
      );
    }

    setNeedsRedraw(true);
  }, [scene, onPanelEnter, onPanelLeave, debug]);

  // Canvas初期化とリサイズ
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const sceneHeight = calculateSceneHeight(scene);

    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      const ctx = setupCanvasForHighDPI(canvas, scene.viewportWidth, sceneHeight);
      if (ctx) {
        setNeedsRedraw(true);
      }
    };

    console.log("[PanelCanvas] Canvas initialized, calling initial updateVisibleRange");
    handleResize();
    updateVisibleRange();

    // 初期表示時にもう一度チェック（DOMが完全に準備された後）
    const initialCheckTimer = setTimeout(() => {
      console.log("[PanelCanvas] Running delayed updateVisibleRange (100ms)");
      updateVisibleRange();
    }, 100);

    // Unity インスタンスの準備完了を待つ
    // (Bridge ready は必須ではない - Unity インスタンスがあれば StartCapture を送信できる)
    let unityCheckAttempts = 0;
    const maxAttempts = 120; // 最大60秒待つ（500ms × 120）

    const checkUnityAndBridge = () => {
      const hasUnityInstance = !!(window as any).unityInstance;
      const isBridgeReady = !!(window as any).isBridgeReady;

      if (hasUnityInstance) {
        if (isBridgeReady) {
          console.log("[PanelCanvas] ✅ Unity instance AND Bridge ready, running updateVisibleRange");
        } else {
          console.log("[PanelCanvas] ✅ Unity instance ready (Bridge not ready yet, but proceeding anyway)");
        }
        clearInterval(unityCheckInterval);
        updateVisibleRange();
        return true;
      } else {
        console.log(`[PanelCanvas] Waiting for Unity instance... (attempt ${unityCheckAttempts}/${maxAttempts})`);
        return false;
      }
    };

    const unityCheckInterval = setInterval(() => {
      unityCheckAttempts++;
      if (checkUnityAndBridge()) {
        // 成功
      } else if (unityCheckAttempts >= maxAttempts) {
        console.warn("[PanelCanvas] Unity/Bridge check timeout, giving up");
        clearInterval(unityCheckInterval);
      }
    }, 500);

    // Bridge 準備完了イベントをリスン（イベント駆動で即座に反応）
    const handleBridgeReady = () => {
      console.log("[PanelCanvas] 🎯 Received unity-bridge-ready event, calling updateVisibleRange");
      clearInterval(unityCheckInterval);

      // 少し遅延させて、DOMが完全に準備されてから実行
      setTimeout(() => {
        console.log("[PanelCanvas] Executing delayed updateVisibleRange after Bridge ready");

        // ⭐ 重要：Bridge 準備完了前に記録された index をクリアして、再度 Start を送信
        console.log(
          `[PanelCanvas] Resetting activeUnityIndexes (was: [${Array.from(activeUnityIndexes.current).join(", ")}])`
        );
        activeUnityIndexes.current.clear();

        updateVisibleRange();
      }, 100);
    };
    window.addEventListener("unity-bridge-ready", handleBridgeReady);

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("unity-bridge-ready", handleBridgeReady);
      clearTimeout(initialCheckTimer);
      clearInterval(unityCheckInterval);
    };
  }, [scene, updateVisibleRange]);

  // スクロールハンドラ
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rafId: number | null = null;

    const handleScroll = () => {
      if (rafId !== null) return;

      rafId = requestAnimationFrame(() => {
        updateVisibleRange();
        rafId = null;
      });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [updateVisibleRange]);

  // 描画ループ（必要時のみ）
  useEffect(() => {
    if (!needsRedraw) return;

    const render = () => {
      drawCanvas();
      setNeedsRedraw(false);
      animationFrameRef.current = null;
    };

    if (animationFrameRef.current === null) {
      animationFrameRef.current = requestAnimationFrame(render);
    }

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [needsRedraw, drawCanvas]);

  // debug/showMask変更時の再描画
  useEffect(() => {
    setNeedsRedraw(true);
  }, [debug, showMask]);

  const sceneHeight = calculateSceneHeight(scene);

  return (
    <div
      ref={containerRef}
      className="panel-scroll-container"
      style={{
        height: "100vh",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <canvas
        ref={canvasRef}
        className="panel-canvas"
        style={{
          display: "block",
          width: `${scene.viewportWidth}px`,
          height: `${sceneHeight}px`,
          margin: "0 auto",
        }}
      />

      {/* デバッグオーバーレイ（開発時のみ表示、U キーで切り替え） */}
      {process.env.NODE_ENV === "development" && showDebugPanel && (
        <div
          style={{
            position: "fixed",
            top: "10px",
            left: "10px",
            background: "rgba(0, 0, 0, 0.85)",
            color: "#fff",
            padding: "12px",
            borderRadius: "6px",
            fontSize: "11px",
            fontFamily: "monospace",
            zIndex: 10000,
            maxWidth: "350px",
            lineHeight: "1.6",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: "8px", fontSize: "12px" }}>
            🔍 Unity Capture Debug
          </div>

          <div style={{ display: "grid", gap: "4px" }}>
            <div>
              Unity Instance:{" "}
              <span style={{ color: debugInfo.unityInstance ? "#0f0" : "#f00" }}>
                {debugInfo.unityInstance ? "✅ Ready" : "❌ Not Ready"}
              </span>
            </div>

            <div>
              Bridge Ready:{" "}
              <span style={{ color: debugInfo.bridgeReady ? "#0f0" : "#f00" }}>
                {debugInfo.bridgeReady ? "✅ Ready" : "❌ Not Ready"}
              </span>
            </div>

            <div style={{ borderTop: "1px solid #444", paddingTop: "4px", marginTop: "4px" }}>
              Visible Unity Indexes:{" "}
              <span style={{ color: "#ff0" }}>
                {debugInfo.visibleUnityIndexes.length > 0
                  ? `[${debugInfo.visibleUnityIndexes.join(", ")}]`
                  : "None"}
              </span>
            </div>

            <div>
              Last Start:{" "}
              <span style={{ color: "#0f0" }}>
                {debugInfo.lastStartCommand || "—"}
              </span>
            </div>

            <div>
              Last Stop:{" "}
              <span style={{ color: "#f44" }}>
                {debugInfo.lastStopCommand || "—"}
              </span>
            </div>

            <div style={{ borderTop: "1px solid #444", paddingTop: "4px", marginTop: "4px" }}>
              Images Received:{" "}
              <span style={{ color: "#0ff" }}>{debugInfo.imageCount}</span>
            </div>

            <div>
              Last Image:{" "}
              <span style={{ color: "#0ff" }}>
                {debugInfo.lastImageReceived || "—"}
              </span>
            </div>

            <div style={{ borderTop: "1px solid #444", paddingTop: "4px", marginTop: "4px" }}>
              🎬 FPS:{" "}
              <span style={{
                color: debugInfo.fps >= 55 ? "#0f0" : debugInfo.fps >= 30 ? "#ff0" : "#f00"
              }}>
                {debugInfo.fps}
              </span>
            </div>

            <div style={{ borderTop: "1px solid #444", paddingTop: "4px", marginTop: "4px" }}>
              💾 JS Heap:{" "}
              <span style={{ color: debugInfo.memoryMB > 200 ? "#f80" : "#0f0" }}>
                {debugInfo.memoryMB} MB
              </span>
            </div>

            <div>
              🖼️ Cached Images:{" "}
              <span style={{ color: "#0ff" }}>
                {debugInfo.cachedImagesCount} / 3 indexes
              </span>
            </div>

            <div style={{ borderTop: "1px solid #444", paddingTop: "4px", marginTop: "4px" }}>
              💿 Storage:{" "}
              <span style={{ color: "#0ff" }}>
                {debugInfo.storageUsageMB} / {debugInfo.storageQuotaMB} MB
              </span>
            </div>

            <div style={{ paddingLeft: "12px", fontSize: "10px", color: "#999" }}>
              └ LocalStorage:{" "}
              <span style={{ color: "#0ff" }}>{debugInfo.localStorageKB} KB</span>
            </div>

            <div style={{ paddingLeft: "12px", fontSize: "10px", color: "#999" }}>
              └ SessionStorage:{" "}
              <span style={{ color: "#0ff" }}>{debugInfo.sessionStorageKB} KB</span>
            </div>

            <div style={{ paddingLeft: "12px", fontSize: "10px", color: "#999" }}>
              └ IndexedDB/Cache:{" "}
              <span style={{ color: "#0ff" }}>{debugInfo.indexedDBMB} MB</span>
            </div>

            <div style={{ borderTop: "1px solid #444", paddingTop: "4px", marginTop: "4px", fontSize: "10px" }}>
              Capture Manager:{" "}
              <span style={{ color: "#aaa", wordBreak: "break-all" }}>
                {debugInfo.captureManagerState}
              </span>
            </div>

            <div style={{ borderTop: "1px solid #444", paddingTop: "4px", marginTop: "4px", fontSize: "10px", color: "#888", textAlign: "center" }}>
              Press [U] to toggle debug
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

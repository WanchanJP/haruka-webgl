"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { SceneSpec, PanelID, VisibleRange } from "@/lib/layout/panel-types";

// 🕒 ビルドタイムスタンプ（修正時に必ず更新すること）
const BUILD_TIMESTAMP = "2025-11-12 00:18:00";
import {
  setupCanvasForHighDPI,
  drawScene,
  preloadImages,
  type DrawOptions,
} from "@/lib/layout/draw";
import {
  getVisibleRangeFromContainer,
  getVisiblePanels,
  calculateVisibilityRatio,
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

  // 前回の可視パネルIDセットを保持（ヒステリシス用）
  const previousVisiblePanelIds = useRef<Set<PanelID>>(new Set());

  // Unity停止用のタイマーを管理（ちらつき防止用ディレイ）
  const unityStopTimers = useRef<Map<number, NodeJS.Timeout>>(new Map());

  // 表示スケール（モバイル対応用）- refで管理して常に最新の値を参照
  const currentScaleRef = useRef<number>(
    typeof window === 'undefined' ? 1.0 : Math.min(1, window.innerWidth / scene.viewportWidth)
  );

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

  // リアルタイムデバッグログ（画面表示用）
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const debugLogsRef = useRef<string[]>([]);

  const addDebugLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString() + '.' + new Date().getMilliseconds();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(logEntry);

    debugLogsRef.current = [...debugLogsRef.current.slice(-19), logEntry]; // 最新20件のみ
    setDebugLogs(debugLogsRef.current);
  }, []);

  // スクロール・可視判定のリアルタイム情報
  const [scrollDebugInfo, setScrollDebugInfo] = useState({
    scrollTop: 0,
    scale: 1.0,
    visibleRangeTop: 0,
    visibleRangeBottom: 0,
    panels: [] as Array<{
      id: string;
      y: number;
      height: number;
      bottom: number;
      isVisible: boolean;
      visibilityRatio: number;
    }>,
  });

  // 🚨 画像欠落検知（暗くなる瞬間を捉える）
  const [missingImageAlert, setMissingImageAlert] = useState<{
    show: boolean;
    panelId: string;
    index: number;
    timestamp: string;
  } | null>(null);

  // Unity画像更新カウンター（プレビュー再レンダリング用）
  const [unityImageUpdateCount, setUnityImageUpdateCount] = useState(0);

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
        addDebugLog(`🆕 Create img[${index}]`);
      }

      // src を更新
      if (img) {
        img.src = `data:image/png;base64,${b64}`;

        // 画像が正しく保存されているか確認
        const stored = unityImagesRef.current.get(index);
        const storeCheck = stored === img ? "✅" : "❌";
        addDebugLog(`💾 Store img[${index}] ${storeCheck}`);

        // デバッグパネルのプレビューを更新
        setUnityImageUpdateCount((prev) => prev + 1);

        // ⚠️ 重要：可視範囲内のUnity画像のみ再描画をトリガー
        // 範囲外の画像更新で再描画すると、範囲外スクロール中にちらつく
        const isIndexVisible = activeUnityIndexes.current.has(index);

        if (isIndexVisible) {
          addDebugLog(`📸 Unity[${index}] → REDRAW`);
          setNeedsRedraw(true);
        } else {
          addDebugLog(`📸 Unity[${index}] → SKIP`);
        }
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
    return () => {
      unsubscribe();
      // クリーンアップ: すべての停止タイマーをクリア
      unityStopTimers.current.forEach((timer) => clearTimeout(timer));
      unityStopTimers.current.clear();
    };
  }, [addDebugLog]);

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
    const hasSrc = img?.src ? "Y" : "N";
    const mapSize = unityImagesRef.current.size;
    console.log(`[getUnityImage] index=${index}, found=${!!img}, src=${hasSrc}, mapSize=${mapSize}`);
    addDebugLog(`🔍 Get img[${index}]: ${!!img ? "✅" : "❌"}`);
    return img;
  }, [addDebugLog]);

  // Canvas描画関数
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 🔍 デバッグ: 描画タイミングを記録
    addDebugLog(`🎨 DRAW`);

    // 🚨 可視Unityパネルで画像が欠落していないかチェック
    const visibleUnityPanels = scene.panels.filter(
      (p) => p.source?.type === "unity" && visiblePanelIds.has(p.id)
    );

    visibleUnityPanels.forEach((panel) => {
      if (panel.source?.type === "unity") {
        const img = unityImagesRef.current.get(panel.source.index);
        if (!img || !img.src) {
          // 🚨 可視なのに画像がない！
          const timestamp = new Date().toLocaleTimeString() + '.' + new Date().getMilliseconds();
          console.error(`[MISSING IMAGE] Panel ${panel.id} (index ${panel.source.index}) is visible but image is missing!`);
          addDebugLog(`🚨 MISSING: ${panel.id}[${panel.source.index}]`);

          setMissingImageAlert({
            show: true,
            panelId: panel.id,
            index: panel.source.index,
            timestamp,
          });

          // 3秒後に警告を消す
          setTimeout(() => {
            setMissingImageAlert(null);
          }, 3000);
        }
      }
    });

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
  }, [scene, debug, showMask, imageCache, getUnityImage, visiblePanelIds, addDebugLog]);

  // 可視範囲の更新
  const updateVisibleRange = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      console.log("[updateVisibleRange] Container not found");
      return;
    }

    addDebugLog(`📜 Scroll: ${Math.round(container.scrollTop)}px`);

    // スケールを考慮して可視範囲を取得（シーン座標系に変換）
    // refから最新の値を取得することで、スクロール時の判定ずれを防ぐ
    const newRange = getVisibleRangeFromContainer(container, currentScaleRef.current);
    setVisibleRange(newRange);

    // 🔍 デバッグ情報を更新（スクロール値と可視判定）
    const unityPanels = scene.panels.filter((p) => p.source?.type === "unity");
    const panelDebugInfo = unityPanels.map((p) => {
      const visibilityRatio = calculateVisibilityRatio(p, newRange, scene.viewportWidth);
      return {
        id: p.id,
        y: p.transform.y,
        height: p.transform.height,
        bottom: p.transform.y + p.transform.height,
        isVisible: visibilityRatio >= 0.5,
        visibilityRatio: Math.round(visibilityRatio * 100),
      };
    });

    setScrollDebugInfo({
      scrollTop: Math.round(container.scrollTop),
      scale: currentScaleRef.current,
      visibleRangeTop: Math.round(newRange.top),
      visibleRangeBottom: Math.round(newRange.bottom),
      panels: panelDebugInfo,
    });

    // ヒステリシス付き可視パネル判定（ちらつき防止）
    // - 前回可視だったパネル：10%未満になるまで可視を維持
    // - 前回非可視だったパネル：50%以上になったら可視にする
    const newVisibleIds = new Set<PanelID>();

    scene.panels.forEach((panel) => {
      const wasVisible = previousVisiblePanelIds.current.has(panel.id);
      const threshold = wasVisible ? 0.1 : 0.5; // ヒステリシス

      const visiblePanels = getVisiblePanels(
        [panel],
        newRange,
        scene.viewportWidth,
        threshold
      );

      if (visiblePanels.length > 0) {
        newVisibleIds.add(panel.id);
      }
    });

    // 前回の状態を保存
    previousVisiblePanelIds.current = newVisibleIds;

    console.log(
      `[updateVisibleRange] 📍 Range: ${newRange.top.toFixed(0)}-${newRange.bottom.toFixed(0)}, Visible panels:`,
      Array.from(newVisibleIds)
    );
    console.log(
      `[updateVisibleRange] 📊 Total panels in scene: ${scene.panels.length}, Visible count: ${newVisibleIds.size}`
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

    // 新規に可視になった index → Start（停止タイマーがあればキャンセル）
    newVisibleUnityIndexes.forEach((index) => {
      if (!prevIndexes.has(index)) {
        // 停止タイマーがあればキャンセル（すぐに戻ってきた場合）
        const existingTimer = unityStopTimers.current.get(index);
        if (existingTimer) {
          console.log(`[updateVisibleRange] ⏸️ Cancelling stop timer for index ${index} (returned to view)`);
          clearTimeout(existingTimer);
          unityStopTimers.current.delete(index);
        } else {
          console.log(`[updateVisibleRange] ▶️ Starting Unity capture for index ${index}`);
          startUnityCapture(index, 500);

          // デバッグ情報を更新
          setDebugInfo((prev) => ({
            ...prev,
            lastStartCommand: `index=${index}, ${new Date().toLocaleTimeString()}`,
          }));
        }
      }
    });

    // 可視でなくなった index → 500ms後にStop（ちらつき防止）
    prevIndexes.forEach((index) => {
      if (!newVisibleUnityIndexes.has(index)) {
        console.log(`[updateVisibleRange] ⏱️ Scheduling stop for Unity capture index ${index} (500ms delay)`);

        // 既存のタイマーをクリア
        const existingTimer = unityStopTimers.current.get(index);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        // 500ms後に停止
        const timer = setTimeout(() => {
          // タイマー実行時に本当に非可視かを再確認
          if (!activeUnityIndexes.current.has(index)) {
            console.log(`[updateVisibleRange] ⏹️ Stopping Unity capture for index ${index} (after delay)`);
            stopUnityCapture(index);

            // デバッグ情報を更新
            setDebugInfo((prev) => ({
              ...prev,
              lastStopCommand: `index=${index}, ${new Date().toLocaleTimeString()}`,
            }));

            // 🧹 メモリ最適化：可視範囲外の画像を削除
            setTimeout(() => {
              // さらに5秒後にまだ可視でなければ削除
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

          unityStopTimers.current.delete(index);
        }, 500);

        unityStopTimers.current.set(index, timer);
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
  }, [scene, onPanelEnter, onPanelLeave, debug, addDebugLog]);

  // Canvas初期化とリサイズ
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const sceneHeight = calculateSceneHeight(scene);

    const handleResize = () => {
      // スケールを計算して保存
      const viewportWidth = window.innerWidth;
      const scale = Math.min(1, viewportWidth / scene.viewportWidth);
      currentScaleRef.current = scale;

      // Canvas初期化（高DPI対応）
      const ctx = setupCanvasForHighDPI(canvas, scene.viewportWidth, sceneHeight);
      if (ctx) {
        // CSSスタイルでの表示サイズも更新
        setCanvasStyle({
          width: scene.viewportWidth * scale,
          height: sceneHeight * scale,
        });

        setNeedsRedraw(true);
        // スケールが変わったので可視範囲も再計算
        updateVisibleRange();
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
    const maxAttempts = 360; // 最大180秒(3分)待つ（500ms × 360）

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
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
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

  // viewport に合わせた実際の表示サイズを計算
  const [canvasStyle, setCanvasStyle] = useState({
    width: scene.viewportWidth,
    height: sceneHeight,
  });

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
          width: `${canvasStyle.width}px`,
          height: `${canvasStyle.height}px`,
          margin: "0 auto",
        }}
      />

      {/* ビルドタイムスタンプバッジ（常に表示） */}
      <div
        style={{
          position: "fixed",
          bottom: "10px",
          right: "10px",
          background: "rgba(0, 0, 0, 0.7)",
          color: "#0ff",
          padding: "4px 8px",
          borderRadius: "4px",
          fontSize: "10px",
          fontFamily: "monospace",
          zIndex: 9998,
          pointerEvents: "none",
          opacity: 0.6,
        }}
      >
        🕒 {BUILD_TIMESTAMP}
      </div>

      {/* 🚨 画像欠落インジケーター（控えめに右下に表示） */}
      {missingImageAlert?.show && (
        <div
          style={{
            position: "fixed",
            bottom: "50px",
            right: "10px",
            background: "rgba(255, 100, 100, 0.9)",
            color: "white",
            padding: "8px 12px",
            borderRadius: "6px",
            fontSize: "11px",
            fontFamily: "monospace",
            zIndex: 9999,
            boxShadow: "0 2px 8px rgba(255, 0, 0, 0.5)",
            border: "2px solid #ff6666",
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
            ⚠️ Image Missing
          </div>
          <div style={{ fontSize: "10px", opacity: 0.9 }}>
            {missingImageAlert.panelId}[{missingImageAlert.index}]
          </div>
          <div style={{ fontSize: "9px", opacity: 0.7, marginTop: "2px" }}>
            {missingImageAlert.timestamp}
          </div>
        </div>
      )}

      {/* デバッグ表示切り替えボタン（モバイル対応） */}
      <button
        onClick={() => {
          const newValue = !showDebugPanel;
          setShowDebugPanel(newValue);
          localStorage.setItem('showDebugPanel', String(newValue));
        }}
        style={{
          position: "fixed",
          top: "60px",
          right: "10px",
          background: showDebugPanel ? "rgba(76, 175, 80, 0.9)" : "rgba(158, 158, 158, 0.9)",
          color: "white",
          border: "2px solid white",
          borderRadius: "6px",
          padding: "8px 12px",
          fontSize: "14px",
          fontWeight: "bold",
          cursor: "pointer",
          zIndex: 10001,
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          transition: "all 0.2s ease",
        }}
        title="デバッグ表示の切り替え (U キーでも可)"
      >
        🔍 Debug {showDebugPanel ? "ON" : "OFF"}
      </button>

      {/* デバッグオーバーレイ（U キーまたはボタンで切り替え） */}
      {showDebugPanel && (
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

          {/* ビルドタイムスタンプ表示 */}
          <div style={{
            borderBottom: "1px solid #444",
            paddingBottom: "6px",
            marginBottom: "6px",
            color: "#0ff",
            fontSize: "10px"
          }}>
            🕒 Build: {BUILD_TIMESTAMP}
          </div>

          {/* 画像欠落履歴（デバッグパネル内） */}
          {missingImageAlert?.show && (
            <div style={{
              background: "#ff6666",
              padding: "8px",
              borderRadius: "4px",
              marginBottom: "8px",
              border: "2px solid #fff",
            }}>
              <div style={{ fontWeight: "bold", marginBottom: "4px", fontSize: "11px", color: "#fff" }}>
                ⚠️ Image Missing Detected!
              </div>
              <div style={{ fontSize: "10px", color: "#fff" }}>
                Panel: {missingImageAlert.panelId}
              </div>
              <div style={{ fontSize: "10px", color: "#fff" }}>
                Index: {missingImageAlert.index}
              </div>
              <div style={{ fontSize: "9px", color: "#fff", opacity: 0.8, marginTop: "4px" }}>
                {missingImageAlert.timestamp}
              </div>
            </div>
          )}

          {/* Unity画像プレビュー */}
          <div style={{
            background: "#1a1a1a",
            padding: "8px",
            borderRadius: "4px",
            marginBottom: "8px",
            border: "2px solid #0ff",
          }}>
            <div style={{ fontWeight: "bold", marginBottom: "6px", fontSize: "12px", color: "#0ff" }}>
              🖼️ Unity Textures
            </div>
            {[0, 1, 2].map((index) => {
              const img = unityImagesRef.current.get(index);
              const hasImage = !!img && !!img.src;
              const isActive = activeUnityIndexes.current.has(index);

              return (
                <div key={index} style={{
                  marginBottom: "8px",
                  padding: "6px",
                  background: isActive ? "rgba(0, 255, 0, 0.1)" : "rgba(100, 100, 100, 0.1)",
                  borderRadius: "4px",
                  border: `2px solid ${isActive ? "#0f0" : "#666"}`,
                }}>
                  <div style={{ fontSize: "10px", marginBottom: "4px", fontWeight: "bold", color: isActive ? "#0f0" : "#999" }}>
                    Index {index} {isActive ? "🟢 ACTIVE" : "⚫ INACTIVE"}
                  </div>
                  {hasImage ? (
                    <img
                      src={img.src}
                      alt={`Unity texture ${index}`}
                      style={{
                        width: "100%",
                        height: "auto",
                        borderRadius: "4px",
                        border: "1px solid #666",
                        display: "block",
                      }}
                    />
                  ) : (
                    <div style={{
                      width: "100%",
                      height: "60px",
                      background: "#000",
                      borderRadius: "4px",
                      border: "1px solid #666",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#666",
                      fontSize: "10px",
                    }}>
                      No Image
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* スクロール・可視判定情報 */}
          <div style={{
            background: "#1a1a1a",
            padding: "8px",
            borderRadius: "4px",
            marginBottom: "8px",
            border: "2px solid #ff0",
          }}>
            <div style={{ fontWeight: "bold", marginBottom: "6px", fontSize: "12px", color: "#ff0" }}>
              📊 Scroll & Visibility
            </div>

            <div style={{ fontSize: "10px", marginBottom: "4px" }}>
              Raw ScrollTop: <span style={{ color: "#0ff", fontWeight: "bold" }}>{scrollDebugInfo.scrollTop}px</span>
            </div>
            <div style={{ fontSize: "10px", marginBottom: "4px" }}>
              Scale: <span style={{ color: "#0ff", fontWeight: "bold" }}>{scrollDebugInfo.scale.toFixed(3)}</span>
            </div>
            <div style={{ fontSize: "10px", marginBottom: "8px", paddingBottom: "4px", borderBottom: "1px dashed #444" }}>
              Visible Range: <span style={{ color: "#0f0", fontWeight: "bold" }}>{scrollDebugInfo.visibleRangeTop} ~ {scrollDebugInfo.visibleRangeBottom}</span>
            </div>

            {scrollDebugInfo.panels.map((panel, idx) => (
              <div key={panel.id} style={{
                fontSize: "9px",
                marginBottom: "4px",
                padding: "4px",
                background: panel.isVisible ? "rgba(0, 255, 0, 0.1)" : "rgba(255, 0, 0, 0.1)",
                borderLeft: `3px solid ${panel.isVisible ? "#0f0" : "#f00"}`,
                paddingLeft: "6px",
              }}>
                <div style={{ fontWeight: "bold", marginBottom: "2px" }}>
                  {panel.id} {panel.isVisible ? "✅" : "❌"}
                </div>
                <div style={{ color: "#ccc" }}>
                  Y: {panel.y} ~ {panel.bottom} (H: {panel.height})
                </div>
                <div style={{ color: panel.isVisible ? "#0f0" : "#f00" }}>
                  Visibility: {panel.visibilityRatio}%
                </div>
              </div>
            ))}
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
              Press [U] or tap button to toggle
            </div>

            {/* リアルタイムログ表示 */}
            <div style={{ borderTop: "1px solid #444", paddingTop: "8px", marginTop: "8px" }}>
              <div style={{ fontWeight: "bold", marginBottom: "4px", fontSize: "11px", color: "#0ff" }}>
                📋 Real-time Logs (last 20)
              </div>
              <div style={{
                background: "#0a0a0a",
                padding: "4px",
                borderRadius: "4px",
                fontSize: "9px",
                maxHeight: "150px",
                overflow: "auto",
                fontFamily: "monospace",
                lineHeight: "1.3",
              }}>
                {debugLogs.length === 0 ? (
                  <div style={{ color: "#666" }}>No logs yet...</div>
                ) : (
                  debugLogs.map((log, i) => (
                    <div key={i} style={{ color: "#0f0" }}>
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

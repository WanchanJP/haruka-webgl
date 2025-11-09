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

  // Unity受信ブリッジのインストールとキャプチャ受信
  useEffect(() => {
    console.log("[PanelCanvas] Installing Unity receiver bridge");
    installUnityReceiverBridge();

    const unsubscribe = captureManager.onImage((b64, w, h, index) => {
      console.log(
        `[PanelCanvas] Received Unity capture: ${b64.length} chars, ${w}x${h}, index=${index}`
      );

      // index ベースで Unity 画像を保存
      let img = unityImagesRef.current.get(index);
      if (!img) {
        console.log(`[PanelCanvas] Creating new Image for index ${index}`);
        img = new Image();
        unityImagesRef.current.set(index, img);
        img.onload = () => {
          console.log(`[PanelCanvas] Unity image loaded for index ${index}, requesting redraw`);
          setNeedsRedraw(true);
        };
      } else {
        // 既存の画像を更新
        img.onload = () => {
          console.log(`[PanelCanvas] Unity image updated for index ${index}, requesting redraw`);
          setNeedsRedraw(true);
        };
      }
      img.src = `data:image/png;base64,${b64}`;
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
      `[updateVisibleRange] Range: ${newRange.top.toFixed(0)}-${newRange.bottom.toFixed(0)}, Visible panels:`,
      Array.from(newVisibleIds)
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

    // CaptureManager に可視状態を通知（Unityパネルが可視範囲にある場合のみ）
    const hasVisibleUnityPanels = scene.panels.some(
      (p) => p.source?.type === "unity" && newVisibleIds.has(p.id)
    );

    console.log(
      `[updateVisibleRange] Unity panels visible: ${hasVisibleUnityPanels}, calling setVisibleState(${hasVisibleUnityPanels})`
    );

    captureManager.setVisibleState(hasVisibleUnityPanels);

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

    // Unity初期化完了を待って再度チェック
    let unityCheckAttempts = 0;
    const maxAttempts = 60; // 最大30秒待つ（500ms × 60）
    const unityCheckInterval = setInterval(() => {
      unityCheckAttempts++;
      if ((window as any).unityInstance) {
        console.log("[PanelCanvas] Unity instance ready, running updateVisibleRange");
        clearInterval(unityCheckInterval);
        updateVisibleRange();
      } else if (unityCheckAttempts >= maxAttempts) {
        console.warn("[PanelCanvas] Unity instance check timeout");
        clearInterval(unityCheckInterval);
      }
    }, 500);

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
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
    </div>
  );
}

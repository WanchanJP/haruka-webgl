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
  const [visibleRange, setVisibleRange] = useState<VisibleRange>({
    top: 0,
    bottom: 0,
  });
  const [visiblePanelIds, setVisiblePanelIds] = useState<Set<PanelID>>(
    new Set()
  );
  const [needsRedraw, setNeedsRedraw] = useState(true);

  // 画像プリロード
  useEffect(() => {
    const imageSrcs = scene.panels
      .map((p) => p.imageSrc)
      .filter((src): src is string => !!src);

    if (imageSrcs.length === 0) return;

    preloadImages(imageSrcs).then((cache) => {
      setImageCache(cache);
      setNeedsRedraw(true);
    });
  }, [scene]);

  // Canvas描画関数
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const options: DrawOptions = {
      debug,
      showMask,
      imageCache,
    };

    drawScene(ctx, scene, options);
  }, [scene, debug, showMask, imageCache]);

  // 可視範囲の更新
  const updateVisibleRange = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const newRange = getVisibleRangeFromContainer(container);
    setVisibleRange(newRange);

    // 可視パネルの計算
    const visible = getVisiblePanels(
      scene.panels,
      newRange,
      scene.viewportWidth,
      0.1
    );

    const newVisibleIds = new Set(visible.map((p) => p.id));

    // Enter/Leaveイベントの発火
    newVisibleIds.forEach((id) => {
      if (!visiblePanelIds.has(id)) {
        onPanelEnter?.(id);
      }
    });

    visiblePanelIds.forEach((id) => {
      if (!newVisibleIds.has(id)) {
        onPanelLeave?.(id);
      }
    });

    setVisiblePanelIds(newVisibleIds);

    if (debug) {
      console.log(
        `[PanelCanvas] Visible range: ${newRange.top.toFixed(0)} - ${newRange.bottom.toFixed(0)}`,
        `Panels: [${Array.from(newVisibleIds).join(", ")}]`
      );
    }

    setNeedsRedraw(true);
  }, [scene, visiblePanelIds, onPanelEnter, onPanelLeave, debug]);

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

    handleResize();
    updateVisibleRange();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
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

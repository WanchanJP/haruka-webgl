import type { Panel, SceneSpec } from "./panel-types";

/**
 * Canvas描画オプション
 */
export type DrawOptions = {
  debug?: boolean; // 枠線・ID・中心点を表示
  showMask?: boolean; // マスク境界を可視化
  imageCache?: Map<string, HTMLImageElement>; // 画像キャッシュ
  getUnityImage?: (index: number) => HTMLImageElement | undefined; // Unity画像取得関数
};

/**
 * デバイスピクセル比を取得
 */
export function getDevicePixelRatio(): number {
  return window.devicePixelRatio || 1;
}

/**
 * Canvasをデバイスピクセル比に合わせて初期化
 */
export function setupCanvasForHighDPI(
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number
): CanvasRenderingContext2D {
  const dpr = getDevicePixelRatio();
  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(cssHeight * dpr);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get 2D context");
  }

  // スケーリングを適用
  ctx.scale(dpr, dpr);

  return ctx;
}

/**
 * マスクを適用してパネルのクリップパスを設定
 */
function applyPanelMask(
  ctx: CanvasRenderingContext2D,
  panel: Panel
): void {
  const { transform, mask } = panel;
  const { width, height } = transform;

  if (!mask) {
    // マスクなしの場合は通常の矩形
    ctx.rect(0, 0, width, height);
    return;
  }

  const top = mask.top ?? 0;
  const right = mask.right ?? 0;
  const bottom = mask.bottom ?? 0;
  const left = mask.left ?? 0;

  // マスク適用後の矩形
  const x = left;
  const y = top;
  const w = width - left - right;
  const h = height - top - bottom;

  ctx.rect(x, y, Math.max(0, w), Math.max(0, h));
}

/**
 * 単一パネルを描画
 */
export function drawPanel(
  ctx: CanvasRenderingContext2D,
  panel: Panel,
  options: DrawOptions = {}
): void {
  const { transform, fill, imageSrc, source } = panel;
  const { x, y, width, height, rotation = 0, opacity = 1 } = transform;

  ctx.save();

  // 不透明度
  ctx.globalAlpha = opacity;

  // 移動
  ctx.translate(x, y);

  // 回転（中心基準）
  if (rotation !== 0) {
    const cx = width / 2;
    const cy = height / 2;
    ctx.translate(cx, cy);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  // マスク適用
  ctx.save();
  ctx.beginPath();
  applyPanelMask(ctx, panel);
  ctx.clip();

  // 背景塗り
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, width, height);
  }

  // 画像ソースに基づいて描画
  if (source) {
    // source が指定されている場合は source を優先
    if (source.type === "unity" && options.getUnityImage) {
      const img = options.getUnityImage(source.index);
      if (img && img.complete) {
        ctx.drawImage(img, 0, 0, width, height);
      }
    } else if (source.type === "image" && options.imageCache) {
      const img = options.imageCache.get(source.src);
      if (img && img.complete) {
        ctx.drawImage(img, 0, 0, width, height);
      }
    }
    // source.type === "none" の場合は何も描画しない
  } else if (imageSrc && options.imageCache) {
    // 後方互換性: imageSrc が指定されている場合（非推奨）
    const img = options.imageCache.get(imageSrc);
    if (img && img.complete) {
      ctx.drawImage(img, 0, 0, width, height);
    }
  }

  ctx.restore(); // マスククリップ解除

  // デバッグ表示
  if (options.debug) {
    // 枠線
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, width, height);

    // 中心点
    const cx = width / 2;
    const cy = height / 2;
    ctx.fillStyle = "#ff0000";
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();

    // ID表示
    ctx.fillStyle = "#00ff00";
    ctx.font = "14px monospace";
    ctx.fillText(panel.id, 5, 20);

    // 回転角度表示
    if (rotation !== 0) {
      ctx.fillText(`${rotation}°`, 5, 40);
    }
  }

  // マスク境界の可視化
  if (options.showMask && panel.mask) {
    const { top = 0, right = 0, bottom = 0, left = 0 } = panel.mask;
    ctx.strokeStyle = "#ff00ff";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(left, top, width - left - right, height - top - bottom);
    ctx.setLineDash([]);
  }

  ctx.restore();
}

/**
 * シーン全体を描画
 */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: SceneSpec,
  options: DrawOptions = {}
): void {
  // キャンバスをクリア
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // 背景
  ctx.fillStyle = "#f5f5f5";
  ctx.fillRect(0, 0, scene.viewportWidth, ctx.canvas.height);

  // パネルを描画順にソート（zIndex → y座標）
  const sortedPanels = [...scene.panels].sort((a, b) => {
    const zDiff = (a.transform.zIndex ?? 0) - (b.transform.zIndex ?? 0);
    if (zDiff !== 0) return zDiff;
    return a.transform.y - b.transform.y;
  });

  // 各パネルを描画
  sortedPanels.forEach((panel) => {
    drawPanel(ctx, panel, options);
  });

  // デバッグ情報（全体）
  if (options.debug) {
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(10, 10, 200, 30);
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px monospace";
    ctx.fillText(`Panels: ${scene.panels.length}`, 15, 30);
    ctx.restore();
  }
}

/**
 * 画像をプリロード
 */
export async function preloadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * 複数画像を一括プリロード
 */
export async function preloadImages(
  srcs: string[]
): Promise<Map<string, HTMLImageElement>> {
  const cache = new Map<string, HTMLImageElement>();

  await Promise.all(
    srcs.map(async (src) => {
      try {
        const img = await preloadImage(src);
        cache.set(src, img);
      } catch (error) {
        console.warn(`Failed to load image: ${src}`, error);
      }
    })
  );

  return cache;
}

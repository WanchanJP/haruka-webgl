import type { Panel, PanelID, VisibleRange } from "./panel-types";

/**
 * 矩形交差判定
 */
export function rectIntersects(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

/**
 * 交差面積を計算（可視割合の算出に使用）
 */
export function rectIntersectionArea(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): number {
  const xOverlap = Math.max(
    0,
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  );
  const yOverlap = Math.max(
    0,
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  );
  return xOverlap * yOverlap;
}

/**
 * パネルの可視割合を計算（0.0 ~ 1.0）
 */
export function calculateVisibilityRatio(
  panel: Panel,
  visibleRange: VisibleRange,
  viewportWidth: number
): number {
  const { transform } = panel;
  const panelRect = {
    x: transform.x,
    y: transform.y,
    width: transform.width,
    height: transform.height,
  };

  const viewportRect = {
    x: 0,
    y: visibleRange.top,
    width: viewportWidth,
    height: visibleRange.bottom - visibleRange.top,
  };

  const intersectionArea = rectIntersectionArea(panelRect, viewportRect);
  const panelArea = panelRect.width * panelRect.height;

  if (panelArea === 0) return 0;
  return Math.min(1, intersectionArea / panelArea);
}

/**
 * 可視範囲内のパネルをフィルタリング
 */
export function getVisiblePanels(
  panels: Panel[],
  visibleRange: VisibleRange,
  viewportWidth: number,
  threshold = 0.1 // 10%以上可視で「可視」扱い
): Panel[] {
  return panels.filter((panel) => {
    const ratio = calculateVisibilityRatio(panel, visibleRange, viewportWidth);
    return ratio >= threshold;
  });
}

/**
 * IntersectionObserver用のヘルパー
 * パネル要素にdata-panel-id属性を付けておき、可視状態を監視
 */
export function createPanelObserver(
  onEnter: (id: PanelID) => void,
  onLeave: (id: PanelID) => void,
  threshold = 0.1
): IntersectionObserver {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const id = entry.target.getAttribute("data-panel-id");
        if (!id) return;

        if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
          onEnter(id);
        } else if (!entry.isIntersecting || entry.intersectionRatio < threshold) {
          onLeave(id);
        }
      });
    },
    {
      threshold: [0, threshold, 0.5, 1.0],
      rootMargin: "0px",
    }
  );

  return observer;
}

/**
 * スクロールコンテナから可視範囲を取得
 */
export function getVisibleRangeFromContainer(
  container: HTMLElement
): VisibleRange {
  return {
    top: container.scrollTop,
    bottom: container.scrollTop + container.clientHeight,
  };
}

/**
 * アンカーY座標がパネルの範囲内にあるかを判定
 * @param panel パネル
 * @param anchorY アンカーY座標（例: ビューポート中央やボトムのY座標）
 * @returns アンカーがパネル範囲内にあれば true
 */
export function isPanelAnchoredVisible(
  panel: Panel,
  anchorY: number
): boolean {
  const top = panel.transform.y;
  const bottom = top + panel.transform.height;
  return anchorY >= top && anchorY < bottom;
}

export type PanelID = string;

export type PanelMask = {
  top?: number; // px
  right?: number;
  bottom?: number;
  left?: number;
};

export type PanelTransform = {
  x: number; // px, 左上基準
  y: number; // px, 上からのオフセット
  width: number; // px
  height: number; // px
  rotation?: number; // deg, 中心回転
  opacity?: number; // 0..1
  zIndex?: number; // 描画順
};

/**
 * パネルの画像ソース定義
 */
export type PanelSource =
  | { type: "none" }
  | { type: "image"; src: string }
  | { type: "unity"; index: number };

export type Panel = {
  id: PanelID;
  transform: PanelTransform;
  mask?: PanelMask;
  source?: PanelSource; // 画像ソース（unity/image/none）
  imageSrc?: string; // @deprecated 後方互換性のため残す。source を優先
  fill?: string; // デバッグ用の塗り色
};

export type SceneSpec = {
  viewportWidth: number; // 想定のベース幅（例：720）
  panels: Panel[];
};

export type VisibleRange = {
  top: number;
  bottom: number;
};

export type PanelVisibilityCallbacks = {
  onPanelEnter?: (id: PanelID) => void;
  onPanelLeave?: (id: PanelID) => void;
};

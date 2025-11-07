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

export type Panel = {
  id: PanelID;
  transform: PanelTransform;
  mask?: PanelMask;
  // 将来拡張用：画像/動画/Unityキャプチャのプレースホルダ
  imageSrc?: string; // 任意
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

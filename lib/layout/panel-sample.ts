import type { SceneSpec } from "./panel-types";

/**
 * ダミーパネルデータ（縦スクロール漫画風）
 * 様々なサイズ・マスク・回転を含む
 */
export const sampleScene: SceneSpec = {
  viewportWidth: 720,
  panels: [
    // Panel 0: Unity Live キャプチャ（最上部）
    {
      id: "unity-live-1",
      transform: {
        x: 60,
        y: 40,
        width: 600,
        height: 400,
        zIndex: 1,
        opacity: 1,
      },
      fill: "#263238",
      source: { type: "unity", index: 0 },
    },

    // Panel 1: タイトル風（大きめ、マスクなし）
    {
      id: "panel-1",
      transform: {
        x: 60,
        y: 480,
        width: 600,
        height: 400,
        zIndex: 1,
        opacity: 1,
      },
      fill: "#e3f2fd",
      source: { type: "image", src: "/sample/p1.svg" },
    },

    // Panel 2: 左寄せ、軽いマスク
    {
      id: "panel-2",
      transform: {
        x: 40,
        y: 920,
        width: 320,
        height: 280,
        zIndex: 1,
      },
      mask: {
        top: 10,
        right: 5,
        bottom: 10,
        left: 5,
      },
      fill: "#fff3e0",
    },

    // Unity Live 2: 小さめ、回転あり（同一ストリーム index:0）
    {
      id: "unity-live-2",
      transform: {
        x: 380,
        y: 900,
        width: 320,
        height: 240,
        rotation: -2,
        zIndex: 2,
      },
      fill: "#1a1a2e",
      source: { type: "unity", index: 0 },
    },

    // Panel 3: 右寄せ、回転あり
    {
      id: "panel-3",
      transform: {
        x: 380,
        y: 1180,
        width: 300,
        height: 240,
        rotation: 3,
        zIndex: 2,
      },
      mask: {
        top: 8,
        right: 8,
        bottom: 8,
        left: 8,
      },
      fill: "#f3e5f5",
      source: { type: "image", src: "/sample/p2.svg" },
    },

    // Panel 4: フルワイド、薄いマスク
    {
      id: "panel-4",
      transform: {
        x: 20,
        y: 1260,
        width: 680,
        height: 350,
        zIndex: 1,
      },
      mask: {
        top: 15,
        right: 15,
        bottom: 15,
        left: 15,
      },
      fill: "#e8f5e9",
    },

    // Panel 5: 中央、縦長
    {
      id: "panel-5",
      transform: {
        x: 160,
        y: 1650,
        width: 400,
        height: 500,
        zIndex: 1,
      },
      mask: {
        top: 12,
        bottom: 12,
      },
      fill: "#fce4ec",
      source: { type: "image", src: "/sample/p3.svg" },
    },

    // Panel 6: 左上、小さめ、回転
    {
      id: "panel-6",
      transform: {
        x: 50,
        y: 2190,
        width: 280,
        height: 200,
        rotation: -5,
        zIndex: 2,
      },
      fill: "#fff9c4",
    },

    // Panel 7: 右下、斜め配置
    {
      id: "panel-7",
      transform: {
        x: 400,
        y: 2240,
        width: 260,
        height: 220,
        rotation: 8,
        zIndex: 3,
      },
      mask: {
        top: 10,
        right: 10,
        bottom: 10,
        left: 10,
      },
      fill: "#e0f2f1",
    },

    // Unity Live 3: ワイドパネル、不透明度調整
    {
      id: "unity-live-3",
      transform: {
        x: 40,
        y: 2520,
        width: 640,
        height: 360,
        opacity: 0.95,
        zIndex: 1,
      },
      mask: {
        top: 20,
        right: 20,
        bottom: 20,
        left: 20,
      },
      fill: "#0f1419",
      source: { type: "unity", index: 0 },
    },

    // Panel 9: 縦長、中央配置
    {
      id: "panel-9",
      transform: {
        x: 210,
        y: 2860,
        width: 300,
        height: 450,
        zIndex: 1,
      },
      fill: "#e1f5fe",
    },

    // Panel 10: 左寄せ、マスク大
    {
      id: "panel-10",
      transform: {
        x: 60,
        y: 3360,
        width: 280,
        height: 320,
        rotation: -3,
        zIndex: 2,
      },
      mask: {
        top: 25,
        right: 15,
        bottom: 25,
        left: 15,
      },
      fill: "#f1f8e9",
    },

    // Panel 11: 右寄せ、重ね合わせ
    {
      id: "panel-11",
      transform: {
        x: 380,
        y: 3380,
        width: 300,
        height: 280,
        rotation: 5,
        zIndex: 3,
      },
      fill: "#fce4ec",
    },

    // Panel 12: ワイド、最下部
    {
      id: "panel-12",
      transform: {
        x: 40,
        y: 3720,
        width: 640,
        height: 400,
        zIndex: 1,
      },
      mask: {
        top: 18,
        right: 18,
        bottom: 18,
        left: 18,
      },
      fill: "#ede7f6",
    },

    // Panel 13: 小パネル、装飾的配置
    {
      id: "panel-13",
      transform: {
        x: 100,
        y: 4180,
        width: 200,
        height: 180,
        rotation: -8,
        zIndex: 4,
      },
      fill: "#fff3e0",
    },

    // Panel 14: 小パネル、右配置
    {
      id: "panel-14",
      transform: {
        x: 450,
        y: 4200,
        width: 220,
        height: 200,
        rotation: 6,
        zIndex: 4,
      },
      fill: "#e0f7fa",
    },

    // Panel 15: エンディング風、大きめ
    {
      id: "panel-15",
      transform: {
        x: 110,
        y: 4440,
        width: 500,
        height: 450,
        zIndex: 1,
      },
      mask: {
        top: 20,
        right: 20,
        bottom: 20,
        left: 20,
      },
      fill: "#f3e5f5",
    },

    // Panel 16: ラストパネル
    {
      id: "panel-16",
      transform: {
        x: 160,
        y: 4960,
        width: 400,
        height: 300,
        zIndex: 1,
      },
      fill: "#e8eaf6",
    },
  ],
};

/**
 * シーンの総高さを計算
 */
export function calculateSceneHeight(scene: SceneSpec): number {
  if (scene.panels.length === 0) return 0;

  let maxBottom = 0;
  scene.panels.forEach((panel) => {
    const bottom = panel.transform.y + panel.transform.height;
    if (bottom > maxBottom) {
      maxBottom = bottom;
    }
  });

  // 下部にパディングを追加
  return maxBottom + 100;
}

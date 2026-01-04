// Unity WebGL を dynamic import でクライアントサイドのみで読み込むラッパーコンポーネント
// Next.js App Router の場合は dynamic を使って SSR を無効化する

import dynamic from "next/dynamic";
import { LoadingOverlay } from "../common/LoadingOverlay";

export const LazyUnityHost = dynamic(() => import("./UnityHost"), {
  ssr: false,
  loading: () => <LoadingOverlay />,
});

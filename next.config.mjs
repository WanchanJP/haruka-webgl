// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      {
        // Unity WebGL の .data.gz ファイルに Content-Encoding ヘッダーを追加
        source: "/unity/Build/:path*.data.gz",
        headers: [
          {
            key: "Content-Encoding",
            value: "gzip",
          },
          {
            key: "Content-Type",
            value: "application/octet-stream",
          },
        ],
      },
      {
        // .framework.js.gz に Content-Encoding ヘッダーを追加
        source: "/unity/Build/:path*.framework.js.gz",
        headers: [
          {
            key: "Content-Encoding",
            value: "gzip",
          },
          {
            key: "Content-Type",
            value: "application/javascript",
          },
        ],
      },
      {
        // .wasm.gz には Content-Type と Content-Encoding を追加
        source: "/unity/Build/:path*.wasm.gz",
        headers: [
          {
            key: "Content-Type",
            value: "application/wasm",
          },
          {
            key: "Content-Encoding",
            value: "gzip",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

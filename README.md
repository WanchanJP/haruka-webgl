# Haruka WebGL (Next.js + Unity WebGL)

UnityのWebGLビルドをNext.jsに埋め込み、ブラウザ上で画像転送・描画を行う体験版。

## 開発環境

```bash
# 依存インストール
npm ci

# 開発起動（http://localhost:3000）
npm run dev
````

## Unityビルドの配置

- 出力先: `public/unity/Build/`
    
- 例:
    
    ```
    public/unity/Build/
      haruka.loader.js
      haruka.framework.js
      haruka.data
      haruka.wasm
    ```
    
- `lib/unity.ts` の `buildBase` がビルド名に一致していること（例: `/unity/Build/haruka`）
    

> 開発中は **Compression: Disabled** 推奨（`.br`/`.unityweb` は dev サーバで扱いにくいため）

## API契約（変更禁止）

- ドキュメント: [`/docs/api_contract.md`](https://chatgpt.com/g/g-p-68fcdd8a4a3c819183e1043cce7dddd3/c/docs/api_contract.md)
    
- 固定:
    
    - DOM: `#unity-canvas`, `#rt-canv-0`
        
    - JS: `window.onUnityImageReceived`, `sendMessageToUnity`, `loadUnity`, `window.unityInstance`
        
    - Unity: GameObject `Bridge`, Method `CaptureAndSend`, `.jslib` `ReceiveImageData`
        

## CI

- GitHub Actions: `npm ci` → `lint` → `typecheck` → `build`
    

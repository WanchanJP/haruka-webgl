# ---- build stage ----
FROM node:20-bookworm-slim AS build
WORKDIR /app

# 依存だけ先にコピー→インストール（キャッシュ効かせる）
COPY package*.json ./
# dev依存が必要な場合が多いので一度全部入れる
RUN npm ci

# 残りのソース
COPY . .
# Next.js ビルド（必要に応じて環境変数は --build-arg で）
RUN npm run build

# ---- runtime stage ----
FROM node:20-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app

# 実行に必要な生成物のみコピー
COPY --from=build /app/ ./

# 実行時は本番依存だけに（ロックに従って prune）
RUN npm prune --omit=dev

EXPOSE 3000
# 0.0.0.0 で待ち受け、ポートは 3000
CMD ["npm", "start", "--", "-p", "3000", "-H", "0.0.0.0"]

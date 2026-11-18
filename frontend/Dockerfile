# UNTESTED in this repo's CI/dev machine (Docker was not available when written) — see docs/DECISIONS.md.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Baked into the bundle at build time (what the BROWSER calls). VITE_TILE_* etc. come from frontend/.env if present.
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL NITRO_PRESET=node-server
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=build /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]

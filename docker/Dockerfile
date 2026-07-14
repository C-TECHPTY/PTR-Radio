FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/
RUN npm install
COPY frontend ./frontend
COPY backend ./backend
RUN npm run build -w frontend

FROM node:22-bookworm-slim AS production
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm install --omit=dev -w backend && npm cache clean --force
COPY backend ./backend
COPY --from=build /app/frontend/dist ./frontend/dist
RUN mkdir -p /app/database && chown -R node:node /app
USER node
EXPOSE 8091
CMD ["npm", "run", "start", "-w", "backend"]

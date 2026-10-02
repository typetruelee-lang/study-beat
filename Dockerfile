# FOCUS CLAY web site: app (/) + sound engine & demo (/engine/)
#   docker build -t focus-clay . && docker run -p 8080:8080 focus-clay
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:site

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=build /app/dist ./dist
COPY server ./server
USER node
EXPOSE 8080
CMD ["node", "server/index.mjs"]

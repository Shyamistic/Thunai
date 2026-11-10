# docker build --build-arg VITE_CARTO_KEY=... -t thunai .
# docker run -p 8787:8787 -e GNANI_API_KEY=... -e PUBLIC_DEMO=1 thunai
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_CARTO_KEY=""
ENV VITE_CARTO_KEY=$VITE_CARTO_KEY
RUN npm run build
ENV PORT=8787
EXPOSE 8787
CMD ["npm", "start"]

FROM mcr.microsoft.com/playwright:v1.62.0-noble

WORKDIR /app

RUN npm install -g @getgauge/cli && gauge install ts

COPY package*.json ./
RUN npm ci

COPY . .

CMD ["gauge", "run", "specs"]

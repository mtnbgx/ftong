# 基础镜像
FROM node:16-bullseye-slim AS build
# 设置工作目录
WORKDIR /app
# 复制 package.json 和 package-lock.json
COPY package*.json ./
# 安装依赖
RUN npm install --production && npm i typescript -g
# 复制代码
COPY . .
# 构建项目
RUN tsc

FROM node:16-bullseye-slim AS production
# 设定工作目录
WORKDIR /app
# 拷贝 package.json 和 package-lock.json 文件到容器内
COPY package*.json ./
# 安装依赖
RUN npm install --production
# link
RUN npm link
# 复制代码
COPY --from=build /app/dist ./dist
# CMD
CMD ["npm","run","bin","--","-r"]
# ftong 

> 利用Webrtc进行内网传输文件的小工具

开发背景是需要从vps上传输文件到家里内网中的nas服务器

## 使用指南

接收

```sh
ftong -r 
# 获得id可在发送时使用
```

发送

```sh
ftong -s -t xxx -f foo.png
```

### 安装


> 可执行文件

自行到releases下载对应平台执行文件

```sh
wget xxx
mv ftong-linux-x64 ftong
ftong -r
```

> 编译

```sh
git clone https://github.com/mtnbgx/ftong.git
npm install
npx tsc
npm link
ftong -r
```

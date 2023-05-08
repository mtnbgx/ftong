# ftong 

> 利用Webrtc进行P2P传输文件的小工具

开发背景是个人需要从服务器上传输文件到家里内网中的nas服务器，便开发出来的小工具。文件传输使用P2P传输，双方都无需有公网ip。

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

## 私有部署服务端

这里首先感谢laf免费提供的云函数

正常是无需部署服务端的，默认连接的是我部署上去的云函数，当然你有需要也可以自己部署一个

### 服务端源码
> server/laf

### 相关引用
- [Laf文档](https://doc.laf.run/guide/function/)

- [Laf的Websocket](https://doc.laf.run/guide/function/websocket.html)

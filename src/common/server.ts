import Peer from 'simple-peer'
import fs from 'fs'
const wrtc = require('wrtc')
import WebSocket from 'ws'
import { EventEmitter } from 'events'
import { generateStr, md5, pipe } from './common'
import path from 'path'
import { Writable } from 'stream'

const url = "wss://d75mnq.laf.run/__websocket__"

interface ServerOptions {
    receiveDir?: string
    password?: string
}

export class Server extends EventEmitter {
    ws!: WebSocket | null
    id!: string
    options: ServerOptions
    closed = false
    heartbeatTimeout: NodeJS.Timeout | null = null;
    constructor(id?: string, options?: ServerOptions) {
        super()
        if (id) {
            this.id = id
        }
        this.options = options || {}
        this.connect()
    }

    private connect() {
        const ws = new WebSocket(url)
        ws.onopen = this.onOpen.bind(this);
        ws.onmessage = this.onMessage.bind(this);
        ws.onclose = this.onClose.bind(this);
        ws.onerror = this.onError.bind(this);
        this.ws = ws
    }

    private onOpen() {
        console.debug("ws connected");
        if (this.id) {
            this.send({ id: this.id })
        } else {
            this.send({ query: 'id' })
        }
        this.startHeartbeat();
    }

    private onMessage(res: WebSocket.MessageEvent) {
        const str = res.data.toString()
        if (str === 'ping' || str === 'pong') {
            return
        }
        try {
            const data = JSON.parse(str)
            if (data.type === 'auth') {
                const isPasswordValid = !this.options.password || md5(this.options.password) === data.password;
                if (isPasswordValid) {
                    this.receiveFile(data.from, data.no);
                } else {
                    console.log('用户密码验证失败', data.from);
                }
            }
            if (data.type === 'signal') {
                this.emit(`signal-${data.from}-${data.no}`, data)
            }
            // 未设置id的话使用消息设置
            if (data.type === 'sys' && data.id) {
                this.id = data.id
                this.emit('connect', data.id)
            }
            if (data.type === 'err') {
                console.error('err', data)
            }
        } catch (e) {

        }
    }

    private onClose(event: WebSocket.CloseEvent) {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.stopHeartbeat();
        this.reconnect();
    }

    private onError(event: WebSocket.ErrorEvent) {
        console.log('WebSocket error:', event);
    }

    private reconnect() {
        if (this.closed) {
            return
        }
        setTimeout(() => {
            this.connect();
        }, 2000);
    }

    close() {
        if (this.ws) {
            this.closed = true
            this.stopHeartbeat();
            this.ws.close();
            this.ws = null
            console.log('WebSocket closed');
        }
    }

    private startHeartbeat() {
        this.heartbeatTimeout = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send('ping');
            }
        }, 30 * 1000);
    }

    private stopHeartbeat() {
        if (this.heartbeatTimeout) {
            clearInterval(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
        }
    }

    send(data: object) {
        if (this.ws) {
            this.ws.send(JSON.stringify(data))
        }
    }

    // 回复
    reply(data: any, newData: object) {
        this.send({ ...newData, from: data.to, to: data.from })
    }

    async sendFile(to: string, filePath: string) {
        const exist = fs.existsSync(filePath)
        if (!exist) {
            throw Error('文件不存在')
        }
        const no = generateStr()
        const password = this.options.password ? md5(this.options.password) : ''
        this.send({ type: 'auth', to, from: this.id, no, password })
        const peer = new DataPeer({ id: this.id, to, server: this, initiator: false, filePath, no })
        return peer.start()
    }

    async receiveFile(to: string, no: string) {
        try {
            const peer = new DataPeer({ id: this.id, to, server: this, initiator: true, no })
            return await peer.start()
        } catch (e) {
            console.error(e)
        }
    }
}


interface Option {
    initiator: boolean
    id: string
    to: string
    server: Server
    filePath?: string
    // 随机字符串 防止并发时消息错乱
    no: string
}

class DataPeer {
    options: Option
    peer: Peer.Instance
    connected = false
    fail = false
    constructor(options: Option) {
        this.options = options
        this.peer = new Peer({ initiator: this.options.initiator, wrtc: wrtc, objectMode: true })
    }

    send(obj: object) {
        this.peer.send(JSON.stringify(obj))
    }

    start() {
        return new Promise((resolve, reject) => {
            this.peer.on('signal', data => {
                // 发送消息
                this.options.server.send({ from: this.options.id, to: this.options.to, no: this.options.no, type: 'signal', data })
            })
            this.options.server.on(`signal-${this.options.to}-${this.options.no}`, d => {
                this.peer.signal(d.data)
            })

            this.peer.on('connect', () => {
                console.log('peer connect')
                this.connected = true
                if (this.options.filePath) {
                    const readStream = fs.createReadStream(this.options.filePath)
                    const name = path.basename(this.options.filePath)
                    const info = { type: 'file-info', action: 'start', name }
                    this.send(info)
                    pipe(readStream, this.peer)
                    readStream.on('end', () => {
                        info.action = 'end'
                        this.send(info)
                        this.peer.end()
                    })
                }
            })

            let stream: Writable | null
            this.peer.on('data', d => {
                if (typeof d === 'string') {
                    try {
                        const { action, name } = JSON.parse(d)
                        if (action === 'start') {
                            console.log('The received file name is %s', name)
                            stream = fs.createWriteStream(path.join(this.options.server.options.receiveDir || './tmp', `rec_${name}`))
                        }
                        if (action === 'end') {
                            stream?.end()
                            stream = null
                        }
                    } catch (e) {
                        console.error('peer data Json fail', e)
                    }
                }
                if (typeof d === 'object') {
                    stream?.write(d)
                }
            })

            this.peer.on('error', d => {
                console.log('peer error', d)
                this.fail = true
            })

            let timer: NodeJS.Timeout
            this.peer.on('end', () => {
                console.log('peer end')
                if (timer) {
                    clearTimeout(timer)
                }
                if (stream) {
                    stream.end()
                }
                // 移除监听器
                this.options.server.removeAllListeners(`signal-${this.options.to}-${this.options.no}`)
                if (!this.fail) {
                    resolve(true)
                } else {
                    reject(false)
                }
                //@ts-ignore
                this.peer = null
            })

            // 10秒还没连接成功就关闭吧
            timer = setTimeout(() => {
                if (!this.connected) {
                    this.fail = true
                    this.peer.end()
                }
            }, 10 * 1000)
        })
    }
}
import Peer from 'simple-peer'
import fs from 'fs'
const wrtc = require('wrtc')
import WebSocket from 'ws'
import { EventEmitter } from 'events'
import { generateStr, pipe } from './common'
import path from 'path'
import { Writable } from 'stream'

const url = "wss://d75mnq.laf.run/__websocket__"

export class Server extends EventEmitter {
    wss: WebSocket
    id!: string
    closed = false
    constructor(id?: string) {
        super()
        if (id) {
            this.id = id
        }
        this.wss = this.reconnect(id)
    }

    reconnect(id?: string) {
        const wss = new WebSocket(url)
        wss.onopen = (socket) => {
            console.debug("connected");
            if (id) {
                this.send({ id })
            } else {
                this.send({ query: 'id' })
            }
            this.heartCheck()
        };

        wss.onmessage = (res) => {
            const str = res.data.toString()
            if (str === 'ping' || str === 'pong') {
                return
            }
            // console.debug("message", str);
            try {
                const data = JSON.parse(str)
                if (data.type === 'auth') {
                    //TODO 后面可以加上密码验证
                    this.receiveFile(data.from, data.no)
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
        };

        wss.onclose = (e) => {
            console.debug("closed");
            if (this.timer) {
                clearInterval(this.timer)
            }
            if (!this.closed) {
                this.wss = this.reconnect()
            }
        }

        return wss
    }

    send(data: object) {
        this.wss.send(JSON.stringify(data))
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
        this.send({ type: 'auth', to, from: this.id, no })
        const peer = new DataPeer({ id: this.id, to, server: this, initiator: false, filePath, no })
        return peer.start()
    }

    receiveFile(to: string, no: string) {
        const peer = new DataPeer({ id: this.id, to, server: this, initiator: true, no })
        return peer.start()
    }

    timer?: NodeJS.Timeout
    heartCheck() {
        if (this.timer) {
            clearInterval(this.timer)
        }
        this.timer = setInterval(() => {
            this.wss.send('ping')
        }, 30 * 1000)
    }

    close() {
        if (this.timer) {
            clearInterval(this.timer)
        }
        this.closed = true
        this.wss.close()
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
                    this.peer.send(JSON.stringify(info))
                    pipe(readStream, this.peer)
                    readStream.on('end', () => {
                        info.action = 'end'
                        this.peer.send(JSON.stringify(info))
                        this.peer.end()
                    })
                }
            })

            let stream: Writable
            this.peer.on('data', d => {
                if (typeof d === 'string') {
                    console.log('peer data', d)
                    try {
                        const { action, name } = JSON.parse(d)
                        if (action === 'start') {
                            stream = fs.createWriteStream(path.join('./tmp', `rec_${name}`))
                        }
                        if (action === 'end') {
                            stream.end()
                        }
                    } catch (e) {
                        console.error('peer data Json fail', e)
                    }
                }
                if (typeof d === 'object') {
                    stream.write(d)
                }
            })

            this.peer.on('error', d => {
                console.log('peer error', d)
                this.fail = true
                reject(false)
            })

            let timer: NodeJS.Timeout
            this.peer.on('end', () => {
                console.log('peer end')
                if (timer) {
                    clearTimeout(timer)
                }
                if (!this.fail) {
                    resolve(true)
                }
                // 移除监听器
                this.options.server.removeAllListeners(`signal-${this.options.to}`)
            })

            // 10秒还没连接成功就关闭吧
            timer = setTimeout(() => {
                if (!this.connected) {
                    this.fail = true
                    reject(false)
                    this.peer.end()
                }
            }, 10 * 1000)
        })
    }
}
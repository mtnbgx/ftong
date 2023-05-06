import Peer from 'simple-peer'
import fs from 'fs'
const wrtc = require('wrtc')
import WebSocket from 'ws'
import { EventEmitter } from 'events'
import { generateStr, pipe } from './common'
import path from 'path'

const url = "wss://d75mnq.laf.run/__websocket__"

export class Server extends EventEmitter {
    wss: WebSocket
    id!: string
    constructor(id?: string) {
        super()
        if (id) {
            this.id = id
        }
        const wss = new WebSocket(url)
        wss.onopen = (socket) => {
            console.debug("connected");
            if (id) {
                this.send({ id })
            } else {
                this.send({ query: 'id' })
            }
        };

        wss.onmessage = (res) => {
            const str = res.data.toString()
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
        }

        this.wss = wss
    }

    send(data: object) {
        this.wss.send(JSON.stringify(data))
    }

    // 回复
    reply(data: any, newData: object) {
        this.send({ ...newData, from: data.to, to: data.from })
    }

    sendFile(to: string, filePath?: string) {
        const no = generateStr()
        this.send({ type: 'auth', to, from: this.id, no })
        new DataPeer({ id: this.id, to, server: this, initiator: false, filePath, no })
    }

    receiveFile(to: string, no: string) {
        new DataPeer({ id: this.id, to, server: this, initiator: true, no })
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
    constructor(options: Option) {
        this.options = options
        this.peer = new Peer({ initiator: options.initiator, wrtc: wrtc, objectMode: true })
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

        this.peer.on('data', d => {
            console.log('peer data', d)
        })

        let timer: NodeJS.Timeout
        this.peer.on('end', () => {
            console.log('peer end')
            if (timer) {
                clearTimeout(timer)
            }
            // 移除监听器
            this.options.server.removeAllListeners(`signal-${this.options.to}`)
        })

        // 10秒还没连接成功就关闭吧
        timer = setTimeout(() => {
            if (!this.connected) {
                this.peer.end()
            }
        }, 10 * 1000)
    }

}
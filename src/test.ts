import Peer from 'simple-peer'
const wrtc = require('wrtc')
import fs from 'fs'
import { Readable, Writable } from 'stream';

function pipe(source: Readable, dest: any) {
    source.on('data', (chunk) => {
        if (dest.writable) {
            dest.send(chunk)
        }
    });
    dest.on('drain', () => {
        source.resume();
    });
    dest.emit('pipe', source);
    return dest;
};

const peer1 = new Peer({ initiator: true, wrtc: wrtc, objectMode: true })
const peer2 = new Peer({ wrtc: wrtc, objectMode: true })

peer1.on('signal', data => {
    // console.log('signal2', data)
    peer2.signal(data)
})

peer2.on('signal', data => {
    // console.log('signal1', data)
    peer1.signal(data)
})

peer1.on('connect', () => {
    const readStream = fs.createReadStream('./test.zip')
    const info = { type: 'file-info', action: 'start', name: 'test.zip' }
    peer1.send(JSON.stringify(info))

    // readStream.pipe(peer1, { end: false })
    pipe(readStream, peer1)
    readStream.on('end', () => {
        info.action = 'end'
        peer1.send(JSON.stringify(info))
        peer1.end()
    })
})

peer2.on('connect', () => {
})

const stream = fs.createWriteStream('./2.zip')
peer2.on('data', data => {
    console.log(typeof data, data)
    if (typeof data === 'object') {
        stream.write(data)
    }
})

peer2.on('end', () => {
    console.log('end')
    stream.end()
})


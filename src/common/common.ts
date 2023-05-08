import { Readable } from "stream";
import crypto from 'crypto'

export function pipe(source: Readable, dest: any) {
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

export function generateStr() {
    return Math.random().toString(36).substring(2, 15);
}

export function md5(text: string) {
    const md5 = crypto.createHash('md5')
    return md5.update(text + 'dsd78').digest('hex')
}

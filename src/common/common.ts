import { Readable } from "stream";

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
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
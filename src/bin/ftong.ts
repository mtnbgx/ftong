#!/usr/bin/env node
import { Command } from 'commander';
import { Server } from '../common/server';
import fs from 'fs'
const program = new Command();
program
    .option('-s, --send', 'send mode')
    .option('-r, --receive', 'receive mode')
    .option('-i, --id <char>', 'id')
    .option('-t, --to <char>', 'to id')
    .option('-f, --file <char>', 'file')
    .option('-d, --dir <char>', 'dir', './tmp')
    .version('1.0.0')

program.parse(process.argv);
const options = program.opts();
console.log(options)

if (options.send && options.file) {
    const server = new Server(options.id)
    server.on('connect', (id) => {
        console.log('connect', id)
        server.sendFile(options.to, options.file)
            .then(() => {
                console.log('发送完成')
            })
            .catch(() => {
                console.log('发送失败')
            })
            .finally(() => {
                process.exit(0)
            })
    })
} else {
    if (!fs.existsSync(options.dir)) {
        fs.mkdirSync(options.dir);
    }
    const server = new Server(options.id, { receiveDir: options.dir })
    server.on('connect', (id) => {
        console.log('connect', id)
    })
}
#!/usr/bin/env node
import { Command } from 'commander';
import { Server } from '../common/server';
const program = new Command();
program
    .option('-s, --send', 'send mode')
    .option('-r, --receive', 'receive mode')
    .option('-i, --id <char>', 'id')
    .option('-t, --to <char>', 'to id')
    .option('-f, --file <char>', 'file')
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
    const server = new Server(options.id)
}
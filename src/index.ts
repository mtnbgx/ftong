import { Server } from "./common/server";

const Id1 = undefined
const Id2 = '2'

const s1 = new Server(Id1)
const s2 = new Server(Id2)

s1.on('connect', (id) => {
    console.log('connect', id)
    s1.sendFile(Id2, './tmp/test.zip').then(() => {
        console.log('发送完成')
    })
})
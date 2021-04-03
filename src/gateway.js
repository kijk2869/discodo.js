const EventEmitter = require("./util/emitter.js")
const Websocket = require('ws')
const { performance } = require("perf_hooks")

class NodeConnection extends EventEmitter {
    constructor(node) {
        super()

        this.ws = this.keepAliver = null
        this.heartbeatTimeout = 60.0 * 1000
        this.Node = node
        this.latency = null
        this.state = "DISCONNECTED"
        this._lastAck = this._lastSend = performance.now()
    }

    connect() {
        this.state = "CONNECTING"

        this.ws = new Websocket(this.Node.WS_URL, { headers: { Authorization: this.Node.password } })
        this.ws.once('open', () => this._open())
        this.ws.once('error', (...args) => this._error(...args))
        this.ws.once('close', (...args) => this._close(...args))
        this.ws.on('message', (...args) => this._message(...args))
    }

    async handleHeartbeat() {
        if (this._lastAck + this.heartbeatTimeout < performance.now()) {
            return await this.close(4000)
        }

        await this.sendJson({ op: "HEARTBEAT", d: Date.now() })

        this._lastSend = performance.now()
    }

    async sendJson(data) {
        await this.send(JSON.stringify(data))
    }

    async send(data) {
        if (!this.ws || this.ws.readyState !== 1) return;
        await new Promise(resolve => this.ws.send(data, () => resolve()))
    }

    _open() {
        this.state = "CONNECTED"
        this.emit("CONNECTED")
    }

    _error(error) {
        console.log(error)
        this.close(1011)
    }

    _close(code, reason) {
        console.log(code)
        console.log(reason)
        this.ws.removeAllListeners()
        this.ws = null

        this.state = "DISCONNECTED"
    }

    _message(payload) {
        const message = JSON.parse(payload)

        const Operation = message.op
        const Data = message.d

        switch (Operation) {
            case "HELLO":
                this.HELLO(Data)
                break

            case "HEARTBEAT_ACK":
                this._lastAck = performance.now()
                this.latency = this._lastAck - this._lastSend
                break
        }

        this.emit(Operation, Data)
    }

    HELLO(Data) {
        this.heartbeatInterval = Math.min(Data.heartbeat_interval, 5.0)

        if (this.keepAliver) {
            clearInterval(this.keepAliver)
        }

        this.keepAliver = setInterval(() => this.handleHeartbeat(), this.heartbeatInterval * 1000)
    }

    async close(...args) {
        if (this.keepAliver) {
            clearInterval(this.keepAliver)
        }

        return await this.ws.close(...args)
    }
}

module.exports = NodeConnection
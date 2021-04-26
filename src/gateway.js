const EventEmitter = require("./util/emitter.js")
const Websocket = require("ws")
const { performance } = require("perf_hooks")

class NodeConnection extends EventEmitter {
    /**
     * 
     * @param {import("./node")} node 
     */
    constructor(node) {
        super()

        this.ws = this.keepAliver = this.latency = null
        this.heartbeatTimeout = 60 * 1000
        this.node = node
        this.state = "DISCONNECTED"
        this._lastAck = this._lastSend = performance.now()
    }

    connect() {
        this.state = "CONNECTING"

        this.ws = new Websocket(this.node.WS_URL, { headers: { Authorization: this.node.password } })
        this.ws.once("open", this._open.bind(this))
        this.ws.once("error", this._error.bind(this))
        this.ws.once("close", this._close.bind(this))
        this.ws.on("message", this._message.bind(this))
    }

    async handleHeartbeat() {
        if ((this._lastAck + this.heartbeatTimeout) < performance.now()) return await this.close(4000)

        await this.sendJson({ op: "HEARTBEAT", d: Date.now() })

        this._lastSend = performance.now()
    }

    async sendJson(data) {
        await this.send(JSON.stringify(data))
    }

    async send(data) {
        if (!this.ws || this.ws.readyState !== 1) return
        return await new Promise(resolve => this.ws.send(data, resolve))
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

        this.state = "DISCONNECTED"
    }

    _message(payload) {
        const message = JSON.parse(payload)

        const { op: Operation, d: Data } = message

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

    HELLO({ heartbeat_interval }) {
        this.heartbeatInterval = Math.min(heartbeat_interval, 5)

        if (this.keepAliver) clearInterval(this.keepAliver)

        this.keepAliver = setInterval(this.handleHeartbeat.bind(this), this.heartbeatInterval * 1000)
    }

    async close(...args) {
        if (this.keepAliver) clearInterval(this.keepAliver)

        await this.ws.close(...args)

        this.ws = null
    }
}

module.exports = NodeConnection
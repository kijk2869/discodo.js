const NodeConnection = require("./gateway.js")
const { ensureQueueObjectType } = require("./models.js")
const EventEmitter = require("./util/emitter.js")
const VoiceClient = require("./voice_client.js")

class Node extends EventEmitter {
    constructor(client, host, port, userId, shardId = null, password = "hellodiscodo", region = null) {
        super()

        this.client = client

        this.ws = null
        this.on("*", (...args) => this.onAnyEvent(...args))

        this.host = host
        this.port = port
        this.password = password

        this.userId = userId
        this.shardId = shardId
        this.region = region

        this.voiceClients = new Map()
    }

    get URL() {
        return `http://${this.host}:${this.port}`
    }

    get WS_URL() {
        return `ws://${this.host}:${this.port}/ws`
    }

    get isConnected() {
        return this.ws && this.ws.state === "CONNECTED"
    }

    async connect() {
        if (this.isConnected) {
            throw new Error("Node already connected")
        }

        if (this.ws && this.ws.state === "CONNECTED") {
            await this.ws.close(1000)
        }

        this.ws = new NodeConnection(this)

        this.ws.on("*", (...args) => this._message(...args))

        await this.ws.connect()

        await new Promise((resolve) => {
            this.ws.once("CONNECTED", async () => {
                this.voiceClients.forEach(x => x.__del())
                this.voiceClients = new Map()

                await this.send("IDENTIFY", { user_id: this.userId, shard_id: this.shardId })

                resolve()
            })
        })
    }

    async destroy() {
        if (this.ws && this.ws.state === "CONNECTED") {
            await this.ws.close(1000)
        }
        this.ws = null

        this.voiceClients.forEach(x => x.__del())
        this.voiceClients = new Map()

        if (this in this.client.Nodes) {
            this.client.Nodes.splice(this.client.Nodes.indexOf(this), 1)
        }
    }

    async _message(Operation, Data) {
        if (!!Data && Data.constructor === Object && Data.guild_id) {
            const VC = this.getVC(Data.guild_id, true)

            if (VC) {
                Data = ensureQueueObjectType(VC, Data)

                VC.emit(Operation, Data)
            }
        }

        this.emit(Operation, Data)
    }

    async send(op, data = null) {
        if (!this.ws || this.ws.state !== "CONNECTED") {
            throw new Error("Node not connected")
        }

        return await this.ws.sendJson({ op, d: data })
    }

    async onResumed(Data) {
        Object.values(this.voiceClients).forEach(x => x.__del())

        Object.entries(Data["voice_clients"]).forEach(el => {
            this.voiceClients[el[0]] = new VoiceClient(this, el[1].id, el[0])
        })
    }

    async onAnyEvent(Operation, Data) {
        switch (Operation) {
            case "RESUMED":
                await this.onResumed(Data)
                break
            case "VC_CREATED":
                this.voiceClients[Data.guild_id] = new VoiceClient(this, Data.id, Data.guild_id)
                break
            case "VC_DESTROYED":
                if (Data.guild_id in this.voiceClients) {
                    this.voiceClients[Data.guild_id].__del()
                }
                break
        }
    }

    getVC(guildId, safe = false) {
        if (!guildId in this.voiceClients && !safe) {
            throw new Error("VoiceClient Not Found")
        }

        return this.voiceClients[guildId]
    }

    async discordDispatch(payload) {
        if (!["READY", "RESUME", "VOICE_STATE_UPDATE", "VOICE_SERVER_UPDATE"].includes(payload.t)) {
            return
        }

        return await this.send("DISCORD_EVENT", payload)
    }

    async getStatus() {
        await this.send("GET_STATUS")

        return await this.waitFor("STATUS")
    }
}

module.exports = Node
const NodeConnection = require("./gateway.js")
const { ensureQueueObjectType } = require("./models.js")
const EventEmitter = require("./util/emitter.js")
const VoiceClient = require("./voiceClient.js")
const { Collection } = require("discord.js")

/**
 * @typedef NodeOptions
 * @property {import("./DJSClient")} client
 * @property {string} host
 * @property {number} port 
 * @property {string} userID
 * @property {number} [shardID]
 * @property {string} [password="hellodiscodo"]
 * @property {string} [region]
 */
class Node extends EventEmitter {
    /**
     * @param {NodeOptions} options 
     */
    constructor(options) {
        super()

        this.client = options.client

        /**
         * @type {import("./gateway")|null}
         */
        this.ws = null
        this.on("*", this.onAnyEvent.bind(this))

        this.host = options.host
        this.port = options.port
        this.password = options.password || "hellodiscodo"

        this.userID = options.userID
        this.shardID = options.shardID
        this.region = options.region

        /**
         * @type {Collection<string, import("./voiceClient")>}
         */
        this.voiceClients = new Collection()
    }

    /**
     * @type {string}
     */
    get URL() {
        return `http://${this.host}:${this.port}`
    }

    /**
     * @type {string}
     */
    get WS_URL() {
        return `ws://${this.host}:${this.port}/ws`
    }

    /**
     * @type {boolean}
     */
    get isConnected() {
        return this.ws && this.ws.state === "CONNECTED"
    }

    async connect() {
        if (this.isConnected) throw new Error("Node already connected")
        if (this.ws && this.ws.state === "CONNECTED") await this.ws.close(1000)

        this.ws = new NodeConnection(this)
        this.ws.on("*", this._message.bind(this))

        await this.ws.connect()

        return await new Promise((resolve) => {
            this.ws.once("CONNECTED", async () => {
                this.voiceClients.forEach(x => x.stop())
                this.voiceClients = new Collection()

                await this.send("IDENTIFY", { user_id: this.userID, shard_id: this.shardID })

                resolve(true)
            })
        })
    }

    async destroy() {
        if (this.ws && this.ws.state === "CONNECTED") await this.ws.close(1000)

        this.ws = null

        this.voiceClients.forEach(x => x.stop())
        this.voiceClients = new Collection()

        if (this.client.nodes.includes(this)) this.client.nodes.splice(this.client.nodes.indexOf(this), 1)
    }

    async _message(Operation, Data) {
        if (Data instanceof Object && Data.guild_id) {
            const VC = this.getVC(Data.guild_id, true)

            if (VC) {
                Data = ensureQueueObjectType(VC, Data)

                VC.emit(Operation, Data)
            }
        }

        this.emit(Operation, Data)
    }

    async send(op, data = null) {
        if (!this.ws || this.ws.state !== "CONNECTED") throw new Error("Node not connected")

        return await this.ws.sendJson({ op, d: data })
    }

    async onResumed(Data) {
        this.voiceClients.forEach(x => x.stop())

        Data.voiceClients.entries().forEach(([guildID, { id }]) => {
            this.voiceClients.set(guildID, new VoiceClient(this, id, guildID))
        })
    }

    async onAnyEvent(Operation, Data) {
        switch (Operation) {
        case "RESUMED":
            await this.onResumed(Data)
            break
        case "VC_CREATED":
            this.voiceClients.set(Data.guild_id, new VoiceClient(this, Data.id, Data.guild_id))
            break
        case "VC_DESTROYED":
            if (this.voiceClients.get(Data.guild_id)) this.voiceClients.get(Data.guild_id).stop()
            break
        }
    }

    getVC(guildID, safe = false) {
        if (!this.voiceClients.get(guildID) && !safe) throw new Error("VoiceClient Not Found")

        return this.voiceClients.get(guildID)
    }

    async discordDispatch(payload) {
        if (!["READY", "RESUME", "VOICE_STATE_UPDATE", "VOICE_SERVER_UPDATE"].includes(payload.t)) return

        return await this.send("DISCORD_EVENT", payload)
    }

    async getStatus() {
        await this.send("GET_STATUS")

        return await this.waitFor("STATUS")
    }
}

module.exports = Node

const { version, Collection } = require("discord.js")
const EventEmitter = require("./util/emitter.js")
const OriginNode = require("./node.js")

class NodeClient extends OriginNode {
    async onResumed(Data) {
        await super.onResumed(Data)

        Data.voiceClients.entries().forEach(([ guildID, vcData ]) => {
            const guild = this.client.client.guilds.cache.get(guildID)

            if (vcData.channel) {
                const channel = guild.channels.cache.get(vcData.channel)
                this.client.connect(channel, this)
            } else {
                this.client.disconnect(guild)
            }
        })
    }
}

class DJSClient extends EventEmitter {
    constructor(client) {
        super()

        if (!version.startsWith("12")) throw new Error("Discodo.js is only working on discord.js v12.")

        this.client = client

        this.nodes = new Array()
        this.GuildReservationMap = new Collection()

        this.client.on("raw", this.discordSocketResponse.bind(this))
    }

    discordSocketResponse(payload) {
        /**
         * @type {Node[]}
         */
        let SelectNodes = []

        if (["VOICE_STATE_UPDATE", "VOICE_SERVER_UPDATE"].includes(payload.t)) {
            const VC = this.getVC(payload.d.guild_id, true)
            SelectNodes.push(this.GuildReservationMap.get(payload.d.guild_id) || (VC ? VC.Node : this.getBestNode()))
        } else SelectNodes = this.nodes

        SelectNodes.forEach(Node => {
            if (!Node || !Node.isConnected) return
            
            Node.discordDispatch(payload)
        })
    }

    /**
     * 
     * @param {import("./node").NodeOptions} options
     */
    async registerNode(options) {
        if (!options.host || !options.port) throw Error("Local Node Not Implemented")

        const Node = new NodeClient({ client: this, host: options.host, port: options.port, userID: this.client.user.id, shardID: this.client.shard && this.client.shard.id, password: options.password, region: options.region })
        await Node.connect()

        this.nodes.push(Node)

        Node.on("VC_DESTROYED", this._onVCDestroyed.bind(this))
        Node.on("*", this._onAnyNodeEvent.bind(this))
    }

    _onVCDestroyed({ guild_id }) {
        const guild = this.client.guilds.cache.get(`${guild_id}`)

        this.voiceState(guild, null)
    }

    _onAnyNodeEvent(event, data) {
        if (!data.guild_id) return

        const VC = this.getVC(data.guild_id, true)
        if (!VC) return

        this.emit(event, VC, data)
    }

    getBestNode() {
        const SortedWithPerformance = this.nodes.filter(Node => Node.isConnected).sort(({ voiceClients }) => Object.keys(voiceClients).length)

        return (SortedWithPerformance && SortedWithPerformance[0]) || null
    }

    get voiceClients() {
        return new Collection(this.nodes.filter(Node => Node.isConnected).map(Node => Array.from(Node.voiceClients)).flat())
    }

    getVC(guildId, safe = false) {
        if (!this.voiceClients[guildId] && !safe) throw new Error("VoiceClient Not Found.")

        return this.voiceClients[guildId]
    }

    async voiceState(guild, channelId) {
        return await guild.shard.send({ "op": 4, "d": { "guild_id": guild.id, "channel_id": channelId } })
    }

    async connect(channel, node = null) {
        if (!channel.guild) throw new Error()

        if (!node) {
            if (!this.getBestNode()) throw new Error("There is not any node connected.")

            node = this.getBestNode()
        }

        this.GuildReservationMap.set(channel.guild.id, node)

        const VC = this.getVC(channel.guild.id, true)

        if (VC && VC.node !== node) await VC.destroy()

        const Task = !VC || VC.node !== node ? this.waitFor("VC_CREATED", ([, { guild_id }]) => guild_id === channel.guild.id) : null

        await this.voiceState(channel.guild, channel.id)

        if (this.GuildReservationMap.get(channel.guild.id) === node)
            this.GuildReservationMap.delete(channel.guild.id)

        if (Task) {
            const [VC] = await Task

            return VC
        }

        return VC
    }

    async disconnect(guild) {
        await this.voiceState(guild, null)
    }

    async destroy(guild) {
        const VC = this.getVC(guild.id)

        await Promise.all([
            this.disconnect(guild),
            VC.destroy()
        ])
    }
}

module.exports = DJSClient

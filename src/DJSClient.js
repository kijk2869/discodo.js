const { version, Collection } = require("discord.js")
const EventEmitter = require("./util/emitter.js")
const OriginNode = require("./node.js")

class NodeClient extends OriginNode {
    async onResumed(Data) {
        await super.onResumed(Data)

        Object.entries(Data.voice_clients).map(async ([guildID, { channel: voiceChannel }]) => {
            const guild = this.client.client.guilds.cache.get(`${guildID}`)

            if (voiceChannel) {
                const channel = guild.channels.cache.get(`${voiceChannel}`)
                return this.client.connect(channel, this)
            }

            if (guild) return this.client.disconnect(guild)

            let fetchedGuild
            try {
                fetchedGuild = await this.client.client.guilds.fetch(`${guildID}`)
            } catch (e) {
                throw new Error("Unable to close a invalidated voice session.")
            }

            this.client.disconnect(fetchedGuild)
        })
    }
}

class DJSClient extends EventEmitter {
    constructor(client) {
        super()

        if (!version.startsWith("12")) throw new Error("Discodo.js is only working on discord.js v12.")

        /**
         * @type {import("discord.js").Client}
         */
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
            SelectNodes.push(this.GuildReservationMap.get(payload.d.guild_id) || (VC && VC.Node ? VC.Node : this.getBestNode()))
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

        const Node = new NodeClient({
            client: this,
            host: options.host,
            port: options.port,
            userID: this.client.user.id,
            shardID: this.client.shard && this.client.shard.id,
            password: options.password,
            region: options.region
        })

        const timeout = setTimeout(() => {
            clearTimeout(timeout)

            throw new Error("Node connection timed out.")
        }, 15000)
        
        await Node.connect()

        clearTimeout(timeout)

        this.nodes.push(Node)

        Node.on("VC_DESTROYED", this._onVCDestroyed.bind(this))
        Node.on("*", this._onAnyNodeEvent.bind(this))

        return Node
    }

    _onVCDestroyed({ guild_id }) {
        const guild = this.client.guilds.cache.get(`${guild_id}`)

        this.voiceState(guild, null)
        this.voiceClients.delete(`${guild_id}`)
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
        if (!this.voiceClients.get(guildId) && !safe) throw new Error("VoiceClient Not Found.")

        return this.voiceClients.get(guildId)
    }

    async voiceState(guild, channelId) {
        if (!guild) throw new Error("Target guild not specified.")

        return await guild.shard.send({ "op": 4, "d": { "guild_id": guild.id, "channel_id": channelId } })
    }

    /**
     * 
     * @param {import("discord.js").VoiceChannel | string} channel ChannelResolvable
     * @param {import("./node")} node 
     * @returns 
     */
    async connect(channel, node = null) {
        channel = this.client.channels.resolve(channel)

        if (channel.type !== "voice" && channel.type !== "")
            if (!channel.guild) throw new Error()

        if (!node) {
            if (!this.getBestNode()) throw new Error("There is not any node connected.")

            node = this.getBestNode()
        }

        this.GuildReservationMap.set(channel.guild.id, node)

        const VC = this.getVC(channel.guild.id, true)

        if (VC && VC.node !== node) await VC.destroy()

        // eslint-disable-next-line no-unused-vars
        const Task = !VC || VC.node !== node ? this.waitFor("VC_CREATED", (($, { guild_id }) => `${guild_id}` === channel.guild.id)) : Promise.resolve(VC)

        await this.voiceState(channel.guild, channel.id)

        if (this.GuildReservationMap.get(channel.guild.id) === node)
            this.GuildReservationMap.delete(channel.guild.id)

        if (Task) {
            const VC = await Task
                .catch(e => {
                    if (`${e}` !== "The voice connection is timed out.") return

                    channel.leave()

                    throw e
                })

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

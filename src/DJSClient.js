const { version } = require('discord.js');
const EventEmitter = require('./util/emitter.js')
const OriginNode = require("./node.js")

class NodeClient extends OriginNode {
    async onResumed(Data) {
        await super.onResumed(Data)

        Object.entries(Data["voice_clients"]).forEach((data) => {
            const [guildId, vcData] = data

            const guild = this.client.client.guilds.cache.get(guildId)

            if (vcData.channel) {
                const channel = guild.channels.cache.get(vcData["channel"])
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

        if (!version.startsWith('12')) {
            throw new Error("Discodo.js is only working on Discord.JS v12.")
        }

        this.client = client

        this.Nodes = new Array()
        this.GuildReservationMap = new Map()

        this.client.on("raw", packet => this.discordSocketResponse(packet))
    }

    discordSocketResponse(payload) {
        let SelectNodes = []

        if (["VOICE_STATE_UPDATE", "VOICE_SERVER_UPDATE"].includes(payload.t)) {
            const VC = this.getVC(payload.d.guild_id, true)
            SelectNodes = [
                payload.d.guild_id in this.GuildReservationMap ? this.GuildReservationMap[payload.d.guild_id] : (VC ? VC.Node : this.getBestNode())
            ]

        } else {
            SelectNodes = this.Nodes
        }

        SelectNodes.forEach(Node => {
            if (Node && Node.isConnected) {
                Node.discordDispatch(payload)
            }
        })
    }

    async registerNode(host = null, port = null, password = "hellodiscodo", region = null, launchOptions = {}) {
        if (!host || !port) {
            throw Error("Local Node Not Implemented")
        }

        const Node = new NodeClient(this, host, port, this.client.user.id, this.client.shard?.id, password, region)
        await Node.connect()

        this.Nodes.push(Node)

        Node.on("VC_DESTROYED", (...args) => this._onVCDestroyed(...args))
        Node.on("*", (...args) => this._onAnyNodeEvent(...args))
    }

    _onVCDestroyed(data) {
        let guild = this.client.guilds.cache.get(data.guild_id.toString())

        this.voiceState(guild, null)
    }

    _onAnyNodeEvent(event, data) {
        if (!data.guild_id) {
            return
        }

        const VC = this.getVC(data.guild_id, true)

        if (!VC) return

        this.emit(event, [VC, data])
    }

    getBestNode() {
        let SortedWithPerformance = this.Nodes.filter(Node => Node.isConnected).sort(Node => Object.keys(Node.voiceClients).length)

        return SortedWithPerformance ? SortedWithPerformance[0] : null
    }

    get voiceClients() {
        return Object.fromEntries(
            this.Nodes.filter(Node => Node.isConnected).map(Node => Object.entries(Node.voiceClients)).flat()
        )
    }

    getVC(guildId, safe = false) {
        if (!this.voiceClients[guildId] && !safe) {
            throw new Error("VoiceClient Not Found.")
        }

        return this.voiceClients[guildId]
    }

    async voiceState(guild, channelId) {
        return await guild.shard.send({ "op": 4, "d": { "guild_id": guild.id, "channel_id": channelId } })
    }

    async connect(channel, node = null) {
        if (!channel.hasOwnProperty("guild")) {
            throw new Error()
        }

        if (!node) {
            if (!this.getBestNode()) {
                throw new Error("There is not any node connected.")
            }

            node = this.getBestNode()
        }

        this.GuildReservationMap[channel.guild.id] = node

        VC = this.getVC(channel.guild.id, true)

        if (VC && VC.Node !== node) {
            await VC.destroy()
        }

        let Task = !VC || VC.Node !== node ? this.waitFor("VC_CREATED", el => { return el[1].guild_id === channel.guild.id }) : null

        await this.voiceState(channel.guild, channel.id)

        if (Task) {
            var [VC, _] = await Task
        }

        if (this.GuildReservationMap[channel.guild.id] === node) {
            delete this.GuildReservationMap[channel.guild.id]
        }

        return VC
    }

    async disconnect(guild) {
        await this.voiceState(guild, null)
    }

    async destroy(guild) {
        VC = this.getVC(guild.id)

        await this.disconnect(guild)
        await VC.destroy()
    }
}

module.exports = DJSClient
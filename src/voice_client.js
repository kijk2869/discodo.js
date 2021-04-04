const HTTPClient = require("./http.js")
const EventEmitter = require("./util/emitter.js")
const { Queue } = require("./models.js")
const Node = require("./node.js")

class VoiceClient extends EventEmitter {
    constructor(Node, id, guildId) {
        super()

        this.Node = Node
        this.client = Node.client

        this.id = id
        this.guildId = guildId
        this.channelId = null

        this.http = new HTTPClient(this)
        this.on("VC_CHANNEL_EDITED", (...args) => this._VC_CHANNEL_EDITED(...args))

        this._state = null
        this._volume = 1.0
        this._crossfade = 10.0
        this._autoplay = true
        this._filter = {}
        this._context = {}

        this._current = null

        this.on("getState", (...args) => this.handleGetState(...args))

        this.syncTask = setInterval(() => { this.syncWithNode }, 300 * 1000)

        this.Queue = new Queue(this)

        this.on("getQueue", (...args) => this.Queue.handleGetQueue(...args))
        this.on("QUEUE_EVENT", (...args) => this.Queue.handleQueueEvent(...args))

        this.send("getQueue", {})
    }

    __del() {
        if (this.syncTask) {
            clearInterval(this.syncTask)
        }

        const VC = this.Node.voiceClients[this.guildId]
        if (VC && VC === this) {
            delete this.Node.voiceClients[this.guildId]
        }
    }

    _VC_CHANNEL_EDITED(data) {
        this.channelId = data["channel_id"]
    }

    syncWithNode() {
        this.send("getState", {})
    }

    get volume() {
        return this._volume
    }

    get crossfade() {
        return this._crossfade
    }

    get autoplay() {
        return this._autoplay
    }

    get filter() {
        return this._filter
    }

    get current() {
        return this._current
    }

    get duration() {
        return this._current ? this._current.duration : null
    }

    get position() {
        return this._current ? this._current.position : null
    }

    get remain() {
        return this._current ? this._current.duration - this._current.position : null
    }

    get context() {
        return this._context
    }

    get state() {
        return this._state
    }

    handleGetState(data) {
        const options = data.options

        this._volume = data.options.volume
        this._crossfade = data.options.crossfade
        this._autoplay = data.options.autoplay
        this._filter = data.options.filter

        this._current = data.current
        this._context = data.context
        this._state = data.state

        this.channelId = data.channel_id
    }

    async send(op, data) {
        data["guild_id"] = this.guildId

        return await this.Node.send(op, data)
    }

    async query(op, data = null, event = null, timeout = 10000.0) {
        if (!event) {
            event = op
        }

        if (!data) {
            data = {}
        }

        const Task = this.waitFor(event, data => { return data["guild_id"] === this.guildId }, timeout)

        this.send(op, data)

        const Data = await Task

        if (Data.traceback) {
            throw new Error(Data.traceback.entries())
        }

        return Data
    }

    async fetchContext() {
        this._context = await this.http.getVCContext()

        return this._context
    }

    async setContext(data) {
        this._context = await this.http.setVCContext(data)

        return this._context
    }

    async getSource(query) {
        const data = await this.http.getSource(query)

        return data.source
    }

    async searchSources(query) {
        const data = await this.http.searchSources(query)

        return data.sources
    }

    async putSource(source) {
        const data = await this.http.putSource(source instanceof Array ? source.map(x => x.data) : source)

        return data.source
    }

    async loadSource(query) {
        const data = await this.http.loadSource(query)

        return data["source"]
    }

    async skip(offset = 1) {
        return await this.http.skip(offset)
    }

    async seek(offset) {
        return await this.http.seek(offset)
    }

    async getOptions() {
        return await this.http.getOptions()
    }

    async setOptions(options = {}) {
        if ("volume" in options) {
            this._volume = options["volume"]
        }
        if ("crossfade" in options) {
            this._crossfade = options["crossfade"]
        }
        if ("autoplay" in options) {
            this._autoplay = options["autoplay"]
        }
        if ("filter" in options) {
            this._filter = options["filter"]
        }

        return await this.http.setOptions(options)
    }

    async setVolume(volume) {
        return await this.setOptions({ volume })
    }

    async setCrossfade(crossfade) {
        return await this.setOptions({ crossfade })
    }

    async setAutoplay(autoplay) {
        return await this.setOptions({ autoplay })
    }

    async setFilter(filter) {
        return await this.setOptions({ filter })
    }

    async pause() {
        return await this.http.pause()
    }

    async resume() {
        return await this.http.resume()
    }

    async shuffle() {
        const data = await this.http.shuffle()

        this.Queue.handleGetQueue(data)

        return this.Queue
    }

    async getCurrent() {
        this._current = await this.http.getCurrent()

        return this._current
    }

    async fetchState() {
        const data = await this.query("getState")

        return data
    }

    async fetchQueue(ws = true) {
        if (ws) {
            await this.query("getQueue")
        } else {
            this.Queue.handleGetQueue(await this.http.queue())
        }

        return this.Queue
    }

    async requestSubtitle(lang = null, url = null) {
        if (!lang && !url) {
            throw new Error("Either `lang` or `url` is needed.")
        }

        const Data = {}

        if (url) {
            Data.url = url
        } else if (lang) {
            Data.lang = lang
        }

        return await this.query("requestSubtitle", Data)
    }

    async getSubtitle(options = {}, callback) {
        const Data = await this.requestSubtitle(options.lang, options.url)

        const identifyToken = Data.identify
        if (!identifyToken) throw new Error("Subtitle not found")

        let locked = false

        const subtitleReceive = async (subtitle) => {
            if (subtitle.identify !== identifyToken || locked) return

            locked = true

            try {
                await callback(subtitle)
            } finally {
                locked = false
            }
        }

        const subtitleDone = (data) => {
            if (data.identify !== identifyToken) return

            this.off("Subtitle", subtitleReceive)
            this.off("subtitleDone", subtitleDone)
        }

        this.on("Subtitle", subtitleReceive)
        this.on("subtitleDone", subtitleDone)

        return Data
    }

    async moveTo(node) {
        if (node === this.Node) {
            throw new Error("Already connected to this node.")
        }

        const channel = this.client.client.channels.cache.get(this.channelId)

        if (!channel) {
            throw new Error("this voice client is not connected to the channel.")
        }

        await this.fetchState()

        const VC = await this.client.connect(channel, node)

        await VC.setOptions(
            volume = this.volume,
            crossfade = this.crossfade,
            autoplay = this.autoplay,
            filter = this.filter
        )

        if (this.context) {
            await VC.setContext(this.context)
        }

        if (this.current) {
            await VC.putSource(this.current)
        }

        if (this.Queue) {
            await VC.putSource(this.Queue)
        }

        return VC
    }

    async destroy() {
        return await this.query("VC_DESTROY", null, "VC_DESTROYED")
    }
}

module.exports = VoiceClient
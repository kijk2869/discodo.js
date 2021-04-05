const HTTPClient = require("./http.js")
const EventEmitter = require("./util/emitter.js")
const { Queue } = require("./models.js")

/**
 * @typedef DiscodoAudioOptions
 * @property {number} volume
 * @property {number} crossfade
 * @property {boolean} autoplay
 */

/**
 * @typedef AudioPacket
 * @property {string} guild_id
 * @property {string} [channel_id=null]
 * @property {DiscodoAudioOptions} options
 * @property {Record<string, string>} [traceback]
 */

class VoiceClient extends EventEmitter {
    /**
     * @param {import("./node")} node Audio node instance of discodo.js
     * @param {string} id
     * @param {string} guildID
     */
    constructor(node, id, guildID) {
        super()

        this.node = node
        this.client = node.client

        this.id = id
        /**
         * The id of guild wrapped with node
         * @type {string}
         */
        this.guildID = guildID
        /**
         * The id of guild wrapped with node
         * @type {string|null}
         */
        this.channelID = null

        this.http = new HTTPClient(this)

        this._state = null
        this._volume = 1.0
        this._crossfade = 10.0
        this._autoplay = true
        this._filter = {}
        this._context = {}

        this._current = null

        this.syncTask = setInterval(() => { this.syncWithNode }, 300 * 1000)

        /**
         * @type {Queue}
         */
        this.queue = new Queue(this)

        this.on("getState", this.handleGetState.bind(this))
        this.on("VC_CHANNEL_EDITED", this._VC_CHANNEL_EDITED.bind(this))
        this.on("getQueue", this.queue.handleGetQueue.bind(this.queue))
        this.on("QUEUE_EVENT", this.queue.handleQueueEvent.bind(this.queue))

        this.send("getQueue", {})
    }

    stop() {
        if (this.syncTask) clearInterval(this.syncTask)

        const VC = this.node.voiceClients[this.guildID]
        if (VC === this) delete this.node.voiceClients[this.guildID]
    }

    _VC_CHANNEL_EDITED({ channel_id }) {
        return this.channelID = channel_id
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

    /**
     * 
     * @param {AudioPacket} data 
     */
    handleGetState(data) {
        if (data.traceback) throw new Error(Object.entries(data.traceback).map(err => err.join(": ")).join("\n"))
        const { volume, crossfade, autoplay, filter } = data.options || {}

        this._volume = volume
        this._crossfade = crossfade
        this._autoplay = autoplay
        this._filter = filter

        this._current = data.current
        this._context = data.context
        this._state = data.state

        this.channelID = data.channel_id
    }

    async send(op, data) {
        if (data.guild_id !== this.guildID) data.guild_id = this.guildID

        return await this.node.send(op, data)
    }

    async query(op, data, event, timeout = 10.0) {
        if (!event) event = op
        if (!data) data = {}

        const Task = this.waitFor(event, ({ guild_id }) => `${guild_id}` === this.guildID, timeout)

        if (this.channelID && this.client.client.channels.cache.get(this.channelID)) this.client.client.channels.cache.get(this.channelID).leave()

        this.send(op, data)

        const Data = await Task

        if (Data.traceback) throw new Error(Object.entries(Data.traceback))

        return Data
    }

    async fetchContext() {
        return this._context = await this.http.getVCContext()
    }

    async setContext(data) {
        return this._context = await this.http.setVCContext(data)
    }

    /**
     * 
     * @param {string} query 
     * @returns 
     */
    async getSource(query) {
        const { source } = await this.http.getSource(query)

        return source
    }

    /**
     * 
     * @param {string} query 
     * @returns 
     */
    async searchSources(query) {
        const { sources } = await this.http.searchSources(query)

        return sources
    }

    async putSource(source) {
        const { source: output } = await this.http.putSource(Array.isArray(source) ? source.map(x => x._data) : source._data)

        return output
    }

    /**
     * 
     * @param {string} query 
     * @returns 
     */
    async loadSource(query) {
        const { source } = await this.http.loadSource(query)

        return source
    }

    /**
     * 
     * @param {number} [offset=1]
     * @returns 
     */
    async skip(offset = 1) {
        return await this.http.skip(offset)
    }

    /**
     * 
     * @param {number} offset
     * @returns 
     */
    async seek(offset) {
        return await this.http.seek(offset)
    }

    async getOptions() {
        return await this.http.getOptions()
    }

    /**
     * 
     * @param {DiscodoAudioOptions} options 
     * @returns 
     */
    async setOptions(options) {
        if ("volume" in options) this._volume = options.volume
        if ("crossfade" in options) this._crossfade = options.crossfade
        if ("autoplay" in options) this._autoplay = options.autoplay
        if ("filter" in options) this._filter = options.filter

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

        this.queue.handleGetQueue(data)

        return this.queue
    }

    async getCurrent() {
        return this._current = await this.http.getCurrent()
    }

    async fetchState() {
        return await this.query("getState")
    }

    /**
     * 
     * @param {boolean} [ws=true]
     * @returns 
     */
    async fetchQueue(ws = true) {
        if (ws) await this.query("getQueue")
        else this.queue.handleGetQueue(await this.http.queue())

        return this.queue
    }

    async requestSubtitle(lang, url) {
        if (!lang && !url) throw new Error("Either `lang` or `url` is needed.")

        const Data = {}

        if (url) {
            Data.url = url
        } else if (lang) {
            Data.lang = lang
        }

        return await this.query("requestSubtitle", Data)
    }

    async getSubtitle() {
        throw new Error("not implemented")
    }

    async moveTo(node) {
        if (node === this.node) throw new Error("Already connected to this node.")

        const channel = this.client.client.channels.cache.get(this.channelID)
        if (!channel) throw new Error("this voice client is not connected to the channel.")

        await this.fetchState()
        
        const [VC] = await this.client.connect(channel, node)

        await VC.setOptions({
            volume: this.volume,
            crossfade: this.crossfade,
            autoplay: this.autoplay,
            filter: this.filter
        })

        if (this.context) await VC.setContext(this.context)
        if (this.current) await VC.putSource(this.current)
        if (this.queue) await VC.putSource(this.queue)

        return VC
    }

    async destroy() {
        return await this.query("VC_DESTROY", null, "VC_DESTROYED")
    }
}

module.exports = VoiceClient

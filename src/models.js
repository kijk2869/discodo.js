class AudioData {
    constructor(VoiceClient, data) {
        this.VoiceClient = VoiceClient
        this.data = data
    }

    get isInQueue() {
        return Boolean(this.VoiceClient.Queue.find(el => el.tag === this.tag))
    }

    get _type() {
        return this.data ? this.data._type : null
    }

    get tag() {
        return this.data.tag
    }

    get id() {
        return this.data.id
    }

    get title() {
        return this.data.title
    }

    get webpage_url() {
        return this.data.webpage_url
    }

    get thumbnail() {
        return this.data.thumbnail
    }

    get url() {
        return this.data.url
    }

    get duration() {
        return this.data.duration
    }

    get is_live() {
        return this.data.is_live
    }

    get uploader() {
        return this.data.uploader
    }

    get description() {
        return this.data.description
    }

    get subtitles() {
        return this.data.subtitles
    }

    get chapters() {
        return this.data.chapters
    }

    get related() {
        return this.data.related
    }

    get context() {
        return this.data.context
    }

    get start_position() {
        return this.data.start_position
    }

    async put() {
        if (this.isInQueue) {
            throw new Error("the source is already in the queue.")
        }

        return await this.VoiceClient.putSource(this)
    }

    async getContext() {
        if (!this.isInQueue) {
            throw new Error("the source is not in the queue.")
        }

        data = await this.VoiceClient.http.getQueueSource(this.tag)
        this.context = "context" in data ? data.context : {}

        return this.context
    }

    async setContext(data) {
        if (!this.isInQueue) {
            throw new Error("the source is not in the queue.")
        }

        data = await this.VoiceClient.http.setQueueSource(this.tag, { context: data })
        this.context = "context" in data ? data.context : {}

        return this.context
    }

    async moveTo(index) {
        if (!this.isInQueue) {
            throw new Error("the source is not in the queue.")
        }

        data = await this.VoiceClient.http.setQueueSource(this.tag, { index })

        return this
    }

    async seek(offset) {
        if (!this.isInQueue) {
            throw new Error("the source is not in the queue.")
        }

        data = await this.VoiceClient.http.setQueueSource(this.tag, { start_position: offset })

        return this
    }

    async remove() {
        if (!this.isInQueue) {
            throw new Error("the source is not in the queue.")
        }

        data = await this.VoiceClient.http.removeQueueSource(this.tag)

        return this
    }
}

class AudioSource {
    constructor(VoiceClient, data) {
        this._data = data
        this.VoiceClient = VoiceClient
    }

    get isInQueue() {
        return Boolean(this.VoiceClient.Queue.find(el => el.tag === this.tag))
    }

    get _type() {
        return this.data ? this.data._type : null
    }

    get tag() {
        return this.data.tag
    }

    get id() {
        return this.data.id
    }

    get title() {
        return this.data.title
    }

    get webpage_url() {
        return this.data.webpage_url
    }

    get url() {
        return this.data.url
    }

    get duration() {
        return this.data.duration
    }

    get is_live() {
        return this.data.is_live
    }

    get uploader() {
        return this.data.uploader
    }

    get description() {
        return this.data.description
    }

    get subtitles() {
        return this.data.subtitles
    }

    get as_of() {
        return this.data.as_of
    }

    get chapters() {
        return this.data.chapters
    }

    get related() {
        return this.data.related
    }

    get context() {
        return this.data.context
    }

    get start_position() {
        return this.data.start_position
    }

    get seekable() {
        return this.data.seekable
    }

    get position() {
        return Math.round(
            this.data.position
            + (Math.round(Date.now() / 1000) - (this.data.as_of ? this.as_of : 0))
            , 2
        )
    }

    async getContext() {
        if (!this.isInQueue) {
            throw new Error("the source is not in the queue.")
        }

        if (this.isInQueue) {
            data = await this.VoiceClient.http.getQueueSource(this.tag)
        } else {
            data = await this.VoiceClient.http.getCurrent()
        }

        this.context = "context" in data ? data.context : {}

        return this.context
    }

    async setContext(data) {

        if (this.isInQueue) {
            data = await this.VoiceClient.http.setQueueSource(this.tag, { context: data })
        } else {
            data = await this.VoiceClient.http.setCurrent({ context: data })
        }

        this.context = "context" in data ? data.context : {}

        return this.context
    }

}

ARGUMENT_MAPPING = { "AudioData": AudioData, "AudioSource": AudioSource }

function ensureQueueObjectType(VoiceClient, argument) {
    if (!!argument && argument.constructor === Array) {
        return argument.map(x => ensureQueueObjectType(VoiceClient, x))
    }

    const typeObject = ARGUMENT_MAPPING[!!argument && argument.constructor === Object ? argument._type : null]

    if (!argument) {
        return
    }

    if (!argument._type || !typeObject) {
        if (!!argument && argument.constructor === Object) {
            return Object.fromEntries(Object.entries(argument).map(el => [el[0], ensureQueueObjectType(VoiceClient, el[1])]))
        }

        return argument
    }

    return new typeObject(VoiceClient, argument)
}

class Queue extends Array {
    constructor(VoiceClient) {
        super()

        super.VoiceClient = VoiceClient
    }

    __checkArgumentType(argument) {
        return ensureQueueObjectType(super.VoiceClient, argument)
    }

    setItem(index, value) {
        super[index] = value
    }

    delItem(index) {
        super.splice(index, 1)
    }

    extend(value) {
        super.splice(super.length, 0, ...value)
    }

    append(value) {
        super.push(value)
    }

    remove(value) {
        super.splice(super.indexOf(value), 1)
    }

    insert(index, value) {
        super.splice(index, 0, value)
    }

    pop(index) {
        super.splice(index, 1)
    }

    reverse() {
        super.reverse()
    }

    clear() {
        super.splice(0, super.length)
    }

    handleGetQueue(data) {
        if (!data.entries) {
            return
        }

        const entries = data.entries.map(this.__checkArgumentType)

        if (!entries) {
            return
        }

        this.clear()
        this.extend(entries)
    }

    handleQueueEvent(data) {
        var [name, args] = [data.name, data.args.map(this.__checkArgumentType)]

        if (!this[name]) {
            return
        }

        return this[name](...args)
    }
}

module.exports = {
    Queue,
    ensureQueueObjectType
}
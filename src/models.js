"use strict"

class AudioData {
    /**
     * 
     * @param {import("./voiceClient")} VoiceClient 
     * @param {*} data 
     */
    constructor(VoiceClient, data) {
        this.voiceClient = VoiceClient
        this.data = data

        this.context = this.data.context

        Object.defineProperties(this, {
            _type: {
                value: this.data ? this.data._type : null,
                writable: false
            },
            tag: {
                value: this.data.tag,
                writable: false
            },
            id: {
                value: this.data.id,
                writable: false
            },
            title: {
                value: this.data.title,
                writable: false
            },
            webpage_url: {
                value: this.data.webpage_url,
                writable: false
            },
            thumbnail: {
                value: this.data.thumbnail,
                writable: false
            },
            url: {
                value: this.data.url,
                writable: false
            },
            duration: {
                value: this.data.duration,
                writable: false
            },
            isLive: {
                value: this.data.is_live,
                writable: false
            },
            uploader: {
                value: this.data.uploader,
                writable: false
            },
            description: {
                value: this.data.description,
                writable: false
            },
            subtitles: {
                value: this.data.subtitles,
                writable: false
            },
            chapters: {
                value: this.data.chapters,
                writable: false
            },
            related: {
                value: this.data.related,
                writable: false
            },
            startPosition: {
                value: this.data.start_position,
                writable: false
            }
        })
    }

    get isInQueue() {
        return !!this.voiceClient.queue.find(el => el.tag === this.tag)
    }

    async put() {
        if (this.isInQueue) throw new Error("this source is already in the queue.")

        return await this.voiceClient.putSource(this)
    }

    async getContext() {
        if (!this.isInQueue) throw new Error("the source is not in the queue.")

        const data = await this.voiceClient.http.getQueueSource(this.tag)
        return this.context = "context" in data ? data.context : {}
    }

    async setContext(data) {
        if (!this.isInQueue) throw new Error("the source is not in the queue.")

        data = await this.voiceClient.http.setQueueSource(this.tag, { context: data })
        return this.context = "context" in data ? data.context : {}
    }

    /**
     * 
     * @param {number} index 
     * @returns {Promise<this>}
     */
    async moveTo(index) {
        if (!this.isInQueue) throw new Error("the source is not in the queue.")

        await this.voiceClient.http.setQueueSource(this.tag, { index })

        return this
    }

    /**
     *
     * @param {number} offset
     * @returns {Promise<this>}
     */
    async seek(offset) {
        if (!this.isInQueue) throw new Error("the source is not in the queue.")

        await this.voiceClient.http.setQueueSource(this.tag, { start_position: offset })

        return this
    }

    /**
     * 
     * @returns {Promise<this>}
     */
    async remove() {
        if (!this.isInQueue) throw new Error("the source is not in the queue.")

        await this.voiceClient.http.removeQueueSource(this.tag)

        return this
    }
}

class AudioSource {
    /**
     * 
     * @param {import("./voiceClient")} VoiceClient 
     * @param {*} data 
     */
    constructor(VoiceClient, data) {
        this._data = data
        this.voiceClient = VoiceClient

        this.context = this.data.context

        Object.defineProperties(this, {
            _type: {
                value: this.data ? this.data._type : null,
                writable: false
            },
            tag: {
                value: this.data.tag,
                writable: false
            },
            id: {
                value: this.data.id,
                writable: false
            },
            title: {
                value: this.data.title,
                writable: false
            },
            webpage_url: {
                value: this.data.webpage_url,
                writable: false
            },
            url: {
                value: this.data.url,
                writable: false
            },
            duration: {
                value: this.data.duration,
                writable: false
            },
            isLive: {
                value: this.data.is_live,
                writable: false
            },
            uploader: {
                value: this.data.uploader,
                writable: false
            },
            description: {
                value: this.data.description,
                writable: false
            },
            subtitles: {
                value: this.data.subtitles,
                writable: false
            },
            asOf: {
                value: this.data.as_of,
                writable: false
            },
            chapters: {
                value: this.data.chapters,
                writable: false
            },
            related: {
                value: this.data.related,
                writable: false
            },
            start_position: {
                value: this.data.start_position,
                writable: false
            }, 
            seekable: {
                value: this.data.seekable,
                writable: false
            }
        })
    }

    get isInQueue() {
        return !!this.voiceClient.queue.find(el => el.tag === this.tag)
    }


    get position() {
        return (this._data.position + (Math.round(Date.now() / 1000) - (this.asOf || 0))).toFixed(2)
    }

    async getContext() {
        if (!this.isInQueue) throw new Error("the source is not in the queue.")

        let data
        if (this.isInQueue) {
            data = await this.voiceClient.http.getQueueSource(this.tag)
        } else {
            data = await this.voiceClient.http.getCurrent()
        }

        return this.context = "context" in data ? data.context : {}
    }

    async setContext(data) {
        if (this.isInQueue) {
            data = await this.voiceClient.http.setQueueSource(this.tag, { context: data })
        } else {
            data = await this.voiceClient.http.setCurrent({ context: data })
        }

        this.context = "context" in data ? data.context : {}

        return this.context
    }

}

const ARGUMENT_MAPPING = { "AudioData": AudioData, "AudioSource": AudioSource }
exports.ARGUMENT_MAPPING = ARGUMENT_MAPPING

function ensureQueueObjectType(VoiceClient, argument) {
    if (argument instanceof Array) return argument.map(x => ensureQueueObjectType(VoiceClient, x))

    /**
     * @type {AudioData|AudioSource|undefined}
     */
    const TypeObject = ARGUMENT_MAPPING[argument instanceof Object ? argument._type : null]

    if (!argument) return

    if (!argument._type || !TypeObject) {
        if (argument instanceof Object) return Object.fromEntries(Object.entries(argument).map(([ele1, ele2]) => [ele1, ensureQueueObjectType(VoiceClient, ele2)]))

        return argument
    }

    return new TypeObject(VoiceClient, argument)
}

class Queue extends Array {
    constructor(VoiceClient) {
        super()

        this.voiceClient = VoiceClient
    }

    __checkArgumentType(argument) {
        return ensureQueueObjectType(this.voiceClient, argument)
    }

    setItem(index, value) {
        return super[index] = value
    }

    delItem(index) {
        return super.splice(index, 1)
    }

    extend(value) {
        return super.splice(super.length, 0, ...value)
    }

    append(value) {
        return super.push(value)
    }

    remove(value) {
        return super.splice(super.indexOf(value), 1)
    }

    insert(index, value) {
        return super.splice(index, 0, value)
    }

    pop(index) {
        return super.splice(index, 1)
    }

    clear() {
        return super.splice(0, super.length)
    }

    handleGetQueue({ entries }) {
        if (!entries) return

        const newEntries = entries.map(this.__checkArgumentType)

        if (!newEntries) return

        this.clear()
        this.extend(newEntries)
    }

    handleQueueEvent({ name, args }) {
        const [, newArgs] = [name, args.map(this.__checkArgumentType)]

        if (!Reflect.ownKeys(this).includes(name)) return

        return this[name](...newArgs)
    }
}

module.exports = {
    Queue,
    ensureQueueObjectType
}
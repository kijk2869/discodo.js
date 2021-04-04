const fetch = require("node-fetch")
const { ensureQueueObjectType } = require("./models.js")

class HTTPClient {
    /**
     * 
     * @param {import("./voiceClient")} client 
     */
    constructor(client) {
        this.voiceClient = client
        this.node = client.node

        Object.defineProperty(this, "headers", {
            value: {
                Authorization: this.node.password,
                "User-ID": this.node.userID,
                "Guild-ID": this.voiceClient.guildID,
                "VoiceClient-ID": this.voiceClient.id
            },
            writable: false
        })
    }

    async fetch(method, endpoint, options = {}) {
        const URL = this.node.URL + endpoint

        options.method = method
        options.headers = { ...options.headers, ...this.headers }


        const response = await fetch(URL, options)

        const body = await response.text()


        let parsed = null
        try {
            parsed = JSON.parse(body)
        } catch (e) {
            if (e instanceof SyntaxError) parsed = body
            else throw e
        }

        const data = ensureQueueObjectType(this.voiceClient, parsed)

        if (response.status >= 200 && response.status < 300) return data

        throw new Error(`HTTPException: ${response.status} -> ${data}`)
    }

    async getSource(query) {
        const params = new URLSearchParams()
        params.append("query", query)

        return await this.fetch("GET", `/getSource?${`${params}`}`)
    }

    async searchSources(query) {
        const params = new URLSearchParams()
        params.append("query", query)

        return await this.fetch("GET", `/searchSources?${`${params}`}`)
    }

    async getVCContext() {
        return await this.fetch("GET", "/context")
    }

    async setVCContext(data) {
        return await this.fetch("POST", "/context", { body: JSON.stringify({ context: data }) })
    }

    async putSource(source) {
        return await this.fetch("POST", "/putSource", { body: JSON.stringify({ source }) })
    }

    async loadSource(query) {
        return await this.fetch("POST", "/loadSource", { body: JSON.stringify({ query }) })
    }

    async getOptions() {
        return await this.fetch("GET", "/options")
    }

    async setOptions(options) {
        return await this.fetch("POST", "/options", { body: JSON.stringify(options) })
    }

    async getSeek() {
        return await this.fetch("GET", "/seek")
    }

    async seek(offset) {
        return await this.fetch("POST", "/seek", {
            body: JSON.stringify({ offset })
        })
    }

    async skip(offset) {
        return await this.fetch("POST", "/skip", {
            body: JSON.stringify({ offset })
        })
    }

    async pause() {
        return await this.fetch("POST", "/pause")
    }

    async resume() {
        return await this.fetch("POST", "/resume")
    }

    async shuffle() {
        return await this.fetch("POST", "/shuffle")
    }

    async queue() {
        return await this.fetch("GET", "/queue")
    }

    async getCurrent() {
        return await this.fetch("GET", "/current")
    }

    async getQueueSource(tag) {
        return await this.fetch("GET", `/queue/${tag}`)
    }

    async setCurrent(data) {
        return await this.fetch("POST", "/current", { body: JSON.stringify(data) })
    }

    async setQueueSource(tag, data) {
        return await this.fetch("POST", `/queue/${tag}`, { body: JSON.stringify(data) })
    }

    async removeQueueSource(tag) {
        return await this.fetch("DELETE", `/queue/${tag}`)
    }
}

module.exports = HTTPClient

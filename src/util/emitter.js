const EventEmitter = require("events");

class ModifiedEventEmitter extends EventEmitter {
    emit(event, ...args) {
        super.emit("*", event, ...args)

        return super.emit(event, ...args)
    }

    waitFor(event, condition = null, timeout = 10000) {
        const symbolId = Symbol("discodoInternal")

        return new Promise((resolve, reject) => {
            const id = setTimeout(() => {
                clearTimeout(id)

                const internalListener = this.listeners(event).find(l => l[symbolId] === true)

                if (internalListener) {
                    this.removeListener(event, internalListener)
                }

                reject("The voice connection is timed out.")
            }, timeout)

            const listener = (...args) => {
                if (condition && !condition(...args)) return

                clearTimeout(id)

                const resolved = resolve(...args)

                const internalListener = this.listeners(event).find(e => e[symbolId] === true)

                if (internalListener) {
                    this.removeListener(event, internalListener)
                }

                return resolved
            }

            listener[symbolId] = true

            this.on(event, listener)
        })
    }
}

module.exports = ModifiedEventEmitter
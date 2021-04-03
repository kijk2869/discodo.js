const EventEmitter = require("events")
class DiscodoEventEmitter extends EventEmitter {
    constructor() {
        super()
    }

    emit(event, ...args) {
        super.emit("*", event, ...args)

        Object.defineProperties(this, [{

        }])

        return super.emit(event, ...args)
    }

    /**
     * @copyright 2021, zero734kr
     * @license MIT License
     * @description
     * MIT License
     *
     * Copyright (c) 2021 zero734kr
     *
     * Permission is hereby granted, free of charge, to any person obtaining a copy
     * of this software and associated documentation files (the "Software"), to deal
     * in the Software without restriction, including without limitation the rights
     * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     * copies of the Software, and to permit persons to whom the Software is
     * furnished to do so, subject to the following conditions:
     *
     * The above copyright notice and this permission notice shall be included in all
     * copies or substantial portions of the Software.
     *
     * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
     * SOFTWARE.
     */
    waitFor(event, condition, timeout = 10000) {
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

                if (condition && condition(...args)) {
                    clearTimeout(id)

                    const resolved = resolve(...args)

                    const internalListener = this.listeners(event).find(e => e[symbolId] === true)

                    if (internalListener) {
                        this.removeListener(event, internalListener)
                    }

                    return resolved
                }
            }

            listener[symbolId] = true

            this.on(event, listener)
        })
    }
}

module.exports = DiscodoEventEmitter

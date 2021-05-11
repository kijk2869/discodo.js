import { Channel, Client, Collection, Guild } from "discord.js";
import EventEmitter from "events";

declare module "discodo.js" {
    class DiscodoEventEmitter extends EventEmitter {
        waitFor(
            event: string | symbol,
            condition: (args: any) => boolean
        ): any[];
    }

    type json = Record<string, any>;

    export class AudioData {
        constructor(VoiceClient: VoiceClient, data: json);
        public voiceClient: VoiceClient;
        public _data: any;
        public context: json;
        public readonly _type: string;
        public readonly tag: string;
        public readonly id: string;
        public readonly title?: string;
        public readonly webpage_url?: string;
        public readonly thumbnail?: string;
        public readonly url?: string;
        public readonly duration?: number;
        public readonly isLive: boolean;
        public readonly uploader?: string;
        public readonly description?: string;
        public readonly subtitles: json;
        public readonly chapters: json;
        public readonly related: boolean;
        public readonly startPosition: number;
        public get isInQueue(): boolean;
        public put(): Promise<json>;
        public getContext(): Promise<json>;
        public setContext(data: json): Promise<json>;
        public moveTo(index: number): Promise<AudioData>;
        public seek(offset: number): Promise<AudioData>;
        public remove(): Promise<AudioData>;
    }

    export class AudioSource {
        constructor(VoiceClient: VoiceClient, data: json);
        public voiceClient: VoiceClient;
        public _data: any;
        public context: json;
        public readonly _type: string;
        public readonly tag: string;
        public readonly id: string;
        public readonly title?: string;
        public readonly webpage_url?: string;
        public readonly thumbnail?: string;
        public readonly url?: string;
        public readonly duration?: number;
        public readonly isLive: boolean;
        public readonly uploader?: string;
        public readonly description?: string;
        public readonly subtitles: json;
        public readonly asOf: number;
        public readonly chapters: json;
        public readonly related: boolean;
        public readonly startPosition: number;
        public readonly seekable: boolean;
        public get isInQueue(): boolean;
        public get position(): string;
        public getContext(): Promise<json>;
        public setContext(data: json): Promise<json>;
    }

    export type HTTPOptions = {
        volume?: number;
        crossafde?: number;
        autoplay?: boolean;
        filter?: json;
    };

    export class HTTPClient {
        constructor(client: VoiceClient);
        public voiceClient: VoiceClient;
        public node: Node;
        public readonly headers: {
            Authorization: string;
            "User-ID": string;
            "Guild-ID": string;
            "VoiceClient-ID": string;
        };
        public fetch(
            method: string,
            endpoint: string,
            options: RequestInit
        ): Promise<any>;
        public getSource(query: string): Promise<{ source: AudioData }>;
        public searchSources(query: string): Promise<{ sources: AudioData[] }>;
        public getVCContext(): Promise<json>;
        public setVCContext(data: json): Promise<json>;
        public putSource(source: {
            source: AudioData | AudioData[];
        }): Promise<{ source: AudioData | AudioData[] }>;
        public loadSource(query: string): Promise<AudioData | AudioData[]>;
        public getOptions(): Promise<HTTPOptions>;
        public setOptions(options: HTTPOptions): Promise<HTTPOptions>;
        public getSeek(): Promise<{
            duration: number;
            position: number;
            remain: number;
        }>;
        public seek(offset: number): Promise<void>;
        public skip(offset: number): Promise<void>;
        public pause(): Promise<void>;
        public resume(): Promise<void>;
        public shuffle(): Promise<{ entries: AudioData[] }>;
        public queue(): Promise<{ entries: AudioData[] }>;
        public getCurrent(): Promise<AudioSource>;
        public getQueueSource(tag: string | number): Promise<AudioData>;
        public setQueueSource(
            tag: string | number,
            data: {
                index?: number;
                context?: json;
                start_position?: number;
            }
        ): Promise<AudioData>;
        public removeQueueSource(
            tag: string | number
        ): Promise<{ removed: AudioData; entries: AudioData[] }>;
    }

    export class Queue extends Array<AudioData> {
        constructor(VoiceClient: VoiceClient);
        public voiceClient: VoiceClient;
        private __checkArgumentType(argument);
        public setItem(index: number, value: AudioData): AudioData;
        public delItem(index: number): AudioData[];
        public extend(value: AudioData[]): AudioData[];
        public append(value: AudioData): number;
        public remove(value: AudioData): AudioData[];
        public insert(index: number, value: AudioData): AudioData[];
        public pop(index: number): AudioData[];
        public clear(): AudioData[];
        public handleGetQueue({ entries }: { entries: AudioData[] }): void;
        public handleQueueEvent({
            name,
            args,
        }: {
            name: string;
            args: any[];
        }): any;
    }

    interface BaseSubtitle {
        guild_id: string;
    }

    export interface NoSubtitle extends BaseSubtitle {
        NoSubtitle: string;
    }

    export interface SubtitleDone extends BaseSubtitle {
        identify: string;
    }

    export interface RequestSubtitle extends SubtitleDone {
        url: string;
    }

    export interface Subtitle extends SubtitleDone {
        previous: string | null;
        current: string | null;
        next: string | null;
    }

    export class VoiceClient extends DiscodoEventEmitter {
        constructor(node: Node, id: string, guildID: string);
        public node: Node;
        public client: DJSClient;
        public id: string;
        public guildID: string;
        public channelID: string | null;
        public http: HTTPClient;
        public _state: number | null;
        public _volume: number;
        public _crossfade: number;
        public _autoplay: boolean;
        public readonly filter: json;
        public readonly context: json;
        public _current: AudioSource | null;
        public syncTask: NodeJS.Timeout;
        public queue: Queue;
        public stop(): void;
        public _VC_CHANNEL_EDITED({
            channel_id,
        }: {
            channel_id: string;
        }): string;
        public syncWithNode(): void;
        public get volume(): number;
        public get crossfade(): number;
        public get autoplay(): boolean;
        public get current(): AudioSource | null;
        public get duration(): number | null;
        public get position(): string | null;
        public get remain(): number | null;
        public handleGetState(data: any): void;
        public send(op: any, data?: any): Promise<void>;
        public query(
            op: string | symbol,
            data: any,
            event: string | symbol,
            timeout?: number
        ): Promise<any>;
        public fetchContext(): Promise<json>;
        public setContext(data: json): Promise<json>;
        public getSource(query: string): Promise<AudioData>;
        public searchSources(query: string): Promise<AudioData[]>;
        public putSource(
            source: AudioData | AudioData[]
        ): Promise<AudioData | AudioData[]>;
        public loadSource(query: string): Promise<AudioData | AudioData[]>;
        public skip(offset?: number): Promise<void>;
        public seek(offset: number): Promise<void>;
        public getOptions(): Promise<HTTPOptions>;
        public setOptions(options: HTTPOptions): Promise<HTTPOptions>;
        public setVolume(volume: number): Promise<HTTPOptions>;
        public setCrossfade(crossfade: boolean): Promise<HTTPOptions>;
        public setAutoplay(autoplay: boolean): Promise<HTTPOptions>;
        public setFilter(filter: json): Promise<HTTPOptions>;
        public pause(): Promise<void>;
        public resume(): Promise<void>;
        public shuffle(): Promise<Queue>;
        public getCurrent(): Promise<AudioSource>;
        public fetchState(): Promise<{
            id: string;
            guild_id: string;
            channel_id: string;
            state: number;
            current: AudioSource;
            duration: number;
            position: number;
            remain: number;
            remainQueue: number;
            options: HTTPOptions;
            context: json;
        }>;
        public fetchQueue(ws?: boolean): Promise<Queue>;
        public requestSubtitle(
            lang?: string,
            url?: string
        ): Promise<RequestSubtitle>;
        public getSubtitle(
            options: { lang?: string; url?: string },
            callback: (subtitle: Subtitle) => void
        ): Promise<SubtitleDone>;
        public moveTo(node: Node): Promise<VoiceClient>;
        public destroy(): Promise<{ guild_id: string }>;
    }

    class NodeConnection extends DiscodoEventEmitter {
        constructor(node: Node);
        public ws: WebSocket | null;
        public keepAliver: NodeJS.Timeout | null;
        public latency: number | null;
        public heartbeatTimeout: number;
        public node: Node;
        public state: "DISCONNECTED" | "CONNECTING" | "CONNECTED";
        public _lastAck: number;
        public _lastSend: number;
        public connect(): void;
        public handleHeartbeat(): Promise<void>;
        public sendJson(data: json): Promise<void>;
        public send(data: any): Promise<any>;
        public _open(): void;
        public _error(error: any): void;
        public _close(code: any, reason: any): void;
        public _message(payload: any): void;
        public HELLO({
            version,
            heartbeat_interval,
        }: {
            version: any;
            heartbeat_interval: number;
        }): void;
        public close(...args: any[]): Promise<void>;
    }

    export type NodeOptions = {
        client?: Client;
        host?: string;
        port?: string;
        password?: string;
        userID?: string;
        shardID?: number;
        region?: string;
    };

    export class Node extends DiscodoEventEmitter {
        constructor(options: NodeOptions);
        public client: DJSClient;
        public host: string;
        public port: string;
        public userID: string;
        public shardID: number;
        public password: string;
        public region: string;
        public voiceClients: Collection<string, VoiceClient>;
        public get URL(): string;
        public get WS_URL(): string;
        public get isConnected(): boolean;
        public connect(): Promise<true>;
        public destroy(): Promise<void>;
        public _message(Operation: string | symbol, Data: any[]): Promise<void>;
        public send(op: string | symbol, data?: any): Promise<void>;
        public onResumed(Data?: any): Promise<void>;
        public onAnyEvent(
            Operation: "RESUMED" | "VC_CREATED" | "VC_DESTROYED",
            Data: any
        ): Promise<void>;
        public getVC(guildID: string, safe?: boolean): VoiceClient;
        public discordDispatch(payload: any): Promise<void>;
        public getStatus(): Promise<any>;
    }

    interface ClientEvents {
        VC_CREATED: [VoiceClient, { guild_id: string; id: string }];
        QUEUE_EVENT: [
            VoiceClient,
            { guild_id: string; name: string; args: string }
        ];
        VC_CHANNEL_EDITED: [
            VoiceClient,
            { guild_id: string; channel_id: string }
        ];
        putSource: [VoiceClient, { guild_id: string; sources: AudioData[] }];
        loadSource: [
            VoiceClient,
            { guild_id: string; source: AudioData | AudioData[] }
        ];
        REQUIRE_NEXT_SOURCE: [
            VoiceClient,
            { guild_id: string; current: AudioSource }
        ];
        SOURCE_START: [VoiceClient, { guild_id: string; source: AudioSource }];
        SOURCE_STOP: [VoiceClient, { guild_id: string; source: AudioSource }];
        PLAYER_TRACEBACK: [
            VoiceClient,
            { guild_id: string; traceback: string }
        ];
        SOURCE_TRACEBACK: [
            VoiceClient,
            {
                guild_id: string;
                source: AudioData | AudioSource;
                traceback: string;
            }
        ];
    }

    export class DJSClient extends DiscodoEventEmitter {
        constructor(client: Client);
        public nodes: Node[];
        public GuildReservationMap: Collection<string, Node>;
        public discordSocketResponse(payload: any): void;
        public registerNode(options: NodeOptions): Promise<Node>;
        public _onVCDestroyed({ guild_id }: { guild_id: string }): void;
        public _onAnyNodeEvent(event: string | symbol, data: any): void;
        public getBestNode(): Node | Node[] | null;
        public get voiceClients(): Collection<string, VoiceClient>;
        public getVC(guildId: string, safe?: boolean): VoiceClient;
        public voiceState(guild: Guild, channelId: string): Promise<void>;
        public connect(channel: Channel, node?: Node): Promise<VoiceClient>;
        public disconnect(guild: Guild): Promise<void>;
        public destroy(guild: Guild): Promise<void>;

        public on<K extends keyof ClientEvents>(
            event: K,
            listener: (...args: ClientEvents[K]) => void
        ): this;
        public on<S extends string | symbol>(
            event: Exclude<S, keyof ClientEvents>,
            listener: (...args: any[]) => void
        ): this;

        public once<K extends keyof ClientEvents>(
            event: K,
            listener: (...args: ClientEvents[K]) => void
        ): this;
        public once<S extends string | symbol>(
            event: Exclude<S, keyof ClientEvents>,
            listener: (...args: any[]) => void
        ): this;

        public emit<K extends keyof ClientEvents>(
            event: K,
            ...args: ClientEvents[K]
        ): boolean;
        public emit<S extends string | symbol>(
            event: Exclude<S, keyof ClientEvents>,
            ...args: any[]
        ): boolean;

        public off<K extends keyof ClientEvents>(
            event: K,
            listener: (...args: ClientEvents[K]) => void
        ): this;
        public off<S extends string | symbol>(
            event: Exclude<S, keyof ClientEvents>,
            listener: (...args: any[]) => void
        ): this;

        public removeAllListeners<K extends keyof ClientEvents>(
            event?: K
        ): this;
        public removeAllListeners<S extends string | symbol>(
            event?: Exclude<S, keyof ClientEvents>
        ): this;
    }
}

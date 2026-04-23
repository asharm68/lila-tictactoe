// Nakama runtime ambient type declarations
declare namespace nkruntime {
  interface Context { userId: string; username: string; }
  interface Logger { info(msg: string): void; error(msg: string): void; debug(msg: string): void; }
  interface Presence { userId: string; sessionId: string; username: string; nodeId: string; }
  interface MatchMessage { sender: Presence; opCode: number; data: Uint8Array; }
  interface MatchDispatcher {
    broadcastMessage(opCode: number, data: string, presences: Presence[] | null, sender: Presence | null, reliable: boolean): void;
    matchLabel(label: string): void;
  }
  interface LeaderboardRecord { ownerId: string; username: string; score: number; rank: number; metadata: any; }
  interface LeaderboardRecordList { records?: LeaderboardRecord[]; }
  interface Match { matchId: string; label: string; }
  interface Nakama {
    leaderboardCreate(id: string, authoritative: boolean, sortOrder: string, operator: string, resetSchedule: string, metadata: object): void;
    leaderboardRecordWrite(id: string, owner: string, username: string, score: number, subscore: number, metadata: object, override?: any[]): void;
    leaderboardRecordsList(id: string, owners: string[], limit: number, cursor: string | null, expiry: number): LeaderboardRecordList;
    matchCreate(module: string, params: object): string;
    matchList(limit: number, authoritative: boolean | null, label: string | null, minSize: number | null, maxSize: number | null, query: string | null): Match[];
    binaryToString(data: Uint8Array): string;
  }
  interface Initializer {
    registerMatch(name: string, handlers: object): void;
    registerRpc(id: string, fn: RpcFunction): void;
  }
  type MatchInitFunction = (ctx: Context, logger: Logger, nk: Nakama, params: {[k:string]:string}) => { state: any; tickRate: number; label: string };
  type MatchJoinAttemptFunction = (ctx: Context, logger: Logger, nk: Nakama, dispatcher: MatchDispatcher, tick: number, state: any, presence: Presence, metadata: any) => { state: any; accept: boolean; rejectMessage?: string };
  type MatchJoinFunction = (ctx: Context, logger: Logger, nk: Nakama, dispatcher: MatchDispatcher, tick: number, state: any, presences: Presence[]) => { state: any } | null;
  type MatchLeaveFunction = (ctx: Context, logger: Logger, nk: Nakama, dispatcher: MatchDispatcher, tick: number, state: any, presences: Presence[]) => { state: any } | null;
  type MatchLoopFunction = (ctx: Context, logger: Logger, nk: Nakama, dispatcher: MatchDispatcher, tick: number, state: any, messages: MatchMessage[]) => { state: any } | null;
  type MatchTerminateFunction = (ctx: Context, logger: Logger, nk: Nakama, dispatcher: MatchDispatcher, tick: number, state: any, graceSeconds: number) => { state: any } | null;
  type MatchSignalFunction = (ctx: Context, logger: Logger, nk: Nakama, dispatcher: MatchDispatcher, tick: number, state: any, data: string) => { state: any; data?: string };
  type RpcFunction = (ctx: Context, logger: Logger, nk: Nakama, payload: string) => string;
}

/**
 * Socket.IO event names. Keep strings centralized so server and web
 * compile-check against the same constants.
 */
export declare const CEvent: {
    readonly CREATE_ROOM: "c:create_room";
    readonly JOIN_ROOM: "c:join_room";
    readonly SPECTATE_ROOM: "c:spectate_room";
    readonly LEAVE_ROOM: "c:leave_room";
    readonly START_MATCH: "c:start_match";
    readonly SUBMIT_ACCUSATION: "c:submit_accusation";
    readonly SUBMIT_DEFENSE: "c:submit_defense";
};
export declare const SEvent: {
    readonly ROOM_STATE: "s:room_state";
    readonly PHASE_CHANGE: "s:phase_change";
    readonly ROUND_STARTED: "s:round_started";
    readonly ACCUSATION_RECEIVED: "s:accusation_received";
    readonly DEFENSE_RECEIVED: "s:defense_received";
    readonly JURY_BUBBLE: "s:jury_bubble";
    readonly VERDICT: "s:verdict";
    readonly MATCH_END: "s:match_end";
    readonly ERROR: "s:error";
};
//# sourceMappingURL=events.d.ts.map
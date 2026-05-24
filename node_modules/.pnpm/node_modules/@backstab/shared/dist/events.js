/**
 * Socket.IO event names. Keep strings centralized so server and web
 * compile-check against the same constants.
 */
// Client -> Server
export const CEvent = {
    CREATE_ROOM: "c:create_room",
    JOIN_ROOM: "c:join_room",
    SPECTATE_ROOM: "c:spectate_room",
    LEAVE_ROOM: "c:leave_room",
    START_MATCH: "c:start_match",
    SUBMIT_ACCUSATION: "c:submit_accusation",
    SUBMIT_DEFENSE: "c:submit_defense",
};
// Server → Client
export const SEvent = {
    ROOM_STATE: "s:room_state",
    PHASE_CHANGE: "s:phase_change",
    ROUND_STARTED: "s:round_started",
    ACCUSATION_RECEIVED: "s:accusation_received",
    DEFENSE_RECEIVED: "s:defense_received",
    JURY_BUBBLE: "s:jury_bubble", // one persona's reasoning streamed
    VERDICT: "s:verdict",
    MATCH_END: "s:match_end",
    ERROR: "s:error",
};
//# sourceMappingURL=events.js.map
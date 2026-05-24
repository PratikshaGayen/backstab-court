export function computeTitles(history, playerIds) {
    if (history.length === 0 || playerIds.length === 0)
        return [];
    // Track stats per player
    const stats = {};
    for (const pid of playerIds) {
        stats[pid] = {
            timesDefended: 0,
            timesGuilty: 0,
            timesInnocent: 0,
            appealsTriggered: 0,
            totalXpGained: 0,
            totalXpLost: 0,
        };
    }
    for (const { verdict } of history) {
        const def = verdict.defendant;
        if (stats[def]) {
            stats[def].timesDefended += 1;
            if (verdict.outcome === "GUILTY")
                stats[def].timesGuilty += 1;
            if (verdict.outcome === "INNOCENT")
                stats[def].timesInnocent += 1;
            if (verdict.appealed)
                stats[def].appealsTriggered += 1;
        }
        for (const [pid, delta] of Object.entries(verdict.xpDelta)) {
            if (!stats[pid])
                continue;
            if (delta > 0)
                stats[pid].totalXpGained += delta;
            if (delta < 0)
                stats[pid].totalXpLost += Math.abs(delta);
        }
    }
    const titles = [];
    const used = new Set();
    // Most Betrayed — defended the most times
    const mostDefended = pickMax(playerIds, (p) => stats[p].timesDefended, used);
    if (mostDefended && stats[mostDefended].timesDefended > 0) {
        titles.push({
            title: "Most Betrayed",
            emoji: "🔪",
            description: `Accused ${stats[mostDefended].timesDefended} times`,
            playerId: mostDefended,
        });
        used.add(mostDefended);
    }
    // Jury's Darling — highest innocent rate
    const jurysDarling = pickMax(playerIds, (p) => (stats[p].timesDefended > 0 ? stats[p].timesInnocent / stats[p].timesDefended : 0), used);
    if (jurysDarling && stats[jurysDarling].timesInnocent > 0) {
        titles.push({
            title: "Jury's Darling",
            emoji: "💕",
            description: `Found innocent ${stats[jurysDarling].timesInnocent} time(s)`,
            playerId: jurysDarling,
        });
        used.add(jurysDarling);
    }
    // Chaos Agent — most appeals triggered
    const chaosAgent = pickMax(playerIds, (p) => stats[p].appealsTriggered, used);
    if (chaosAgent && stats[chaosAgent].appealsTriggered > 0) {
        titles.push({
            title: "Chaos Agent",
            emoji: "⚡",
            description: `Triggered ${stats[chaosAgent].appealsTriggered} appeal(s)`,
            playerId: chaosAgent,
        });
        used.add(chaosAgent);
    }
    // Silver Tongue — most XP gained overall
    const silverTongue = pickMax(playerIds, (p) => stats[p].totalXpGained, used);
    if (silverTongue && stats[silverTongue].totalXpGained > 0) {
        titles.push({
            title: "Silver Tongue",
            emoji: "🗣️",
            description: `Earned ${stats[silverTongue].totalXpGained} XP from verdicts`,
            playerId: silverTongue,
        });
        used.add(silverTongue);
    }
    // Scapegoat — most XP lost
    const scapegoat = pickMax(playerIds, (p) => stats[p].totalXpLost, used);
    if (scapegoat && stats[scapegoat].totalXpLost > 0) {
        titles.push({
            title: "Scapegoat",
            emoji: "🐐",
            description: `Lost ${stats[scapegoat].totalXpLost} XP to guilty verdicts`,
            playerId: scapegoat,
        });
    }
    return titles;
}
function pickMax(ids, scorer, exclude) {
    let best = null;
    let bestScore = -Infinity;
    for (const id of ids) {
        if (exclude.has(id))
            continue;
        const s = scorer(id);
        if (s > bestScore) {
            bestScore = s;
            best = id;
        }
    }
    return best;
}
//# sourceMappingURL=titles.js.map
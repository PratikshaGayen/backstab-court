# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json
import typing


# ---- Constants ------------------------------------------------------------

ROUNDS_PER_MATCH = 2
MIN_PLAYERS = 2
MAX_PLAYERS = 6

OUTCOME_GUILTY = "GUILTY"
OUTCOME_INNOCENT = "INNOCENT"
OUTCOME_CHAOTIC = "CHAOTIC"

PERSONAS = [
    "Stern Judge",
    "Drunk Poet",
    "Conspiracy Theorist",
    "Corporate HR",
    "Literal Toddler",
]
SUPREME_PERSONA = "Supreme Validator"

BASE_XP_STAKE = 10


# ---- Module-level helpers -------------------------------------------------

def _normalize_outcome(v) -> str:                                # FIXED: #10
    s = str(v).upper()                                           # FIXED: #10
    return s if s in (OUTCOME_GUILTY, OUTCOME_INNOCENT, OUTCOME_CHAOTIC) \
        else OUTCOME_CHAOTIC                                     # FIXED: #10


def _clamp_int(v, lo: int, hi: int) -> int:                      # FIXED: #10
    try:                                                         # FIXED: #10
        n = int(v)                                               # FIXED: #10
    except (TypeError, ValueError):                              # FIXED: #10
        n = lo                                                   # FIXED: #10
    return max(lo, min(hi, n))                                   # FIXED: #10


# ---- Contract -------------------------------------------------------------

class BackstabCourt(gl.Contract):
    """
    Backstab Court - a multiplayer party game where players accuse each other
    of absurd crimes and an AI jury of 5 conflicting personas delivers verdicts.

    The jury is powered by GenLayer's Optimistic Democracy consensus:
    - A single prompt simulates 5 personas deliberating.
    - Multiple validators run this independently.
    - prompt_comparative ensures they agree on the verdict outcome.
    - If personas split (appeal), a second method runs the Supreme Validator.
    """

    matches_json: str
    charges_pack_json: str
    owner: Address                                               # FIXED: #1
    game_server: Address                                         # FIXED: #1
    xp_total: TreeMap[Address, u256]
    wins: TreeMap[Address, u256]
    losses: TreeMap[Address, u256]

    def __init__(self, game_server_address: str = "") -> None:   # FIXED: #1
        self.owner = gl.message.sender_address                   # FIXED: #1
        if game_server_address:                                  # FIXED: #1
            self.game_server = Address(game_server_address)      # FIXED: #1
        else:                                                    # FIXED: #1
            self.game_server = gl.message.sender_address         # FIXED: #1
        self.matches_json = "[]"
        self.charges_pack_json = json.dumps([
            "AI will replace most creative jobs within 5 years",
            "Remote work makes people less ambitious",
            "Crypto is just gambling with extra steps",
            "Social media has done more harm than good for humanity",
            "Pineapple on pizza is genuinely superior",
            "College degrees are becoming worthless",
            "Money can absolutely buy happiness",
            "Cats are objectively better pets than dogs",
            "Sleep is overrated - 5 hours is enough for most people",
            "Decentralization is more important than efficiency",
        ])

    # ---- Auth helpers ---------------------------------------------------

    def _require_owner(self) -> None:                            # FIXED: #1
        if gl.message.sender_address != self.owner:              # FIXED: #1
            raise gl.vm.UserError("only owner")                  # FIXED: #1

    def _require_server(self) -> None:                           # FIXED: #1
        if gl.message.sender_address != self.game_server:        # FIXED: #1
            raise gl.vm.UserError("only game server")            # FIXED: #1

    # ---- Helpers --------------------------------------------------------

    def _load_matches(self) -> list:
        return json.loads(self.matches_json)

    def _save_matches(self, matches: list) -> None:
        self.matches_json = json.dumps(matches, sort_keys=True)   # FIXED: #20

    def _charges(self) -> list:
        return json.loads(self.charges_pack_json)

    # ---- Admin / content ------------------------------------------------

    @gl.public.write
    def set_game_server(self, new_server: str) -> None:          # FIXED: #1
        """Owner-only: rotate the authorized game server address."""
        self._require_owner()                                    # FIXED: #1
        self.game_server = Address(new_server)                   # FIXED: #1

    @gl.public.write
    def set_charges_pack(self, charges_json: str) -> int:
        """Replace the weekly charge pack. Accepts a JSON array string."""
        self._require_owner()                                    # FIXED: #1
        charges = json.loads(charges_json)
        if not isinstance(charges, list) or len(charges) == 0:
            raise gl.vm.UserError("charges must be a non-empty JSON array")
        self.charges_pack_json = json.dumps([str(c) for c in charges], sort_keys=True)   # FIXED: #20
        return len(charges)

    # ---- Match lifecycle ------------------------------------------------

    @gl.public.write
    def create_match(self, player_addresses_json: str) -> dict[str, typing.Any]:
        """
        Create a new match with the given players. Game server calls this
        after lobby fills.
        """
        self._require_server()                                   # FIXED: #1
        players = json.loads(player_addresses_json)
        if not isinstance(players, list):
            raise gl.vm.UserError("players must be a JSON array")
        if len(players) < MIN_PLAYERS or len(players) > MAX_PLAYERS:
            raise gl.vm.UserError(
                f"player count must be between {MIN_PLAYERS} and {MAX_PLAYERS}"
            )

        normalized = [Address(p).as_hex for p in players]

        matches = self._load_matches()
        match_id = len(matches)
        matches.append({
            "id": match_id,
            "players": normalized,
            "round": 0,
            "rounds": [],
            "xp_deltas": {p: 0 for p in normalized},
            "complete": False,
        })
        self._save_matches(matches)
        return {"match_id": match_id, "players": normalized}

    # ---- XP helpers -----------------------------------------------------

    def _apply_xp_delta(self, xp_delta: dict, sign: int) -> None:    # FIXED: #7
        for addr_hex, raw_delta in xp_delta.items():                 # FIXED: #7
            delta = int(raw_delta) * sign                            # FIXED: #7
            addr = Address(addr_hex)                                 # FIXED: #7
            prev_xp = int(self.xp_total.get(addr, u256(0)))          # FIXED: #7
            self.xp_total[addr] = u256(max(0, prev_xp + delta))      # FIXED: #7
            if delta > 0:                                            # FIXED: #7
                prev_w = int(self.wins.get(addr, u256(0)))           # FIXED: #7
                self.wins[addr] = u256(prev_w + 1)                   # FIXED: #7
            elif delta < 0:                                          # FIXED: #7
                prev_l = int(self.losses.get(addr, u256(0)))         # FIXED: #7
                self.losses[addr] = u256(prev_l + 1)                 # FIXED: #7

    def _reverse_xp_delta(self, xp_delta: dict) -> None:             # FIXED: #7
        for addr_hex, raw_delta in xp_delta.items():                 # FIXED: #7
            delta = int(raw_delta)                                   # FIXED: #7
            addr = Address(addr_hex)                                 # FIXED: #7
            prev_xp = int(self.xp_total.get(addr, u256(0)))          # FIXED: #7
            self.xp_total[addr] = u256(max(0, prev_xp - delta))      # FIXED: #7
            if delta > 0:                                            # FIXED: #7
                prev_w = int(self.wins.get(addr, u256(0)))           # FIXED: #7
                self.wins[addr] = u256(max(0, prev_w - 1))           # FIXED: #7
            elif delta < 0:                                          # FIXED: #7
                prev_l = int(self.losses.get(addr, u256(0)))         # FIXED: #7
                self.losses[addr] = u256(max(0, prev_l - 1))         # FIXED: #7

    @gl.public.write
    def submit_round(
        self,
        match_id: int,
        round_number: int,
        charge_text: str,
        defendant_address: str,
        accusations_json: str,
        defense_text: str,
    ) -> typing.Any:
        """
        Submit a completed round for AI jury judgment.

        The game server collects player input off-chain, then posts the batch
        here. The contract runs the AI jury via prompt_comparative and writes
        back a verdict with XP deltas.

        Parameters:
            match_id: which match
            round_number: 1..4
            charge_text: the absurd charge dealt this round
            defendant_address: hex address of the defendant
            accusations_json: JSON array of {"accuser": "0x...", "text": "..."}
            defense_text: defendant's one-sentence defense (empty if they didn't submit)
        """
        self._require_server()                                   # FIXED: #1
        matches = self._load_matches()
        if match_id < 0 or match_id >= len(matches):
            raise gl.vm.UserError(f"match_id {match_id} does not exist")

        m = matches[match_id]
        if m["complete"]:
            raise gl.vm.UserError(f"match {match_id} is already complete")
        if round_number < 1 or round_number > ROUNDS_PER_MATCH:
            raise gl.vm.UserError(f"round_number must be 1..{ROUNDS_PER_MATCH}")

        accusations = json.loads(accusations_json)
        if not isinstance(accusations, list):
            raise gl.vm.UserError("accusations_json must be a JSON array")

        # Validate defendant
        defendant_hex = Address(defendant_address).as_hex

        # Clamp text inputs before they touch state or the prompt
        charge_clean = str(charge_text)[:300]                    # FIXED: #14
        defense_clean = str(defense_text)[:300]                  # FIXED: #14

        # Build the accusation text block for the prompt
        acc_lines = []
        accuser_addresses = []
        seen_accusers: set = set()                               # FIXED: #8
        for acc in accusations:
            if not isinstance(acc, dict) or "accuser" not in acc or "text" not in acc:  # FIXED: #8
                raise gl.vm.UserError("malformed accusation entry")  # FIXED: #8
            accuser_hex = Address(acc["accuser"]).as_hex         # FIXED: #8
            if accuser_hex == defendant_hex:                     # FIXED: #8
                raise gl.vm.UserError("defendant cannot be an accuser")  # FIXED: #8
            if accuser_hex in seen_accusers:                     # FIXED: #8
                continue                                         # FIXED: #8 - skip duplicate
            seen_accusers.add(accuser_hex)                       # FIXED: #8
            text = str(acc["text"])[:240]                        # FIXED: #14 - on-chain length cap
            acc_lines.append(f"- Prosecutor {accuser_hex[:10]}...: \"{text}\"")  # FIXED: #8
            accuser_addresses.append(accuser_hex)                # FIXED: #8

        # FIXED: #9 - validate all addresses are in the match roster
        players_set = set(m["players"])                          # FIXED: #9
        if defendant_hex not in players_set:                     # FIXED: #9
            raise gl.vm.UserError("defendant not in match roster")  # FIXED: #9
        for acc_hex in accuser_addresses:                        # FIXED: #9
            if acc_hex not in players_set:                       # FIXED: #9
                raise gl.vm.UserError(f"accuser {acc_hex[:10]} not in match roster")  # FIXED: #9

        accusations_block = "\n".join(acc_lines) if acc_lines else "(No accusations submitted)"
        defense_block = f"\"{defense_clean}\"" if defense_clean.strip() else "(Defendant remained silent)"  # FIXED: #14

        is_final = round_number == ROUNDS_PER_MATCH
        stake = BASE_XP_STAKE * (2 if is_final else 1)

        # ---- Rebind for closure (closures can't capture self) ----
        _charge = charge_clean                                   # FIXED: #14
        _accusations_block = accusations_block
        _defense_block = defense_block
        _defendant_hex = defendant_hex
        _personas = PERSONAS

        def get_jury_verdict() -> str:
            task = f"""You are simulating a jury of 5 personas for a debate game called "Backstab Court".

THE HOT TAKE being debated: "{_charge}"

The DEFENDANT must argue this take is CORRECT.
The PROSECUTORS argue this take is WRONG.

ARGUMENTS AGAINST THE TAKE (from prosecutors):
{_accusations_block}

ARGUMENT FOR THE TAKE (defendant's defense):
{_defense_block}

---

You must roleplay as ALL 5 of these jury personas and judge WHO ARGUED BETTER:
1. Stern Judge - values logic, evidence, and structured reasoning
2. Drunk Poet - values passion, creativity, and emotional resonance
3. Conspiracy Theorist - values originality, hidden angles, and contrarian thinking
4. Corporate HR - values clarity, professionalism, and measured tone
5. Literal Toddler - values simplicity, humor, and gut feeling

Each persona must independently decide: GUILTY, INNOCENT, or CHAOTIC.
- GUILTY = the prosecutors made a stronger argument against the take
- INNOCENT = the defendant made a stronger argument for the take
- CHAOTIC = both sides were equally compelling or equally weak

Judge based on ARGUMENT QUALITY, not whether you personally agree with the take.

Then determine the FINAL VERDICT by majority vote among the 5 personas.
If no clear majority (e.g. 2-2-1 split), set "appealed" to true and pick the verdict that the most dramatic persona would choose.

Respond with ONLY this JSON, no markdown, no extra text:
{{
    "personas": [
        {{"persona": "Stern Judge", "verdict": "GUILTY|INNOCENT|CHAOTIC", "reasoning": "one sentence", "confidence": 1-10}},
        {{"persona": "Drunk Poet", "verdict": "GUILTY|INNOCENT|CHAOTIC", "reasoning": "one sentence", "confidence": 1-10}},
        {{"persona": "Conspiracy Theorist", "verdict": "GUILTY|INNOCENT|CHAOTIC", "reasoning": "one sentence", "confidence": 1-10}},
        {{"persona": "Corporate HR", "verdict": "GUILTY|INNOCENT|CHAOTIC", "reasoning": "one sentence", "confidence": 1-10}},
        {{"persona": "Literal Toddler", "verdict": "GUILTY|INNOCENT|CHAOTIC", "reasoning": "one sentence", "confidence": 1-10}}
    ],
    "final_verdict": "GUILTY|INNOCENT|CHAOTIC",
    "appealed": true|false
}}

Output must be parseable JSON, nothing else."""

            result = gl.nondet.exec_prompt(task)
            # Strip markdown fences if the LLM wraps it
            result = result.replace("```json", "").replace("```", "").strip()
            return result

        # ---- Run through Optimistic Democracy consensus ----
        raw = gl.eq_principle.prompt_comparative(
            get_jury_verdict,
            "The field 'final_verdict' must have the same value (GUILTY, INNOCENT, or CHAOTIC) "
            "across all validator answers. The field 'appealed' must have the same boolean value. "
            "Ignore differences in individual persona 'reasoning' strings (subjective prose). "
            "Ignore differences in 'confidence' numeric values (jitter expected). "
            "Individual persona verdicts may differ slightly between validators as long as "
            "the final_verdict and appealed fields match.",
        )

        # ---- Parse the LLM output ----
        try:
            judgment = json.loads(raw)
        except (json.JSONDecodeError, Exception):                # FIXED: #13
            # FIXED: #13 - never revert on bad LLM output, default to CHAOTIC
            judgment = {                                          # FIXED: #13
                "final_verdict": OUTCOME_CHAOTIC,                # FIXED: #13
                "appealed": True,                                # FIXED: #13
                "personas": [],                                  # FIXED: #13
            }                                                    # FIXED: #13

        # ---- Match personas by name (not index) ----
        llm_by_name: dict[str, dict] = {}                        # FIXED: #10
        for pv in judgment.get("personas", []):                  # FIXED: #10
            if isinstance(pv, dict):                             # FIXED: #10
                name = str(pv.get("persona", "")).strip()        # FIXED: #10
                if name:                                         # FIXED: #10
                    llm_by_name[name] = pv                       # FIXED: #10

        persona_results = []
        for p_name in PERSONAS:                                  # FIXED: #10
            pv = llm_by_name.get(p_name)                         # FIXED: #10
            if pv is not None:                                   # FIXED: #10
                persona_results.append({                         # FIXED: #10
                    "persona": p_name,                           # FIXED: #10
                    "verdict": _normalize_outcome(pv.get("verdict")),  # FIXED: #10
                    "reasoning": str(pv.get("reasoning", ""))[:200],   # FIXED: #10
                    "confidence": _clamp_int(pv.get("confidence", 5), 1, 10),  # FIXED: #10
                })                                               # FIXED: #10
            else:                                                # FIXED: #10
                persona_results.append({                         # FIXED: #10
                    "persona": p_name,                           # FIXED: #10
                    "verdict": OUTCOME_CHAOTIC,                  # FIXED: #10
                    "reasoning": "No response from this persona.",  # FIXED: #10
                    "confidence": 1,                             # FIXED: #10
                })                                               # FIXED: #10

        # ---- Derive final_verdict and appealed deterministically from votes ----
        # FIXED: derive appealed from votes, not LLM output
        counts = {OUTCOME_GUILTY: 0, OUTCOME_INNOCENT: 0, OUTCOME_CHAOTIC: 0}  # FIXED: deterministic
        for p in persona_results:                                # FIXED: deterministic
            v = p["verdict"]                                     # FIXED: deterministic
            counts[v] = counts.get(v, 0) + 1                     # FIXED: deterministic
        top_count = max(counts.values())                         # FIXED: deterministic
        appealed = top_count < 3                                 # FIXED: deterministic - no clean majority among 5
        final_verdict = max(counts, key=lambda k: counts[k])     # FIXED: deterministic

        # ---- XP calculation ----
        xp_delta = {}
        if final_verdict == OUTCOME_GUILTY:
            xp_delta[defendant_hex] = -stake
            per_accuser = max(1, stake // len(accuser_addresses)) if accuser_addresses else 0
            for a in accuser_addresses:
                xp_delta[a] = xp_delta.get(a, 0) + per_accuser
        elif final_verdict == OUTCOME_INNOCENT:
            xp_delta[defendant_hex] = stake
            per_accuser = -max(1, stake // len(accuser_addresses)) if accuser_addresses else 0
            for a in accuser_addresses:
                xp_delta[a] = xp_delta.get(a, 0) + per_accuser
        else:
            # CHAOTIC: small bonus to defendant, tiny bonus to accusers
            xp_delta[defendant_hex] = stake // 2
            for a in accuser_addresses:
                xp_delta[a] = xp_delta.get(a, 0) + 1

        # ---- Update persistent XP stats ----
        self._apply_xp_delta(xp_delta, +1)  # FIXED: #7

        # ---- Build round record ----
        round_record = {
            "round": round_number,
            "charge": charge_clean,                              # FIXED: #14
            "defendant": defendant_hex,
            "accusations": accusations,
            "defense": defense_clean,                            # FIXED: #14
            "verdict": {
                "defendant": defendant_hex,
                "outcome": final_verdict,
                "appealed": appealed,
                "personas": persona_results,
                "xp_delta": xp_delta,
            },
        }

        m["rounds"].append(round_record)
        m["round"] = round_number

        # Update cumulative match XP
        for addr_hex, delta in xp_delta.items():
            m["xp_deltas"][addr_hex] = m["xp_deltas"].get(addr_hex, 0) + delta

        if round_number == ROUNDS_PER_MATCH:
            m["complete"] = True

        matches[match_id] = m
        self._save_matches(matches)

        return round_record["verdict"]

    @gl.public.write
    def appeal_round(
        self,
        match_id: int,
        round_number: int,
    ) -> typing.Any:
        """
        Run the Supreme Validator on an appealed round.
        Called when submit_round returns appealed=true.
        Re-evaluates with a single authoritative persona.
        """
        self._require_server()                                   # FIXED: #1
        matches = self._load_matches()
        if match_id < 0 or match_id >= len(matches):
            raise gl.vm.UserError(f"match_id {match_id} does not exist")

        m = matches[match_id]
        # Find the round
        target_round = None
        for r in m["rounds"]:
            if r["round"] == round_number:
                target_round = r
                break
        if target_round is None:
            raise gl.vm.UserError(f"round {round_number} not found in match {match_id}")

        verdict = target_round["verdict"]
        if not verdict.get("appealed", False):
            raise gl.vm.UserError(f"round {round_number} was not appealed")

        # Rebind for closure
        _charge = target_round["charge"]
        _accusations = target_round["accusations"]
        _defense = target_round["defense"]
        _personas_result = verdict["personas"]

        acc_lines = [f"- {a['accuser'][:10]}...: \"{a['text']}\"" for a in _accusations]
        _acc_block = "\n".join(acc_lines) if acc_lines else "(none)"
        _def_block = f"\"{_defense}\"" if _defense.strip() else "(silent)"

        # Build summary of how the 5 personas voted
        persona_summary = "\n".join([
            f"  {p['persona']}: {p['verdict']} - \"{p['reasoning']}\""
            for p in _personas_result
        ])
        _persona_summary = persona_summary

        def get_supreme_verdict() -> str:
            task = f"""You are the SUPREME VALIDATOR in a party game courtroom called "Backstab Court".
The regular jury of 5 personas could not reach a clear majority. You must break the tie.

THE CHARGE: "{_charge}"

ACCUSATIONS:
{_acc_block}

DEFENSE:
{_def_block}

THE JURY'S SPLIT VOTES:
{_persona_summary}

As the Supreme Validator, you are wise, fair, and slightly theatrical.
Consider all arguments and the jury's reasoning, then deliver your final ruling.

Respond with ONLY this JSON, no markdown:
{{
    "verdict": "GUILTY|INNOCENT|CHAOTIC",
    "reasoning": "one dramatic sentence explaining your ruling"
}}

Output must be parseable JSON, nothing else."""

            result = gl.nondet.exec_prompt(task)
            result = result.replace("```json", "").replace("```", "").strip()
            return result

        raw = gl.eq_principle.prompt_comparative(
            get_supreme_verdict,
            "The field 'verdict' must have the same value (GUILTY, INNOCENT, or CHAOTIC) "
            "across all validator answers. Ignore differences in 'reasoning' (subjective).",
        )

        try:
            supreme = json.loads(raw)
        except json.JSONDecodeError as e:
            raise gl.vm.UserError(f"Supreme Validator did not return valid JSON: {e}")

        new_outcome = str(supreme.get("verdict", OUTCOME_CHAOTIC)).upper()
        if new_outcome not in (OUTCOME_GUILTY, OUTCOME_INNOCENT, OUTCOME_CHAOTIC):
            new_outcome = OUTCOME_CHAOTIC

        supreme_reasoning = str(supreme.get("reasoning", "The court has spoken."))[:200]

        # Recalculate XP with the new verdict
        defendant_hex = target_round["defendant"]
        accuser_addresses = [a["accuser"] for a in _accusations]
        is_final = round_number == ROUNDS_PER_MATCH
        stake = BASE_XP_STAKE * (2 if is_final else 1)
        # Appeals double the stake further
        stake = stake * 2

        new_xp_delta = {}
        if new_outcome == OUTCOME_GUILTY:
            new_xp_delta[defendant_hex] = -stake
            per_accuser = max(1, stake // len(accuser_addresses)) if accuser_addresses else 0
            for a in accuser_addresses:
                new_xp_delta[a] = new_xp_delta.get(a, 0) + per_accuser
        elif new_outcome == OUTCOME_INNOCENT:
            new_xp_delta[defendant_hex] = stake
            per_accuser = -max(1, stake // len(accuser_addresses)) if accuser_addresses else 0
            for a in accuser_addresses:
                new_xp_delta[a] = new_xp_delta.get(a, 0) + per_accuser
        else:
            new_xp_delta[defendant_hex] = stake // 2
            for a in accuser_addresses:
                new_xp_delta[a] = new_xp_delta.get(a, 0) + 1

        # Reverse old XP, apply new
        old_xp_delta = verdict.get("xp_delta", {})
        self._reverse_xp_delta(old_xp_delta)    # FIXED: #7
        self._apply_xp_delta(new_xp_delta, +1)  # FIXED: #7

        # Update the verdict in storage
        verdict["outcome"] = new_outcome
        verdict["xp_delta"] = new_xp_delta
        verdict["supreme"] = {
            "persona": SUPREME_PERSONA,
            "verdict": new_outcome,
            "reasoning": supreme_reasoning,
        }
        verdict["appealed"] = False           # FIXED: #2 - prevent replay
        verdict["appeal_resolved"] = True     # FIXED: #2 - audit trail

        # Update match xp_deltas
        for addr_hex, old_delta in old_xp_delta.items():
            m["xp_deltas"][addr_hex] = m["xp_deltas"].get(addr_hex, 0) - old_delta
        for addr_hex, delta in new_xp_delta.items():
            m["xp_deltas"][addr_hex] = m["xp_deltas"].get(addr_hex, 0) + delta

        target_round["verdict"] = verdict
        matches[match_id] = m
        self._save_matches(matches)

        return verdict

    # ---- Views ----------------------------------------------------------

    @gl.public.view
    def get_match(self, match_id: int) -> str:
        matches = self._load_matches()
        if match_id < 0 or match_id >= len(matches):
            raise gl.vm.UserError(f"match_id {match_id} does not exist")
        return json.dumps(matches[match_id], sort_keys=True)   # FIXED: #20

    @gl.public.view
    def get_match_count(self) -> int:
        return len(self._load_matches())

    @gl.public.view
    def get_charges_pack(self) -> str:
        return self.charges_pack_json

    @gl.public.view
    def get_player_stats(self, address: str) -> dict[str, typing.Any]:
        try:
            addr = Address(address)
        except Exception as e:
            raise gl.vm.UserError(f"invalid address: {e}")
        return {
            "xp": int(self.xp_total.get(addr, u256(0))),
            "wins": int(self.wins.get(addr, u256(0))),
            "losses": int(self.losses.get(addr, u256(0))),
        }

    @gl.public.view
    def get_leaderboard(self, addresses_json: str) -> str:
        """Return XP stats for a list of addresses, sorted by XP descending."""
        addresses = json.loads(addresses_json)
        results = []
        for addr_hex in addresses:
            try:
                addr = Address(addr_hex)
                results.append({
                    "address": addr_hex,
                    "xp": int(self.xp_total.get(addr, u256(0))),
                    "wins": int(self.wins.get(addr, u256(0))),
                    "losses": int(self.losses.get(addr, u256(0))),
                })
            except Exception:
                pass
        results.sort(key=lambda x: x["xp"], reverse=True)
        return json.dumps(results, sort_keys=True)   # FIXED: #20

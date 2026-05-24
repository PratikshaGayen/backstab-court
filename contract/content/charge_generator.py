"""
Weekly charge pack generator.

Run this once per week to refresh the 100-charge rotating pool.
Not a contract. Off-chain utility.

Usage:
    python charge_generator.py > charges.json
"""
import json
import os
import sys

# Placeholder for the LLM batch-generation call.
# In Phase 4 we'll wire this to the same provider the contract uses,
# so tone stays consistent.

PROMPT = """Generate 100 one-line absurd accusations for a courtroom party
game. Each should be a single phrase that fits the pattern:
"You are accused of <X>."

Rules:
- Mundane verbs + bizarre objects (e.g. "laundering") work best
- Keep it PG-13, no slurs, no real people
- Funny > edgy
- Max 15 words each

Respond with ONLY a JSON array of strings, no markdown."""


def generate() -> list[str]:
    # TODO: call LLM here. For now, return the seed pack.
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "charges.json"), "r", encoding="utf-8") as f:
        return json.load(f)


if __name__ == "__main__":
    charges = generate()
    json.dump(charges, sys.stdout, indent=2)
    sys.stdout.write("\n")

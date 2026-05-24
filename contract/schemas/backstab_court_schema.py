# Schema for integration tests (see Predikt reference §7).
backstab_court_schema = {
    "id": 1,
    "jsonrpc": "2.0",
    "result": {
        "ctor": {"kwparams": {}, "params": []},
        "methods": {
            "set_charges_pack": {
                "kwparams": {},
                "params": [["charges_json", "string"]],
                "payable": False,
                "readonly": False,
                "ret": "integer",
            },
            "create_match": {
                "kwparams": {},
                "params": [["player_addresses_json", "string"]],
                "payable": False,
                "readonly": False,
                "ret": {"$dict": "any"},
            },
            "submit_round": {
                "kwparams": {},
                "params": [
                    ["match_id", "integer"],
                    ["round_number", "integer"],
                    ["charge_text", "string"],
                    ["defendant_address", "string"],
                    ["accusations_json", "string"],
                    ["defense_text", "string"],
                ],
                "payable": False,
                "readonly": False,
                "ret": "any",
            },
            "appeal_round": {
                "kwparams": {},
                "params": [
                    ["match_id", "integer"],
                    ["round_number", "integer"],
                ],
                "payable": False,
                "readonly": False,
                "ret": "any",
            },
            "get_match": {
                "kwparams": {},
                "params": [["match_id", "integer"]],
                "readonly": True,
                "ret": "string",
            },
            "get_match_count": {
                "kwparams": {},
                "params": [],
                "readonly": True,
                "ret": "integer",
            },
            "get_charges_pack": {
                "kwparams": {},
                "params": [],
                "readonly": True,
                "ret": "string",
            },
            "get_player_stats": {
                "kwparams": {},
                "params": [["address", "string"]],
                "readonly": True,
                "ret": {"$dict": "any"},
            },
            "get_leaderboard": {
                "kwparams": {},
                "params": [["addresses_json", "string"]],
                "readonly": True,
                "ret": "string",
            },
        },
    },
}

# Contract Redeploy Required

The contract __init__ signature changed. You MUST redeploy before testing.

## Steps

1. Open GenLayer Studio (http://localhost:8080)
2. Paste the full contents of contract/backstab_court.py
3. Deploy with constructor argument:
   game_server_address = "<your server wallet 0x address>"
4. Copy the new contract address
5. Update .env in server/:
   CONTRACT_ADDRESS=<new address>
6. Restart the game server

## Verify auth works

After deploying, call set_game_server from the owner wallet if needed.

Any call to submit_round from a non-server address should return:
   UserError: only game server

## Note on existing data

Old deployed contracts have no auth and must NOT be used.
All on-chain XP from old contracts is on an unauthorized deployment
and should be considered test data only.

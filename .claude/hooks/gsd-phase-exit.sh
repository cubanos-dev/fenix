#!/usr/bin/env bash
# gsd-phase-exit — pre-commit guard for phase-closing commits.
#
# Runs `bun run phase:gate --phase <id>` before a commit whose message looks
# like a phase close. Extracts the phase id from the commit subject:
#   feat(<phase-id>): <description>          → phase-id = <phase-id>
#   feat(<phase-id>)!: <description>         → phase-id = <phase-id>
#   phase-close: <phase-id>                  → phase-id = <phase-id>
#
# Opt-in: this hook is NOT wired into lefthook.yml by default. To enable it:
#   1. Add a job to lefthook.yml under `commit-msg:`:
#        - name: phase-exit
#          run: .claude/hooks/gsd-phase-exit.sh {1}
#      (the {1} passes the commit message file path)
#   2. Run `bun run prepare` to reinstall hooks.
#
# Exit codes:
#   0  = not a phase-closing commit, or phase gate passed
#   1  = phase gate failed → commit blocked
#   2  = invalid invocation

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "gsd-phase-exit: expected commit message file path as argument" >&2
  exit 2
fi

msg_file="$1"
if [[ ! -f "$msg_file" ]]; then
  echo "gsd-phase-exit: commit message file not found: $msg_file" >&2
  exit 2
fi

subject="$(head -n 1 "$msg_file")"

phase_id=""
if [[ "$subject" =~ ^feat\(([^)]+)\)!?: ]]; then
  phase_id="${BASH_REMATCH[1]}"
elif [[ "$subject" =~ ^phase-close:[[:space:]]*([^[:space:]]+) ]]; then
  phase_id="${BASH_REMATCH[1]}"
fi

if [[ -z "$phase_id" ]]; then
  exit 0
fi

if [[ ! -d ".planning/phases/$phase_id" ]]; then
  exit 0
fi

echo "gsd-phase-exit: running phase gate for $phase_id"
if bun run phase:gate --phase "$phase_id"; then
  exit 0
fi

echo "gsd-phase-exit: phase gate failed — commit blocked" >&2
exit 1

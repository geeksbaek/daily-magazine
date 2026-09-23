#!/bin/bash
# Run every collector (each with its own time budget), then build candidates.
# A failing source never aborts the run; its status is recorded in candidates.json.
set -u
REPO="$(cd "$(dirname "$0")/.." && pwd)"
# pick a python that has the collector deps (Desktop Commander's PATH may resolve python3 to the Xcode stub)
PY="${PYTHON:-}"
if [ -z "$PY" ]; then
  for cand in python3 /Library/Frameworks/Python.framework/Versions/Current/bin/python3 /opt/homebrew/bin/python3 /usr/local/bin/python3; do
    if command -v "$cand" >/dev/null 2>&1 && "$cand" -c "import feedparser, playwright" >/dev/null 2>&1; then PY="$cand"; break; fi
  done
fi
if [ -z "$PY" ]; then echo "❌ no python3 with feedparser+playwright found — run: bash scripts/setup.sh" >&2; exit 1; fi
echo "python: $PY ($("$PY" --version 2>&1))"
export DM_RUN_DIR="${DM_RUN_DIR:-/tmp/daily-magazine/$(TZ=Asia/Seoul date +%F)}"
mkdir -p "$DM_RUN_DIR"
# one reference instant for the whole run (collectors, candidates, validation)
if [ -z "${DM_AS_OF:-}" ]; then
  if [ -f "$DM_RUN_DIR/as_of.txt" ]; then DM_AS_OF="$(cat "$DM_RUN_DIR/as_of.txt")"; else DM_AS_OF="$(date -u +%Y-%m-%dT%H:%M:00+00:00)"; echo -n "$DM_AS_OF" > "$DM_RUN_DIR/as_of.txt"; fi
fi
export DM_AS_OF
echo "as_of: $DM_AS_OF"
# never let a previous run's output masquerade as this run's (build_candidates also checks as_of)
rm -f "$DM_RUN_DIR"/{rss,sites,hn,reddit,x,x_following,threads,candidates}.json "$DM_RUN_DIR"/candidates_brief.md
LOG="$DM_RUN_DIR/collect.log"
: > "$LOG"
echo "run dir: $DM_RUN_DIR" | tee -a "$LOG"

run_with_budget() {  # name seconds cmd...
  local name="$1" budget="$2"; shift 2
  local start=$(date +%s)
  ( "$@" ) >> "$LOG" 2>&1 &
  local pid=$!
  while kill -0 "$pid" 2>/dev/null; do
    if (( $(date +%s) - start > budget )); then
      echo "⏱  $name exceeded ${budget}s — killed" | tee -a "$LOG"
      kill "$pid" 2>/dev/null; sleep 1; kill -9 "$pid" 2>/dev/null
      wait "$pid" 2>/dev/null
      return 124
    fi
    sleep 2
  done
  wait "$pid"; local rc=$?
  echo "✔ $name finished rc=$rc in $(( $(date +%s) - start ))s" | tee -a "$LOG"
  return $rc
}

cd "$REPO"
# network-bound collectors in parallel; X uses a browser so it gets its own lane
run_with_budget rss     420 "$PY" scripts/collect_rss.py &     P1=$!
run_with_budget hn      120 "$PY" scripts/collect_hn.py &      P2=$!
run_with_budget sites   300 "$PY" scripts/collect_sites.py &   P4=$!
run_with_budget reddit  900 "$PY" scripts/collect_reddit.py &  P3=$!
run_with_budget x      1500 "$PY" scripts/collect_x.py ;       X_RC=$?
run_with_budget threads 240 "$PY" scripts/collect_threads.py ; T_RC=$?
wait $P1; wait $P2; wait $P3; wait $P4

"$PY" scripts/build_candidates.py 2>&1 | tee -a "$LOG"
RC=${PIPESTATUS[0]}
echo "---- summary" | tee -a "$LOG"
"$PY" - <<PYEOF | tee -a "$LOG"
import json, os
c = json.load(open(os.path.join(os.environ["DM_RUN_DIR"], "candidates.json")))
print("date", c["date"], "| window", c["window_hours"], "h | history", len(c["history"]["issues"]), "issues")
for k, v in c["sources"].items():
    print(f"  {k:<11} {v['status']:<9} {v['count']:>4}", ("| " + "; ".join(v["errors"])[:160]) if v["errors"] else "")
print("candidates:", c["counts"])
PYEOF
if [ "$X_RC" = "2" ]; then echo "⚠️  X: not logged in — run: python3 scripts/x_login.py" | tee -a "$LOG"; fi
echo "candidates: $DM_RUN_DIR/candidates.json (brief: candidates_brief.md)"
exit $RC

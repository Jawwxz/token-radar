# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Jawwxz/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Jawwxz/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar is a launch board: it ranks every pre-token protocol a sealed snapshot holds, by what each one is worth if it launches. The snapshot is 758 protocols at or above $5,000,000 TVL, as of 14 November 2026, with a 40-protocol watchlist at a $50,000,000 floor. The board ranks 289 of them — the 40 on the watchlist plus every other rankable pre-token protocol, including the 186 that sit below the floor.

The value is not a hand-written list. Each protocol's implied value follows from the snapshot's own figures: its TVL, times a multiple calibrated from the snapshot's own token-bearing comparables (the median market-cap-to-TVL ratio of its category's tokens, shrunk toward the global median and clamped), times a growth factor from its 7-day change, a maturity factor from its age, and a breadth factor from how many chains it runs on. Live-token protocols are shown apart, at the market's own values, so a token that already trades never crowds out a protocol that has not launched. Every row carries a one-line why — the drivers behind its value — and a seven-step farm plan with a cost and a time for each step, derived from the protocol's own category, chains, TVL and age.

The dashboard is a static page with no network requests: search, category, chain and value-band filters, a sortable board, a detail view that shows the value breakdown factor by factor and recomputes the row from the same numbers, and a model panel that states every category's multiple with its median, its comparable count and its grounding tokens.

## Run it

Node 22 or newer, standard library only — nothing to install.

```sh
# From this repository's root, with the sealed snapshot at ../input/snapshot.json:
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

That writes `out/board.json` (the ranked board), `out/data.js` (the dashboard's dataset), `out/dashboard/` (the page), `out/screenshots/` (the three screenshots) and `out/dossier.json` (the dossier the judge reads). Run it twice and the outputs are byte-for-byte identical.

To look at the dashboard, open `out/dashboard/index.html` in a browser (or serve `out/` and open `dashboard/index.html`).

---

Entered on [make.fun](https://make.fun/?ref=xzsdsyqa&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

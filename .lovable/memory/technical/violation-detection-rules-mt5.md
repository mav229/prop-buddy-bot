---
name: MT5 Violation Detection Rules
description: Threshold rules and false-positive filters for Martingale/Averaging detection
type: technical
---
The violation scanner triggers a flag only when an account meets a specific threshold: at least 1 Martingale instance OR at least 2 Averaging instances within a 300-second window between consecutive closing deals on the same symbol/direction with the previous trade closed in loss.

**Batch-close false-positive filter (added 2026-04-24):** Because MongoDB only stores closing deals (entry=1) and lacks open-time data, the scanner cannot directly verify that a second trade was *opened* while the first was already in drawdown. To prevent false averaging flags on batch SL/TP/manual closes of pre-existing positions, the scanner now SKIPS pairs where:
- Time gap between closes ≤ 30 seconds, AND
- Close prices are within 0.08% of each other

This signature indicates both positions were closed simultaneously at the same price level (typical of SL hitting or batch manual close), not a fresh averaging entry. True averaging would either show a wider price spread or a longer close gap.

Implemented in `supabase/functions/scan-violations/index.ts` inside `detectTradeViolations`.

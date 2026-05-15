---
name: MT5 Violation Detection Rules
description: Threshold rules and false-positive filters for Martingale/Averaging detection
type: technical
---
The violation scanner triggers a flag only when an account meets a specific threshold: at least 1 Martingale instance OR at least 2 Averaging instances within a 300-second window between consecutive OPEN/entry deals on the same symbol/direction.

**Entry-row rule (updated 2026-05-15):** Always check the first/open row (`entry=0`) for each MT5 position. Do NOT detect averaging/martingale from the second/exit row (`entry=1`). Use the open row's timestamp and entry price as the source of truth.

For BUY positions, drawdown means the next entry price is lower than the previous entry price. For SELL positions, drawdown means the next entry price is higher than the previous entry price. Same/lower lot = Averaging; increased lot = Martingale.

Implemented in `supabase/functions/scan-violations/index.ts` inside `detectTradeViolations`.

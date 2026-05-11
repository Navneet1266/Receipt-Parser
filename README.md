# Receipt Parser

## Getting started

```bash
# 1. Install dependencies
npm run setup

# 2. Add your API key
# Edit server/.env and replace the placeholder with your real key:
#   ANTHROPIC_API_KEY=sk-ant-...
# Get one at console.anthropic.com

# 3. Run
npm run dev
# → Server:  http://localhost:3001
# → Client:  http://localhost:5173
```

**Required env var:** `ANTHROPIC_API_KEY` in `server/.env`.

**Persistence:** receipts are stored in `server/data/receipts.json` (created automatically on first upload). No database setup required — no native modules, no migrations.

---

## What did you build?

A web app that accepts a JPEG or PNG receipt photo, sends it to Claude (claude-sonnet-4-6 with vision) for structured extraction, and displays the result as an editable form. The extracted fields — merchant name, date, line items (with type labels), and total — are each annotated with a per-field confidence score from the LLM. Low-confidence fields are visually highlighted so the user knows exactly where to look. Edited data is saved to a local SQLite database via a `PUT` endpoint. Past receipts appear in a history list with a "corrected" badge if they've been edited.

---

## Biggest tradeoffs

### 1. Include all line entries, not just "items"

The spec says "line items (name + amount)." The real question is: what counts as a line item? Receipts contain taxes, tips, discounts, subtotals, fees, and per-unit prices alongside the actual items. I chose to include everything and label each row with a `type` field (`item | tax | tip | discount | subtotal | fee`).

Why it matters: if I silently dropped taxes, the displayed total would never match the sum of visible rows — which is confusing and erodes trust in the tool. By showing everything with a type label, the user can see the full picture, and a future "filter to items only" feature is trivial to add. The tradeoff is a longer table for simple receipts, but the alternative (a total that doesn't add up) is worse.

### 2. Retry once, then surface a blank form

When the LLM returns unparseable output, I retry the request once. On a second failure I return an empty `ParsedReceipt` with `overallConfidence: 0` and a notes message. The user sees a blank form they can fill in manually rather than an error screen.

The alternative is to fail loudly and make the user re-upload. I rejected this because the correction flow already handles bad extractions — a blank form IS the fallback. Retrying more than once would add latency and cost without meaningfully improving success rates (if Claude fails twice, more tries rarely help).

### 3. Per-field confidence over a global badge

Each field (merchant, date, total) and each line item carry their own confidence score from the LLM, rendered as a colored dot (green/amber/red) and subtle background tinting. I surface the number directly in a tooltip.

The alternative is a single "80% confident" banner. That's useless: it doesn't tell the user which field to check. Per-field confidence makes the correction flow concrete — the user scans for red dots rather than having to compare every field against the image. The tradeoff is that I'm trusting the LLM to self-report calibrated confidence, which it does imperfectly. But imperfect signal is still better than no signal.

---

## Where I used an LLM

- **Claude claude-sonnet-4-6 (vision API):** the core parsing step in `server/src/services/llm.ts`. Sends the receipt image as base64 with a structured prompt requesting JSON with confidence scores.
- **Claude Code:** used for scaffolding boilerplate — tsconfig, vite.config, multer setup, the SQLite schema. I wrote the prompt engineering, correction UX, and product decisions myself.
- **Prompt iteration:** wrote the system/user prompts by hand and tested against a few sample receipts. The key insight was asking for `notes` alongside confidence scores — LLMs are better at explaining why they're uncertain than at expressing uncertainty numerically alone.

---

## What I'd do with another week

1. **Image preprocessing** — crop and enhance contrast before sending to the LLM. Blurry/faded receipts are the main failure mode; a preprocessing step (sharp, jimp) would significantly improve accuracy.
2. **Partial parse recovery** — if the LLM returns valid JSON for some fields but not others, extract what's there rather than retrying the whole call.
3. **Receipt history search/filter** — date range, merchant name, "unreviewed only" filter for a batch-correction workflow.
4. **Camera capture on mobile** — `<input capture="environment">` for native camera access, since receipts are mostly photographed in the moment.
5. **Export to CSV** — one line of code but genuinely useful for expense reports.

---

## One thing I'd push back on

The spec describes the correction flow as "the most important part," and I agree — but then asks the parser to return "line items (name + amount)" as if that's obvious. It isn't. The line item data model is actually the central product decision, and it shapes everything: the edit UX, the validation logic, what gets exported, how totals are computed.

If I were talking to a PM, I'd ask: what is this data *for*? If it's expense categorization, you need item-level categories. If it's accounting, you need to separate taxable from non-taxable. If it's just "did I spend $47 at Trader Joe's," you don't need line items at all — just merchant, date, and total. The spec treats line items as an implementation detail when they're actually the product decision that everything else follows from. I'd want that conversation before building the schema.

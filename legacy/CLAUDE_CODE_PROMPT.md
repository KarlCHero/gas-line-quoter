# CheckHero Gas Line Quoter — Claude Code Context

## What this is
A single-file React app (`src/App.jsx`) for CheckHero Plumbing & Gas. It's a gas line quoting tool for tradies — they draw a pipe layout on a canvas, enter job details, and get a priced quote with AS/NZS 5601 pipe sizing. It also generates a client-facing PDF quote.

## Branding
- Company: CheckHero Plumbing & Gas
- Colours: cream background #FAF6F1, orange #E8472A, charcoal #2D2D2D
- Font: DM Sans (Google Fonts)

## App structure
Three header tabs:
1. **Quote Tool** — 3 steps: Draw → Job Details → View Quote
2. **Client Quote** — clean PDF-ready client document
3. **Settings** — all pricing config

## The canvas (Step 1 — Draw)
- SVG canvas with dot-grid (GRID = 40px snap)
- Gas meter fixed at {x:120, y:280} — orange hexagon, not interactive
- **Draw Pipe tool** — click and drag to draw pipe segments (orange lines)
- **Add Appliance tool** — click near a pipe endpoint, appliance snaps to nearest endpoint within 1.5×GRID
- **Erase tool** — click segment or appliance to delete
- **Undo** — removes last placed item
- Clicking a segment's "? m" badge opens a floating inline input at the segment midpoint to enter its length in metres
- Segment lengths are entered ON the canvas (floating popup), NOT in the left panel
- Left panel shows: tools, appliance picker (when appliance tool active), total demand summary, hint text

## Known bugs to fix first
1. Drawing doesn't work reliably — pipe segments don't always register on mouseup
2. Appliances won't place — clicking does nothing
3. Root cause is React stale closure issues in mouse event handlers — drawRef/toolRef pattern attempted but may have issues

## Pipe sizing logic — AS/NZS 5601
- Table F8: Natural Gas, Copper AS1432 Type B, 0.75 kPa reference pressure drop
- Sizes: DN15, DN20, DN25, DN32, DN40, DN50 (copper only — no PEX)
- Allowable pressure drop = supply pressure − 1.13 kPa (min at appliance, Table 5.1 NG)
- Scale capacity: Q_actual = Q_table × √(ΔP_actual / 0.75)
- Network DFS from meter node to calculate downstream MJ/hr per segment
- Longest path = meter to furthest appliance (used for table lookup)
- Pick smallest DN that handles the flow

## Appliance MJ/hr ratings (NG only)
- Cooktop: 30, Freestanding Cooker: 50, Wall/Space Heater: 25
- Ducted Heater: 120, Storage HWS: 200, Instantaneous HWS: 200

## Pricing structure (all editable in Settings)
- Labour: call-out $95 · base $500/first 5m · extra $45/m beyond base
- Materials all-in $/m: DN15=$18, DN20=$24, DN25=$32, DN32=$42, DN40=$55, DN50=$72
- Appliance connections: cooktop $120, freestanding $145, wall heater $110, ducted $150, storage HWS $150, instant HWS $165
- Meter: connection flat $150 + copper tail $45
- Extras: penetration $45ea, digging $85/m, concrete cutting $120/m, 2-storey $150 flat
- Margin: TRUE GROSS MARGIN — price = cost ÷ (1 − margin%). Default 20%, slider 0–60%
- Wall cutting EXCLUDED — noted in client quote small print only

## Client Quote tab
- Auto-generated quote ref number
- CheckHero branded header (orange)
- Property address, "Natural Gas · Copper · All prices include GST"
- Proposed Gas Line Layout — auto-scaled SVG schematic of the drawn layout
- Scope of Works — auto-built checklist from job details
- Appliances Being Connected — grid of emoji cards
- Total Investment — inc GST price only (no breakdown shown to client), orange gradient card
- Terms: Quote Validity (30 days), Payment Terms (50% deposit), Scheduling, Compliance
- Accept CTA with phone/email
- Small print: exclusions + general conditions
- Print styles hide all tool UI

## Settings tab
- All prices editable
- Company details (name, phone, email) in DEFAULT object in code
- Pipe sizing explanation note at bottom

## Key design decisions (don't change these)
- NG only, copper only
- All internal prices ex GST; client quote shows inc GST only
- True gross margin (not markup)
- Fitting allowance absorbed into all-in $/m rates
- No routing question, no wall cutting option
- Supply pressure range: 1.2–2.75 kPa

## Your first task
Fix the canvas drawing so that:
1. Click and drag reliably creates pipe segments
2. Clicking with the Add Appliance tool reliably places appliances at or near pipe endpoints
3. Clicking a segment badge opens the inline length editor at the correct screen position

Use a browser devtools console to verify errors. The app runs on `npm run dev`.

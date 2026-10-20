# Agent Capacity Planner
Daily call-center capacity calculator. Static HTML/CSS/JavaScript, no dependencies. Serve this directory with any HTTP server. Run `npm test` to check the calculation model. Deploy to Vercel as Other (no build command). Settings are browser-local; export/import configuration for transfer. Admin settings are not an authenticated access boundary.

AHT excludes ACW. ACW is a daily total per available agent, not per call. Shrinkage is the number of unavailable agents. Capacity is not an interval-based answer-speed SLA. Reverse planning solves a selected productivity variable and sizes staff for a selected day's demand. Support contribution and agents-per-support ratio are configurable.

## PIN access
All routes pass through a server-side PIN gate. Set CAPACITY_PIN (six digits) and CAPACITY_SESSION_SECRET (32+ characters) as sensitive Vercel environment variables. Neither secret belongs in Git. Sessions use signed Secure/HttpOnly cookies and expire after eight hours; rotating either secret invalidates existing cookies. The Lock button clears the session. Missing configuration fails closed.

Failed attempts are throttled with signed browser state and a best-effort per-instance IP counter, not a distributed rate limiter. Keep Vercel deployment protection enabled. Configuration and scenarios are still browser-local. The GitHub source remains readable according to repository visibility.

## Capacity model v2
Available agents = max(0, scheduled agents - shrinkage headcount). Call-handling time = max(0, shift seconds - daily ACW). Calls per available agent = handling time / AHT; team capacity = floor(calls per available agent * (available agents + support * support contribution)). Calls per scheduled handler averages unrounded team capacity across primary agents plus reserve call-handling equivalents. ACW's default range is 0–180 minutes with a 90-minute warning threshold. Legacy browser settings and imported v1 configurations convert percentage shrinkage to headcount and per-call ACW to an estimated daily total; they are never interpreted directly as the new units.

## Reserve support
Support HC represents reserve agents who handle calls. The default reserve contribution is 100%, using the same AHT and daily ACW as other available agents. Existing configurations without the reserve-support version flag upgrade a previous 0% contribution to 100%; positive custom percentages are retained. Once upgraded, an explicitly configured 0% is respected and explained in the UI. Reserve agents contribute to team capacity, weekday coverage, and the scheduled-handler average; reverse planning includes reserve equivalents in the calls target.

## PIN on every page opening
A correct PIN issues a short-lived page-entry grant bound to a signed asset session. The entry grant is cleared when the calculator document opens. Opening or refreshing the document without a fresh entry grant returns the PIN page and clears the asset session; inputs and settings remain browser-local. Restoring a page from browser history also returns to the PIN screen. There is no persistent document unlock.

Reserve-support configuration version 2 converts saved 0% reserve contributions from earlier releases to 100% once, retaining the user's other settings.

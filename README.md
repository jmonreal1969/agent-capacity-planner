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


## Campaign planning (v3)

The existing Agent capacity view and the new Campaign queue-planning view share one PIN gate, weekday call volumes, AHT, and Agent availability assumptions. Campaign does not import actual call records. It estimates staffing against scenario targets.

Campaign defaults: 8% maximum abandonment, 120-second maximum average answered wait, 90-second assumed mean caller patience, and 77% of all queued calls answered within 120 seconds. Abandoned target count is rounded from volume × rate; handled target count is the remaining volume. Either count slider can adjust the linked percentage. All abandonments are included; no short-abandon exclusion is applied.

`campaign-model.js` implements an Erlang A / M/M/n+M stationary queue. State probabilities use log-scaled birth/death weights. Served waiting time and service-level probabilities are evaluated from the tagged FCFS customer's competing progression/abandonment transitions. Staffing searches for the smallest whole number of simultaneous agents meeting all three targets. Primary scheduled headcount then incorporates the Agent shift, daily ACW availability allowance, unavailable headcount, and weighted reserves. Campaign can estimate requirements above the Agent slider maximum; its independent active-agent search limit is editable, up to 1,000.

The model assumes uniform average arrival demand across configured operating hours, exponential service and patience, an unlimited single queue, and no retries/transfers. An observed abandon-only mean does not identify caller patience: the 90-second field is explicitly a planning assumption. Results distinguish target counts from predicted queue outcomes and are not actual performance or an interval staffing schedule. Reference: Garnett, Mandelbaum & Reiman, *Designing a Call Center with Impatient Customers* (2002).

Campaign Admin edits its targets, service threshold, operating hours, search limit, and slider ranges. Call-count ranges and AHT remain shared with Agent Admin. Changing the Campaign Admin AHT updates the shared current benchmark; a Campaign AHT scenario slider changes the current Agent scenario without rewriting that benchmark.

## Downloading and restoring backups

The homepage **Download backup** button saves a JSON file containing both dashboards' browser-local settings and current scenarios, plus a creation timestamp. It does not contain the PIN, signing secret, app source, or deployment. Restore it through **Admin → Import config / restore backup**. Both dashboard payloads are validated before applying the restore. Original Agent v1/v2 configuration imports remain supported. A normal page refresh still requires the PIN and resets Agent headcount/time sliders to their configured benchmarks, with support and shrinkage zero; an explicit backup restore can restore the saved scenario for review.

`npm test` checks the existing Agent model and PIN boundary plus Campaign flow conservation, closed-form queue cases, an independent seeded event simulation, staffing minimality, target monotonicity, range validation, and infeasible/zero-volume cases. Both new JavaScript modules must remain in the gate's asset allowlist and Vercel function `includeFiles`.

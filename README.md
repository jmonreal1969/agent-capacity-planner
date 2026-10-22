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


## Campaign performance scenarios

Campaign is now a forward simulator: keep staffing fixed and estimate handled calls, answered wait, abandonment counts/rate, and service level for each weekday. Four visible controls are primary headcount, calls per available agent, AHT, and daily ACW. These share Agent settings. Calls per agent is derived as (shift seconds - daily ACW) / AHT; editing that control solves AHT at fixed ACW within the shared range and one-second rounding. The performance goal is approximately85 calls at 4:46 AHT and 105:00 daily ACW in an 8.5-hour shift.

Available equivalents include primary agents minus unavailable headcount plus weighted support. Theoretical capacity uses all available productive staff time. For Erlang A queue outcomes, productive staff time is spread across operating hours and concurrent agents are rounded down conservatively to whole agents. This may leave predicted answers below theoretical capacity. Predicted handled and abandoned whole-call counts reconcile to incoming demand; answers are capped by theoretical capacity. Wait refers to answered calls only. Service level uses all queued calls as denominator and the Admin answer threshold (120 seconds by default).

Goals in Admin are comparisons: default maximum abandonment 3%, maximum answered wait 120 seconds, and minimum service level 75%. Changing a goal changes the met/missed indicator without changing outcomes. Blue clickable benchmarks are goals; red AHT/ACW lines are current values. Time and headcount references are edited in shared Agent Admin; the calls goal is editable in Campaign Admin.

Caller patience (90 seconds) and operating hours are under advanced Campaign settings. Patience is an assumption about all callers, rather than the observed mean among abandoned calls. The stationary Erlang A model assumes uniform mean daily demand, random arrivals, exponential service/patience, one unlimited first-come queue, and no retries/transfers or separate occupancy ceiling. These are planning estimates, not measured performance or interval forecasts. Reference: Garnett, Mandelbaum & Reiman, *Designing a Call Center with Impatient Customers* (2002).

Older browser settings/backups retain their settings identity and receive the 85-call goal benchmark when missing. Previous reverse-planning functions remain covered by model tests for compatibility; the Campaign UI uses forward outcomes.

## Downloading and restoring backups

The homepage **Download backup** button saves a JSON file containing both dashboards' browser-local settings and current scenarios, plus a creation timestamp. It does not contain the PIN, signing secret, app source, or deployment. Restore it through **Admin → Import config / restore backup**. Both dashboard payloads are validated before applying the restore. Original Agent v1/v2 configuration imports remain supported. A normal page refresh still requires the PIN and resets Agent headcount/time sliders to their configured benchmarks, with support and shrinkage zero; an explicit backup restore can restore the saved scenario for review.

`npm test` checks the existing Agent model and PIN boundary plus Campaign flow conservation, closed-form queue cases, an independent seeded event simulation, staffing minimality, target monotonicity, range validation, and infeasible/zero-volume cases. Both new JavaScript modules must remain in the gate's asset allowlist and Vercel function `includeFiles`.

## Admin and Supervisor access

The existing CAPACITY_PIN is the Admin credential. CAPACITY_SUPERVISOR_PIN is a separate case-sensitive access code (4–64 letters or numbers), stored as a sensitive environment variable. The Admin PIN remains six numeric digits. Both roles use signed HttpOnly sessions, a one-page entry grant, and PIN-on-refresh; sessions are bound to the credential version and the page bootstrap is bound to the same session.

Admin can use Menu > Create Supervisor link to share the current saved Agent configuration and Campaign configuration. The server validates the settings, compresses them, and encrypts/authenticates them with AES-256-GCM using a derived server key. The URL carries the protected snapshot; no database is required. Supervisor sign-in requires both this link and the Supervisor PIN. The snapshot is bound to the Supervisor session and stored only in an HttpOnly cookie. Create a new link after changing the settings you want to share.

Supervisor mode loads settings only from the server-validated snapshot, ignores browser Admin storage, and never persists slider scenarios. Admin, backup/import, sharing, and demand-editing controls are removed/locked; numeric equivalents are read-only while scenario sliders and benchmarks remain usable. Supervisor requests to POST /supervisor-link receive 403 even if the interface is modified. Direct server-source paths stay blocked. All browser calculations can be inspected locally; users cannot edit the encrypted shared snapshot or the Admin's saved settings with Supervisor access.

The separate PIN is a shared Supervisor credential, rather than individual employee accounts. Rotating it invalidates existing Supervisor sessions. No PIN or signing secret is embedded in client code, backup files, or Supervisor links.

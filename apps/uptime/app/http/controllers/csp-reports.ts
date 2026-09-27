/**
 * `POST /reports/csp` — where browsers send Content Security Policy violation reports, in
 * either the Reporting API or the legacy format, so the Report-Only policy can be judged
 * against real traffic before it is enforced.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { parseReports } from "@sdxc/security-headers/reports";
import { createAction } from "remix/router";

import routes from "~/routes/web";

/** How many violations one report request may log, so a crafted batch cannot flood the logs. */
const MAX_LOGGED_VIOLATIONS = 20;

/**
 * Logs each violation as a `csp.violation` warning on the request's log and answers `204`;
 * an unreadable report answers `400`, which a browser drops without retrying.
 */
export default createAction(routes.cspReports, async (ctx) => {
	let parsed = await parseReports(ctx.request);
	if (isFailure(parsed)) return new Response(null, { status: 400 });

	for (let violation of parsed.data.slice(0, MAX_LOGGED_VIOLATIONS)) {
		ctx.log.warn("csp.violation", {
			document_url: violation.documentURL,
			blocked_url: violation.blockedURL,
			directive: violation.effectiveDirective,
			disposition: violation.disposition,
			source_file: violation.sourceFile,
			line_number: violation.lineNumber,
		});
	}

	return new Response(null, { status: 204 });
});

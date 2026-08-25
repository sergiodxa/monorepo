/**
 * Form validation schema for the dashboard's quick-check action. Restricts
 * the URL field to `http:`/`https:` schemes: `checks.url()` accepts any
 * parseable URL, including schemes the probe cannot fetch, so the refinement
 * catches a `mailto:` submission as a field error and spares the team a
 * billed check that could never succeed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as f from "remix/data-schema/form-data";

/** Schemes the quick check can actually probe. */
const PROBEABLE_PROTOCOLS = ["http:", "https:"];

/** Validates the `run-ping` action form body. */
export const RunPingSchema = f.object({
	url: f.field(
		s
			.string()
			.pipe(checks.minLength(1), checks.maxLength(2048), checks.url())
			.refine(isProbeableUrl, "Enter an http:// or https:// URL."),
	),
});

export type RunPingValues = s.InferOutput<typeof RunPingSchema>;

/** Whether `value` parses as a URL this app can probe over HTTP. */
function isProbeableUrl(value: string): boolean {
	try {
		return PROBEABLE_PROTOCOLS.includes(new URL(value).protocol);
	} catch {
		return false;
	}
}

/**
 * Query validation for the report builder and its downloads. The builder submits as `GET`,
 * so everything arrives in the query string; the shape is checked here and the range and
 * monitor filter are resolved against the team in `~/app/lib/report-request`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";

import { REPORT_DIALECTS } from "~/app/lib/report-dialect";

/**
 * The builder's fields. `monitors` is one `<select>` value: `all`, `status-page:<id>` or
 * `type:<monitor type>`, so a single control chooses between the two filters.
 */
export const ReportQuerySchema = s.object({
	from: s.optional(s.string()),
	to: s.optional(s.string()),
	monitors: s.defaulted(s.string(), "all"),
	dialect: s.defaulted(s.enum_(REPORT_DIALECTS), "spreadsheet"),
});

export type ReportQuery = s.InferOutput<typeof ReportQuerySchema>;

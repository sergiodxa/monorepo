/**
 * The content checks an HTTP monitor runs against each response body, and the evaluation that
 * applies them: `contains`/`regex` fail on an empty body, `not_contains` passes on one, and the
 * verdict is the logical AND of every enabled check.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";
import { generateUUID } from "@sdxc/uuid/v4";

import { monitorContentChecks } from "~/database/schema";

/**
 * The fields {@link evaluateContentChecks} reads, declared structurally so an in-memory rule
 * from an ad-hoc `POST /api/v1/ping` runs through the same code as a stored check. `type`
 * stays `string` to match the stored column; an unknown type fails.
 */
export interface ContentCheckRule {
	type: string;
	value: string;
	case_sensitive: boolean;
	is_enabled: boolean;
}

export const ContentChecks = createModel(monitorContentChecks, {
	/** `id` comes from `beforeCreate`; the flags are columns the table declares a default for. */
	optional: ["id", "case_sensitive", "is_enabled"],

	scopes: {
		ofMonitor: (query, monitorId: string) => query.where({ monitor_id: monitorId }),
	},

	callbacks: {
		async beforeCreate(values) {
			return { ...values, id: values.id ?? generateUUID() };
		},
	},
});

/** A stored content check, as reads return it. */
export type ContentCheck = ModelRow<typeof ContentChecks>;

export default ContentChecks;

/**
 * Evaluates every enabled content check against a response body.
 *
 * @returns `true` when there are no enabled checks or every enabled check passes.
 */
export function evaluateContentChecks(checks: ContentCheckRule[], body: string): boolean {
	return checks.filter((check) => check.is_enabled).every((check) => evaluateOne(check, body));
}

/** One check's verdict; case-insensitive matching lowercases both sides, or flags the regex `i`. */
function evaluateOne(check: ContentCheckRule, body: string): boolean {
	let haystack = check.case_sensitive ? body : body.toLowerCase();
	let needle = check.case_sensitive ? check.value : check.value.toLowerCase();

	switch (check.type) {
		case "contains":
			return haystack.includes(needle);
		case "not_contains":
			return !haystack.includes(needle);
		case "regex":
			return new RegExp(check.value, check.case_sensitive ? "" : "i").test(body);
		default:
			return false;
	}
}

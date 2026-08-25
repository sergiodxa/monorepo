/**
 * Data-access model for HTTP monitor content checks. Exposes CRUD scoped to a monitor
 * and the evaluation logic that runs a monitor's enabled checks against a response
 * body: `contains`/`regex` fail on an empty body, `not_contains` passes on one, and
 * the overall result is the logical AND of every enabled check.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@pkg/uuid";

import type { InsertMonitorContentCheck } from "~/database/schema";

import { monitorContentChecks } from "~/database/schema";

/**
 * The fields {@link ContentCheck.evaluate} reads, declared structurally so an in-memory
 * rule from an ad-hoc `POST /api/v1/ping` runs through the same code as a stored check.
 * `type` stays `string` to match the stored column; {@link evaluateOne} fails unknown ones.
 */
export interface ContentCheckRule {
	type: string;
	value: string;
	case_sensitive: boolean;
	is_enabled: boolean;
}

export default class ContentCheck {
	/** Creates a content check for a monitor. */
	static async create(db: Database, monitorId: string, input: InsertMonitorContentCheck) {
		return await db.create(
			monitorContentChecks,
			{ id: generateUUID(), monitor_id: monitorId, ...input },
			{ touch: true, returnRow: true },
		);
	}

	/** Lists every content check for a monitor. */
	static async listByMonitor(db: Database, monitorId: string) {
		return await db.findMany(monitorContentChecks, { where: { monitor_id: monitorId } });
	}

	/** Finds a single content check scoped to its monitor. */
	static async findByIdForMonitor(db: Database, monitorId: string, contentCheckId: string) {
		return await db.findOne(monitorContentChecks, {
			where: { id: contentCheckId, monitor_id: monitorId },
		});
	}

	/** Deletes a content check. */
	static async deleteById(db: Database, contentCheckId: string) {
		return await db.delete(monitorContentChecks, contentCheckId);
	}

	/**
	 * Evaluates every enabled content check against a response body.
	 *
	 * @returns `true` when there are no enabled checks or every enabled check passes.
	 */
	static evaluate(checks: ContentCheckRule[], body: string): boolean {
		return checks.filter((check) => check.is_enabled).every((check) => evaluateOne(check, body));
	}
}

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

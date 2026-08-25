/**
 * Presentation rules for the record-level findings a domain sweep produces: the order
 * they are read in, and the one shape a reader will otherwise mistake for a bug. They
 * live apart from the alert pipeline because the plain-text channels and the email render
 * the same findings identically, using only the findings passed to them, with no access
 * to a database handle or Worker binding.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DnsFinding } from "~/database/schema";

/**
 * Rank of the three outcomes within one record set, so a set's findings always read
 * "gone, edited, appeared" in a fixed order regardless of how the diff bucketed them.
 */
const FINDING_KIND_ORDER: Record<DnsFinding["kind"], number> = {
	missing: 0,
	changed: 1,
	new: 2,
};

/**
 * Orders findings by the record they belong to, then by outcome, so a value edit that
 * surfaces as a `missing` plus a `new` at the same name and type reads as two adjacent
 * lines instead of two unrelated incidents scattered through the report.
 *
 * @param findings - Findings to sort in place; every caller has just built the array.
 * @returns The same array, sorted.
 */
export function sortDnsFindings(findings: DnsFinding[]): DnsFinding[] {
	return findings.sort(
		(one, other) =>
			one.name.localeCompare(other.name) ||
			one.recordType.localeCompare(other.recordType) ||
			FINDING_KIND_ORDER[one.kind] - FINDING_KIND_ORDER[other.kind],
	);
}

/**
 * Whether the findings include a `missing` and a `new` at the same name and type: the
 * shape a single value edit produces, since a record set has no identity of its own and
 * an edited value is indistinguishable, at the protocol level, from delete-then-add.
 */
export function hasRecordSetEdit(findings: readonly DnsFinding[]): boolean {
	let missing = new Set(
		findings
			.filter((finding) => finding.kind === "missing")
			.map((finding) => `${finding.name} ${finding.recordType}`),
	);

	return findings.some(
		(finding) => finding.kind === "new" && missing.has(`${finding.name} ${finding.recordType}`),
	);
}

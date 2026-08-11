/**
 * Presentation rules for the record-level findings a domain sweep produces: the order
 * they are read in, and the one shape a reader will otherwise mistake for a bug. They
 * live apart from the alert pipeline because the plain-text channels and the email render
 * the same findings and must describe them identically, and the email deliberately holds
 * no database handle or Worker binding.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DnsFinding } from "~/database/schema";

/**
 * Rank of the three outcomes within one record set, so a set's findings always read
 * "gone, edited, appeared" rather than in whatever order the diff bucketed them.
 */
const FINDING_KIND_ORDER: Record<DnsFinding["kind"], number> = {
	missing: 0,
	changed: 1,
	new: 2,
};

/**
 * Orders findings by the record they belong to, then by outcome.
 *
 * Sorting by `(name, recordType)` first is the load-bearing half: a value edited inside a
 * record set that holds several values is reported as one `missing` plus one `new`, and
 * ordering this way puts those two lines next to each other, where a reader can see they
 * are one event. Grouping by outcome instead would scatter the pair across the body and
 * make the same truthful report read as two unrelated incidents.
 *
 * Sorts in place and returns the same array, since every caller has just built it.
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
 * Whether the findings include a `missing` and a `new` at the same name and type — the
 * pair a single value edit produces.
 *
 * DNS records have no identity of their own: a record set is a set of values, so editing
 * one value is indistinguishable, at the protocol level, from deleting one and adding
 * another. The report is therefore accurate and reads like a bug, which is why the
 * channels say so in words whenever the shape is present, instead of quietly re-labelling
 * the pair as a change it cannot actually attribute.
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

/**
 * Presentation rules for the record-level findings a domain sweep produces: the order
 * they are read in, and the one shape a reader will otherwise mistake for a bug.
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

/**
 * How urgent an email-authentication finding is: `critical` breaks delivery or lets the
 * domain be spoofed, `warning` weakens a policy that is in place, and `notice` names a
 * protection the domain could add.
 */
export type EmailAuthSeverity = "critical" | "warning" | "notice";

/** Every problem the email-authentication audit of a domain can report, each with its own message. */
export const EMAIL_AUTH_FINDING_CODES = [
	"dmarc-missing",
	"dmarc-multiple",
	"dmarc-policy-none",
	"dmarc-testing",
	"dmarc-no-reports",
	"dmarc-invalid-tags",
	"spf-missing",
	"spf-multiple",
	"spf-invalid",
	"spf-too-many-lookups",
	"spf-broken-include",
	"spf-permissive-all",
	"spf-ptr",
	"mta-sts-missing",
	"mta-sts-invalid",
	"mta-sts-testing",
	"mta-sts-policy-unreachable",
	"mta-sts-mx-mismatch",
	"tls-rpt-missing",
	"tls-rpt-invalid",
	"lookup-failed",
] as const;

/** One of {@link EMAIL_AUTH_FINDING_CODES}. */
export type EmailAuthFindingCode = (typeof EMAIL_AUTH_FINDING_CODES)[number];

/**
 * One problem with how a domain authenticates its email. `values` holds the facts its
 * message interpolates, as plain strings and numbers so a finding stays JSON.
 */
export interface EmailAuthFinding {
	code: EmailAuthFindingCode;
	severity: EmailAuthSeverity;
	values: Record<string, string | number>;
}

/** Rank of each severity, so the most urgent findings read first. */
const SEVERITY_ORDER: Record<EmailAuthSeverity, number> = {
	critical: 0,
	warning: 1,
	notice: 2,
};

/**
 * Orders email-authentication findings by severity, keeping the audit's own order inside
 * each severity, which groups a protocol's findings together.
 *
 * @param findings - Findings to sort in place; every caller has just built the array.
 * @returns The same array, sorted.
 */
export function sortEmailAuthFindings(findings: EmailAuthFinding[]): EmailAuthFinding[] {
	return findings.sort(
		(one, other) => SEVERITY_ORDER[one.severity] - SEVERITY_ORDER[other.severity],
	);
}

/**
 * The translation key and values of a finding's message, under
 * `page.dnsMonitorDetail.emailAuth.findings`, keyed by the code in camelCase.
 *
 * @param finding - The finding to describe.
 * @example emailAuthFindingMessage(finding) // { key: "page.dnsMonitorDetail.emailAuth.findings.dmarcPolicyNone", values: { domain: "example.com" } }
 */
export function emailAuthFindingMessage(finding: EmailAuthFinding): {
	key: string;
	values: Record<string, string | number>;
} {
	let name = finding.code.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
	return { key: `page.dnsMonitorDetail.emailAuth.findings.${name}`, values: finding.values };
}

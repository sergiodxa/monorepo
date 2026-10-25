/**
 * Reads DMARC aggregate feedback reports (RFC 9990): the XML a mail receiver sends to a
 * `rua` address, with the reporter, the policy it saw published, and one row per sending
 * IP and outcome. Reports in the older RFC 7489 shape read the same way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";
import { XML } from "@sdxc/xml";

import type { DMARC } from "./dmarc.js";

import { RecordParseError } from "./errors.js";

/** The namespace RFC 9990 reports declare on `<feedback>`. */
export const DMARC_REPORT_NAMESPACE = "urn:ietf:params:xml:ns:dmarc-2.0";

/** Groups the aggregate report types under one import surface. */
export namespace DMARCReport {
	/** The DMARC-aligned outcome of one authentication method. */
	export type AlignedResult = "pass" | "fail";

	/** What the receiver did with the messages of a row. */
	export type Disposition = "none" | "pass" | "quarantine" | "reject";

	/** The report as a whole. */
	export interface Report {
		/** `<version>`, `null` in reports that omit it. */
		version: string | null;
		metadata: Metadata;
		policyPublished: PolicyPublished;
		records: Row[];
	}

	/** Who sent the report and the period it covers. */
	export interface Metadata {
		orgName: string;
		email: string;
		extraContactInfo: string | null;
		reportId: string;
		/** The start of the reporting period, UTC. */
		begin: Date;
		/** The end of the reporting period, UTC. */
		end: Date;
		/** Errors the reporter hit reading the policy record, such as an invalid `rua`. */
		errors: string[];
		generator: string | null;
	}

	/** The policy the receiver found published, with defaults filled in. */
	export interface PolicyPublished {
		domain: string;
		policy: DMARC.Policy;
		subdomainPolicy: DMARC.Policy | null;
		nonExistentPolicy: DMARC.Policy | null;
		dkimAlignment: DMARC.AlignmentMode | null;
		spfAlignment: DMARC.AlignmentMode | null;
		/** `treewalk` for RFC 9989 receivers, `psl` for RFC 7489 ones. */
		discoveryMethod: "psl" | "treewalk" | null;
		failureOptions: string | null;
		testing: boolean | null;
	}

	/** Why a receiver applied a different disposition than the published policy. */
	export interface OverrideReason {
		type: string;
		comment: string | null;
	}

	/** One sending IP, the messages it sent, and how they authenticated. */
	export interface Row {
		sourceIp: string;
		count: number;
		disposition: Disposition;
		dkim: AlignedResult;
		spf: AlignedResult;
		reasons: OverrideReason[];
		headerFrom: string;
		envelopeFrom: string | null;
		envelopeTo: string | null;
		/** Raw DKIM results, aligned or not. */
		dkimResults: DkimResult[];
		/** The raw SPF result for the MAIL FROM identity. */
		spfResult: SpfResult | null;
	}

	/** One DKIM signature's verification, before DMARC alignment. */
	export interface DkimResult {
		domain: string;
		/** Required since RFC 9990; `null` in older reports that left it out. */
		selector: string | null;
		result: string;
		humanResult: string | null;
	}

	/** The SPF verification of the MAIL FROM domain, before DMARC alignment. */
	export interface SpfResult {
		domain: string;
		scope: string | null;
		result: string;
		humanResult: string | null;
	}
}

/**
 * Parses an aggregate report. The root must be `<feedback>` with the required metadata,
 * published policy and at least one `<record>`; extension elements are ignored. Element
 * names compare without their namespace prefix, so a prefixed report reads the same.
 *
 * @param xml - The report document, already decompressed.
 * @returns The report, or the first way it departs from the format.
 * @example parseDmarcReport(await file.text())
 */
export function parseDmarcReport(xml: string): Result<DMARCReport.Report, RecordParseError> {
	let parsed = XML.parse(xml);
	if (isFailure(parsed)) return invalid(`The report is not XML: ${parsed.error.message}`);

	let root = parsed.data.root;
	if (localName(root.name) !== "feedback") return invalid("The root element is not <feedback>");

	let reader = new ReportReader();
	let metadata = readMetadata(reader, reader.required(root, "report_metadata"));
	let policyPublished = readPolicyPublished(reader, reader.required(root, "policy_published"));
	let records = children(root, "record").map((record) => readRow(reader, record));
	if (records.length === 0) reader.report("The report has no <record>");

	let report: DMARCReport.Report = {
		version: optionalText(root, "version"),
		metadata,
		policyPublished,
		records,
	};
	return reader.problem === null ? success(report) : invalid(reader.problem);
}

/**
 * Reads required parts of a report while remembering the first one that is missing or
 * malformed. A gap reads as an empty placeholder so the walk finishes, and the parse
 * fails with the remembered problem.
 */
class ReportReader {
	/** The first departure from the format, `null` while the report conforms. */
	problem: string | null = null;

	/** Records a departure; only the first is kept, since it is the one to fix first. */
	report(message: string): void {
		this.problem ??= message;
	}

	/** The single child named `name`, or an empty stand-in after recording its absence. */
	required(parent: XML.Element, name: string): XML.Element {
		let [child] = children(parent, name);
		if (child) return child;
		this.report(`<${localName(parent.name)}> has no <${name}>`);
		return { name, children: [] };
	}

	/** The trimmed text of a required child, which must not be empty. */
	requiredText(parent: XML.Element, name: string): string {
		let value = text(this.required(parent, name));
		if (value === "") this.report(`<${name}> is empty`);
		return value;
	}

	/** A `DispositionType` value. */
	policy(value: string, name: string): DMARC.Policy {
		if (value === "none" || value === "quarantine" || value === "reject") return value;
		this.report(`<${name}> ${value} is not a DMARC policy`);
		return "none";
	}

	/** An optional `DispositionType` child. */
	optionalPolicy(parent: XML.Element, name: string): DMARC.Policy | null {
		let value = optionalText(parent, name);
		return value === null ? null : this.policy(value, name);
	}

	/** A `DMARCResultType` value, compared case-insensitively. */
	alignedResult(value: string): DMARCReport.AlignedResult {
		let lower = value.toLowerCase();
		if (lower === "pass" || lower === "fail") return lower;
		this.report(`${value} is not a DMARC result`);
		return "fail";
	}

	/** A `date_range` bound in seconds since the epoch. */
	epoch(value: string, name: string): Date {
		if (!/^\d+$/.test(value)) this.report(`<${name}> is not seconds since the epoch`);
		return new Date(Number(value) * 1000);
	}

	/** A non-negative whole `<count>`. */
	count(value: string): number {
		let count = Number(value);
		if (Number.isSafeInteger(count) && count >= 0) return count;
		this.report("A <count> is not a whole number");
		return 0;
	}

	/** An `ActionDispositionType` value. */
	disposition(value: string): DMARCReport.Disposition {
		if (value === "none" || value === "pass" || value === "quarantine" || value === "reject") {
			return value;
		}
		this.report(`<disposition> ${value} is not a DMARC disposition`);
		return "none";
	}
}

/** The report generator metadata. */
function readMetadata(reader: ReportReader, element: XML.Element): DMARCReport.Metadata {
	let range = reader.required(element, "date_range");
	return {
		orgName: reader.requiredText(element, "org_name"),
		email: reader.requiredText(element, "email"),
		extraContactInfo: optionalText(element, "extra_contact_info"),
		reportId: reader.requiredText(element, "report_id"),
		begin: reader.epoch(reader.requiredText(range, "begin"), "begin"),
		end: reader.epoch(reader.requiredText(range, "end"), "end"),
		errors: children(element, "error").map(text),
		generator: optionalText(element, "generator"),
	};
}

/** The published policy, with absent optional elements as `null`. */
function readPolicyPublished(
	reader: ReportReader,
	element: XML.Element,
): DMARCReport.PolicyPublished {
	let discovery = optionalText(element, "discovery_method");
	let testing = optionalText(element, "testing");
	return {
		domain: reader.requiredText(element, "domain").toLowerCase(),
		policy: reader.policy(reader.requiredText(element, "p"), "p"),
		subdomainPolicy: reader.optionalPolicy(element, "sp"),
		nonExistentPolicy: reader.optionalPolicy(element, "np"),
		dkimAlignment: alignment(optionalText(element, "adkim")),
		spfAlignment: alignment(optionalText(element, "aspf")),
		discoveryMethod: discovery === "psl" || discovery === "treewalk" ? discovery : null,
		failureOptions: optionalText(element, "fo"),
		testing: testing === null ? null : testing === "y",
	};
}

/** One `<record>`: its row, identifiers and raw authentication results. */
function readRow(reader: ReportReader, element: XML.Element): DMARCReport.Row {
	let row = reader.required(element, "row");
	let evaluated = reader.required(row, "policy_evaluated");
	let identifiers = reader.required(element, "identifiers");
	let auth = reader.required(element, "auth_results");
	let [spf] = children(auth, "spf");

	return {
		sourceIp: reader.requiredText(row, "source_ip"),
		count: reader.count(reader.requiredText(row, "count")),
		disposition: reader.disposition(reader.requiredText(evaluated, "disposition")),
		dkim: reader.alignedResult(reader.requiredText(evaluated, "dkim")),
		spf: reader.alignedResult(reader.requiredText(evaluated, "spf")),
		reasons: children(evaluated, "reason").map((reason) => ({
			type: reader.requiredText(reason, "type"),
			comment: optionalText(reason, "comment"),
		})),
		headerFrom: reader.requiredText(identifiers, "header_from").toLowerCase(),
		envelopeFrom: optionalText(identifiers, "envelope_from"),
		envelopeTo: optionalText(identifiers, "envelope_to"),
		dkimResults: children(auth, "dkim").map((dkim) => ({
			domain: reader.requiredText(dkim, "domain").toLowerCase(),
			selector: optionalText(dkim, "selector"),
			result: reader.requiredText(dkim, "result").toLowerCase(),
			humanResult: optionalText(dkim, "human_result"),
		})),
		spfResult: spf
			? {
					domain: reader.requiredText(spf, "domain").toLowerCase(),
					scope: optionalText(spf, "scope"),
					result: reader.requiredText(spf, "result").toLowerCase(),
					humanResult: optionalText(spf, "human_result"),
				}
			: null,
	};
}

/** An element name without its namespace prefix. */
function localName(name: string): string {
	let colon = name.indexOf(":");
	return colon === -1 ? name : name.slice(colon + 1);
}

/** The child elements of `parent` named `name`, prefix ignored. */
function children(parent: XML.Element, name: string): XML.Element[] {
	return (parent.children ?? []).filter(
		(child): child is XML.Element => typeof child !== "string" && localName(child.name) === name,
	);
}

/** An element's text content, trimmed. */
function text(element: XML.Element): string {
	return (element.children ?? [])
		.filter((child): child is string => typeof child === "string")
		.join("")
		.trim();
}

/** The trimmed text of an optional child, `null` when absent or empty. */
function optionalText(parent: XML.Element, name: string): string | null {
	let [child] = children(parent, name);
	if (!child) return null;
	let value = text(child);
	return value === "" ? null : value;
}

/** An `AlignmentType` value, `null` when absent or unrecognized. */
function alignment(value: string | null): DMARC.AlignmentMode | null {
	if (value === "s") return "strict";
	if (value === "r") return "relaxed";
	return null;
}

/** The failure for a document that is not an aggregate report. */
function invalid(message: string): Result<never, RecordParseError> {
	return failure(new RecordParseError("dmarc-report", message));
}

/**
 * Audits a domain's SPF policy without a message to check: reads the record, follows its
 * `include` and `redirect` targets, and counts the DNS-querying terms a receiver reaches
 * when it evaluates every mechanism, the count RFC 7208 caps at 10.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DoHError } from "@sdxc/doh";
import type { Result } from "@sdxc/result";

import { isFailure, success } from "@sdxc/result";

import type { LookupOptions } from "../lookup.js";

import { lookupTxt, normalizeDomain } from "../lookup.js";

import type { SPF } from "./record.js";

import { isSpfRecord, parseSpfRecord } from "./record.js";

/** RFC 7208 §4.6.4's cap on terms that query DNS. */
const MAX_LOOKUPS = 10;

/** The mechanism types that query DNS when evaluated. */
const DNS_MECHANISMS = new Set<SPF.Mechanism["type"]>(["include", "a", "mx", "ptr", "exists"]);

/** Something about a policy that makes receivers fail it or weakens it. */
export type SpfProblem =
	/** More DNS-querying terms than 10, which makes every evaluation reaching them `permerror`. */
	| { code: "too-many-lookups"; lookups: number }
	/** An `include` or `redirect` target that publishes no SPF record: `permerror`. */
	| { code: "target-missing"; domain: string }
	/** A domain in the tree with several SPF records: `permerror`. */
	| { code: "multiple-records"; domain: string }
	/** A domain in the tree whose record does not parse: `permerror`. */
	| { code: "invalid-record"; domain: string; message: string }
	/** An `include` or `redirect` that leads back to a domain already being evaluated. */
	| { code: "loop"; domain: string }
	/** A target the resolver could not answer for; its subtree is uncounted. */
	| { code: "lookup-failed"; domain: string; message: string }
	/** The `ptr` mechanism, which RFC 7208 asks publishers not to use. */
	| { code: "ptr-mechanism"; domain: string }
	/** `+all` (or a bare `all`), which authorizes every address on the internet. */
	| { code: "permissive-all"; domain: string };

/** What the audit found at a domain. */
export interface SpfAnalysis {
	domain: string;
	/** `none` without a record, `multiple` with several, `invalid` when it does not parse. */
	status: "none" | "multiple" | "invalid" | "found";
	record: SPF.Record | null;
	/**
	 * DNS-querying terms across the record and every `include` and `redirect` target, with
	 * a target written with macros counted once and left unexpanded.
	 */
	lookups: number;
	problems: SpfProblem[];
}

/**
 * Audits `domain`'s SPF policy. Targets stop being fetched once the count passes 10,
 * since the verdict is settled, which bounds the queries one audit makes.
 *
 * @param domain - The domain whose policy to read.
 * @param options - Resolver, signal and timeout.
 * @returns The audit, or the DNS failure that left the domain's own record unknown.
 * @example let audit = await analyzeSpf("example.com"); audit.data.lookups // 4
 */
export async function analyzeSpf(
	domain: string,
	options: LookupOptions = {},
): Promise<Result<SpfAnalysis, DoHError>> {
	let name = normalizeDomain(domain);
	let texts = await lookupTxt(name, options);
	if (isFailure(texts)) return texts;

	let records = texts.data.filter(isSpfRecord);
	let [text] = records;
	let base = { domain: name, record: null, lookups: 0 };
	if (text === undefined) return success({ ...base, status: "none", problems: [] });
	if (records.length > 1) {
		return success({
			...base,
			status: "multiple",
			problems: [{ code: "multiple-records", domain: name }],
		});
	}

	let record = parseSpfRecord(text);
	if (isFailure(record)) {
		let problems: SpfProblem[] = [
			{ code: "invalid-record", domain: name, message: record.error.message },
		];
		return success({ ...base, status: "invalid", problems });
	}

	let audit = new Audit(options);
	await audit.visit(name, record.data, [name]);
	if (audit.lookups > MAX_LOOKUPS) {
		audit.problems.unshift({ code: "too-many-lookups", lookups: audit.lookups });
	}
	return success({
		domain: name,
		status: "found",
		record: record.data,
		lookups: audit.lookups,
		problems: audit.problems,
	});
}

/** The running count and problems of one audit. */
class Audit {
	lookups = 0;
	problems: SpfProblem[] = [];
	readonly #options: LookupOptions;

	/** @param options - How targets are looked up. */
	constructor(options: LookupOptions) {
		this.#options = options;
	}

	/**
	 * Counts a record's DNS-querying terms and descends into its targets. A `redirect`
	 * counts only when no `all` mechanism makes it unreachable.
	 */
	async visit(domain: string, record: SPF.Record, path: readonly string[]): Promise<void> {
		let targets: string[] = [];
		for (let mechanism of record.mechanisms) {
			if (mechanism.type === "ptr") this.problems.push({ code: "ptr-mechanism", domain });
			if (mechanism.type === "all" && mechanism.qualifier === "+") {
				this.problems.push({ code: "permissive-all", domain });
			}
			if (!DNS_MECHANISMS.has(mechanism.type)) continue;
			this.lookups += 1;
			if (mechanism.type === "include") targets.push(mechanism.domain);
		}

		let hasAll = record.mechanisms.some((mechanism) => mechanism.type === "all");
		if (record.redirect !== null && !hasAll) {
			this.lookups += 1;
			targets.push(record.redirect);
		}

		for (let target of targets) {
			if (this.lookups > MAX_LOOKUPS) return;
			if (target.includes("%")) continue;
			await this.descend(normalizeDomain(target), path);
		}
	}

	/** Reads one target's record and visits it, recording why it cannot be. */
	async descend(target: string, path: readonly string[]): Promise<void> {
		if (path.includes(target)) {
			this.problems.push({ code: "loop", domain: target });
			return;
		}

		let texts = await lookupTxt(target, this.#options);
		if (isFailure(texts)) {
			this.problems.push({ code: "lookup-failed", domain: target, message: texts.error.message });
			return;
		}

		let records = texts.data.filter(isSpfRecord);
		let [text] = records;
		if (text === undefined) {
			this.problems.push({ code: "target-missing", domain: target });
			return;
		}
		if (records.length > 1) {
			this.problems.push({ code: "multiple-records", domain: target });
			return;
		}

		let record = parseSpfRecord(text);
		if (isFailure(record)) {
			this.problems.push({ code: "invalid-record", domain: target, message: record.error.message });
			return;
		}
		await this.visit(target, record.data, [...path, target]);
	}
}

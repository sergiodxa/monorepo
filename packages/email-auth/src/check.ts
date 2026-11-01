/**
 * One audit of everything a domain publishes to authenticate its mail: DMARC, SPF, MTA-STS
 * with its policy file and MX coverage, TLS-RPT, BIMI and DKIM per selector, each graded so
 * a dashboard, a CI job or a command line reports the same verdicts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";

import { isFailure } from "@sdxc/result";

import type { BIMI } from "./bimi.js";
import type { DMARC } from "./dmarc.js";
import type { LookupOptions } from "./lookup.js";
import type { MTASTS } from "./mta-sts.js";
import type { SpfProblem } from "./spf/analyze.js";

import { bimiDmarcShortfalls, discoverBimi } from "./bimi.js";
import { lookupDkimKey } from "./dkim.js";
import { discoverDmarc } from "./dmarc.js";
import { RecordParseError } from "./errors.js";
import { lookup, normalizeDomain } from "./lookup.js";
import { discoverMtaSts, fetchMtaStsPolicy, matchesMxPattern } from "./mta-sts.js";
import { analyzeSpf } from "./spf/analyze.js";
import { discoverTlsRpt } from "./tls-rpt.js";

/** Every policy the audit grades, in report order. */
export const EMAIL_AUTH_POLICIES = ["dmarc", "spf", "mta-sts", "tls-rpt", "bimi", "dkim"] as const;

/** Groups the audit's types under one import surface. */
export namespace EmailAuthCheck {
	/** A policy the audit grades. */
	export type Policy = (typeof EMAIL_AUTH_POLICIES)[number];

	/**
	 * `pass` is in effect, `warn` is published but weaker than it could be, `fail` is missing or
	 * discarded by receivers, and `error` is unknown because DNS or the policy host did not answer.
	 */
	export type Verdict = "pass" | "warn" | "fail" | "error";

	/** The grade of one policy, or of one DKIM selector. */
	export interface Result {
		policy: Policy;
		verdict: Verdict;
		/** The DNS name the policy is published at. */
		name: string;
		/** One line on what was found, for a person. */
		summary: string;
		/** Each reason the verdict is below `pass`, worst first. */
		problems: string[];
		/** The selector a DKIM or BIMI result was read at. */
		selector?: string;
	}

	/** The whole audit. */
	export interface Report {
		domain: string;
		/** `true` when no result is `fail` or `error`; warnings leave it `true`. */
		ok: boolean;
		results: Result[];
	}

	/** Which policies to grade and how to reach DNS and the MTA-STS policy host. */
	export interface Options extends LookupOptions {
		/** DKIM selectors to read; DKIM is graded only for the selectors listed. */
		dkimSelectors?: string[];
		/** @default "default" */
		bimiSelector?: string;
		/** Policies left out of the report and never queried. */
		skip?: Policy[];
		/**
		 * The deadline for fetching the MTA-STS policy file.
		 *
		 * @default "1 minute"
		 */
		policyTimeout?: DurationInput;
	}
}

/**
 * Audits every email-authentication policy `domain` publishes. Lookups run concurrently,
 * BIMI after DMARC because its eligibility depends on the DMARC policy; a resolver failure
 * grades only the policy it left unknown.
 *
 * @param domain - The domain mail is sent from.
 * @param options - DKIM selectors, skipped policies, resolver, signal and timeouts.
 * @returns Every result in report order, with `ok` summarizing them.
 * @example let report = await checkEmailAuth("example.com", { dkimSelectors: ["google"] })
 */
export async function checkEmailAuth(
	domain: string,
	options: EmailAuthCheck.Options = {},
): Promise<EmailAuthCheck.Report> {
	let name = normalizeDomain(domain);
	let skip = new Set(options.skip ?? []);
	let lookupOptions = lookupOptionsOf(options);
	let wanted = (policy: EmailAuthCheck.Policy) => !skip.has(policy);

	let dmarc = wanted("dmarc") || wanted("bimi") ? discoverDmarc(name, lookupOptions) : null;
	let pending: Promise<EmailAuthCheck.Result[]>[] = [
		wanted("dmarc") && dmarc ? dmarc.then((found) => [gradeDmarc(name, found)]) : none(),
		wanted("spf") ? checkSpf(name, lookupOptions).then((result) => [result]) : none(),
		wanted("mta-sts") ? checkMtaSts(name, options).then((result) => [result]) : none(),
		wanted("tls-rpt") ? checkTlsRpt(name, lookupOptions).then((result) => [result]) : none(),
		wanted("bimi") && dmarc ? checkBimi(name, dmarc, options).then((result) => [result]) : none(),
		wanted("dkim") ? checkDkim(name, options.dkimSelectors ?? [], lookupOptions) : none(),
	];
	let results = (await Promise.all(pending)).flat();
	return {
		domain: name,
		ok: results.every((result) => result.verdict === "pass" || result.verdict === "warn"),
		results,
	};
}

/** An empty contribution, for a policy left out of the report. */
function none(): Promise<EmailAuthCheck.Result[]> {
	return Promise.resolve([]);
}

/** The resolver, signal and timeout keys of the audit's options, without the audit's own. */
function lookupOptionsOf(options: EmailAuthCheck.Options): LookupOptions {
	let resolved: LookupOptions = {};
	if (options.resolver) resolved.resolver = options.resolver;
	if (options.signal) resolved.signal = options.signal;
	if (options.timeoutMs !== undefined) resolved.timeoutMs = options.timeoutMs;
	return resolved;
}

/** A result with no problems unless some are given. */
function result(
	policy: EmailAuthCheck.Policy,
	verdict: EmailAuthCheck.Verdict,
	name: string,
	summary: string,
	problems: string[] = [],
): EmailAuthCheck.Result {
	return { policy, verdict, name, summary, problems };
}

/**
 * Grades a DMARC discovery: no applicable record fails, `p=none` and `t=y` only monitor and
 * warn, discarded tag values warn, and `quarantine` or `reject` pass.
 */
function gradeDmarc(
	domain: string,
	discovery: Awaited<ReturnType<typeof discoverDmarc>>,
): EmailAuthCheck.Result {
	let name = `_dmarc.${domain}`;
	if (isFailure(discovery)) {
		return result("dmarc", "error", name, "DNS lookup failed", [discovery.error.message]);
	}
	let { record, policy, policyDomain } = discovery.data;
	if (record === null || policy === null) {
		let multiple = discovery.data.lookups.some((entry) => entry.found === "multiple");
		let problems = multiple
			? ["Several DMARC records are published, so receivers discard all of them"]
			: ["No DMARC record is published for the domain or its Organizational Domain"];
		return result("dmarc", "fail", name, "no policy", problems);
	}

	let where = policyDomain === domain ? name : `_dmarc.${policyDomain}`;
	let problems = dmarcWarnings(record, policy);
	return result("dmarc", problems.length > 0 ? "warn" : "pass", where, `p=${policy}`, problems);
}

/** Why a DMARC record that applies is weaker than enforcement. */
function dmarcWarnings(record: DMARC.Record, policy: DMARC.Policy): string[] {
	let problems: string[] = [];
	if (policy === "none") problems.push("p=none only monitors; failing mail is still delivered");
	if (record.testing) problems.push("t=y asks receivers to apply one level below the policy");
	if (record.rua.length === 0) problems.push("No rua= address, so no aggregate reports arrive");
	for (let issue of record.issues) {
		problems.push(`${issue.tag}=${issue.value} is invalid and read as its default`);
	}
	return problems;
}

/** Grades the SPF audit: missing or `permerror`-causing records fail, `ptr` warns. */
async function checkSpf(domain: string, options: LookupOptions): Promise<EmailAuthCheck.Result> {
	let audit = await analyzeSpf(domain, options);
	if (isFailure(audit)) {
		return result("spf", "error", domain, "DNS lookup failed", [audit.error.message]);
	}
	let { status, lookups, problems } = audit.data;
	if (status === "none") return result("spf", "fail", domain, "no record", ["No SPF record"]);

	let failing = problems.filter((problem) => SPF_SEVERITY[problem.code] === "fail");
	let erring = problems.filter((problem) => SPF_SEVERITY[problem.code] === "error");
	let warning = problems.filter((problem) => SPF_SEVERITY[problem.code] === "warn");
	let verdict = worstVerdict(failing.length, erring.length, warning.length);
	let ordered = [...failing, ...erring, ...warning].map(describeSpfProblem);
	let summary = status === "found" ? `${lookups} of 10 DNS lookups` : `${status} record`;
	return result("spf", verdict, domain, summary, ordered);
}

/** How each SPF problem grades: anything a receiver reads as `permerror` fails. */
const SPF_SEVERITY: { [Code in SpfProblem["code"]]: EmailAuthCheck.Verdict } = {
	"too-many-lookups": "fail",
	"target-missing": "fail",
	"multiple-records": "fail",
	"invalid-record": "fail",
	loop: "fail",
	"permissive-all": "fail",
	"lookup-failed": "error",
	"ptr-mechanism": "warn",
};

/** The worst verdict present, given how many problems of each grade were found. */
function worstVerdict(failing: number, erring: number, warning: number): EmailAuthCheck.Verdict {
	if (failing > 0) return "fail";
	if (erring > 0) return "error";
	return warning > 0 ? "warn" : "pass";
}

/** One SPF problem as a sentence. */
function describeSpfProblem(problem: SpfProblem): string {
	switch (problem.code) {
		case "too-many-lookups":
			return `${problem.lookups} DNS lookups, over the limit of 10`;
		case "target-missing":
			return `${problem.domain} publishes no SPF record`;
		case "multiple-records":
			return `${problem.domain} publishes several SPF records`;
		case "invalid-record":
			return `${problem.domain}'s record is invalid: ${problem.message}`;
		case "loop":
			return `An include or redirect loops back to ${problem.domain}`;
		case "permissive-all":
			return `${problem.domain} ends in +all, which authorizes every address`;
		case "lookup-failed":
			return `${problem.domain} could not be resolved: ${problem.message}`;
		case "ptr-mechanism":
			return `${problem.domain} uses ptr, which RFC 7208 asks publishers to avoid`;
	}
}

/** What a TXT discovery found when it is not one usable record. */
type Unusable =
	| { status: "none"; name: string }
	| { status: "multiple"; name: string; count: number }
	| { status: "invalid"; name: string; error: Error };

/** The failing grade of a TXT discovery that found no usable record. */
function unusable(
	policy: EmailAuthCheck.Policy,
	label: string,
	discovery: Unusable,
): EmailAuthCheck.Result {
	switch (discovery.status) {
		case "none":
			return result(policy, "fail", discovery.name, "no record", [`No ${label} record`]);
		case "multiple":
			return result(policy, "fail", discovery.name, "several records", [
				`${discovery.count} ${label} records are published, so receivers ignore all of them`,
			]);
		case "invalid":
			return result(policy, "fail", discovery.name, "invalid record", [discovery.error.message]);
	}
}

/**
 * Grades MTA-STS: the TXT record, then the policy file, then whether every MX host matches
 * it; an unmatched MX fails under `enforce`, since senders would refuse to deliver to it.
 */
async function checkMtaSts(
	domain: string,
	options: EmailAuthCheck.Options,
): Promise<EmailAuthCheck.Result> {
	let lookupOptions = lookupOptionsOf(options);
	let discovery = await discoverMtaSts(domain, lookupOptions);
	if (isFailure(discovery)) {
		let name = `_mta-sts.${domain}`;
		return result("mta-sts", "error", name, "DNS lookup failed", [discovery.error.message]);
	}
	if (discovery.data.status !== "found") return unusable("mta-sts", "MTA-STS", discovery.data);

	let name = discovery.data.name;
	let fetched = await fetchMtaStsPolicy(domain, {
		...(options.policyTimeout === undefined ? {} : { timeout: options.policyTimeout }),
		...(options.signal ? { signal: options.signal } : {}),
	});
	if (isFailure(fetched)) {
		let verdict: EmailAuthCheck.Verdict = fetched.error.reason === "request" ? "error" : "fail";
		return result("mta-sts", verdict, name, "policy file unusable", [fetched.error.message]);
	}
	return gradeMtaStsPolicy(domain, name, fetched.data, lookupOptions);
}

/** Grades a fetched MTA-STS policy against the domain's MX hosts. */
async function gradeMtaStsPolicy(
	domain: string,
	name: string,
	policy: MTASTS.Policy,
	options: LookupOptions,
): Promise<EmailAuthCheck.Result> {
	let summary = `mode ${policy.mode}`;
	if (policy.mode === "none") {
		return result("mta-sts", "warn", name, summary, ["mode: none withdraws the policy"]);
	}

	let mx = await lookup(domain, "MX", options);
	if (isFailure(mx)) return result("mta-sts", "error", name, summary, [mx.error.message]);
	let unmatched = mx.data.records
		.map((record) => record.exchange)
		.filter((host) => host !== "" && host !== "." && !matchesMxPattern(host, policy.mx));
	let problems = unmatched.map((host) => `MX ${host} is not listed in the policy's mx:`);
	if (policy.mode === "testing") {
		problems.push("mode: testing reports failures and still delivers over plaintext");
		return result("mta-sts", "warn", name, summary, problems);
	}
	return result("mta-sts", problems.length > 0 ? "fail" : "pass", name, summary, problems);
}

/** Grades TLS-RPT: a valid record passes, anything else fails. */
async function checkTlsRpt(domain: string, options: LookupOptions): Promise<EmailAuthCheck.Result> {
	let discovery = await discoverTlsRpt(domain, options);
	if (isFailure(discovery)) {
		let name = `_smtp._tls.${domain}`;
		return result("tls-rpt", "error", name, "DNS lookup failed", [discovery.error.message]);
	}
	if (discovery.data.status !== "found") return unusable("tls-rpt", "TLS-RPT", discovery.data);
	let { name, record } = discovery.data;
	return result("tls-rpt", "pass", name, `reports to ${record.rua.join(", ")}`);
}

/**
 * Grades BIMI: an explicit decline passes, a logo fails while the DMARC policy falls short of
 * BIMI's requirements, and a logo without a mark certificate warns.
 */
async function checkBimi(
	domain: string,
	dmarc: ReturnType<typeof discoverDmarc>,
	options: EmailAuthCheck.Options,
): Promise<EmailAuthCheck.Result> {
	let selector = options.bimiSelector ?? "default";
	let name = `${selector}._bimi.${domain}`;
	let found = await dmarc;
	if (isFailure(found)) {
		return {
			...result("bimi", "error", name, "DNS lookup failed", [found.error.message]),
			selector,
		};
	}
	let discovery = await discoverBimi(domain, {
		...lookupOptionsOf(options),
		selector,
		organizationalDomain: found.data.organizationalDomain,
	});
	if (isFailure(discovery)) {
		let problems = [discovery.error.message];
		return { ...result("bimi", "error", name, "DNS lookup failed", problems), selector };
	}
	if (discovery.data.status !== "found") {
		return { ...unusable("bimi", "BIMI", discovery.data), selector };
	}
	let graded = gradeBimiRecord(discovery.data.name, discovery.data.record, found.data);
	return { ...graded, selector };
}

/** Grades a BIMI record against the domain's DMARC discovery. */
function gradeBimiRecord(
	name: string,
	record: BIMI.Record,
	dmarc: DMARC.Discovery,
): EmailAuthCheck.Result {
	if (record.declined) return result("bimi", "pass", name, "declined");
	let problems = bimiDmarcShortfalls(dmarc).map((shortfall) => BIMI_SHORTFALLS[shortfall]);
	let summary = record.location ?? "no logo";
	if (problems.length > 0) return result("bimi", "fail", name, summary, problems);
	if (record.evidence === null) {
		let missing = ["No a= mark certificate, which most mailbox providers require"];
		return result("bimi", "warn", name, summary, missing);
	}
	return result("bimi", "pass", name, summary);
}

/** Each way DMARC keeps a BIMI logo from being shown, as a sentence. */
const BIMI_SHORTFALLS: { [Shortfall in BIMI.DmarcShortfall]: string } = {
	"no-policy": "DMARC has no policy, and BIMI needs quarantine or reject",
	"policy-none": "DMARC p=none, and BIMI needs quarantine or reject",
	"subdomain-policy-none": "DMARC sp=none, and BIMI needs quarantine or reject",
	testing: "DMARC t=y, and BIMI needs a policy out of testing",
	"partial-pct": "DMARC pct below 100, and BIMI needs it applied to all mail",
};

/** Grades each DKIM selector: a usable key passes, a missing or revoked one fails. */
function checkDkim(
	domain: string,
	selectors: readonly string[],
	options: LookupOptions,
): Promise<EmailAuthCheck.Result[]> {
	return Promise.all(
		selectors.map(async (selector) => {
			let name = `${normalizeDomain(selector)}._domainkey.${domain}`;
			let key = await lookupDkimKey(domain, selector, options);
			return { ...gradeDkimKey(name, key), selector };
		}),
	);
}

/** Grades one selector's key lookup. */
function gradeDkimKey(
	name: string,
	key: Awaited<ReturnType<typeof lookupDkimKey>>,
): EmailAuthCheck.Result {
	if (isFailure(key)) {
		let verdict: EmailAuthCheck.Verdict = key.error instanceof RecordParseError ? "fail" : "error";
		let summary = verdict === "fail" ? "invalid record" : "DNS lookup failed";
		return result("dkim", verdict, name, summary, [key.error.message]);
	}
	if (key.data === null) return result("dkim", "fail", name, "no record", ["No DKIM key"]);
	if (key.data.revoked) return result("dkim", "fail", name, "revoked", ["The key is revoked"]);
	let summary = `${key.data.keyType} key`;
	if (key.data.testing) {
		return result("dkim", "warn", name, summary, ["t=y marks the key as in testing"]);
	}
	return result("dkim", "pass", name, summary);
}

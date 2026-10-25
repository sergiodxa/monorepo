/**
 * Audits how a monitored domain authenticates its email: its DMARC policy, the SPF record and
 * its lookup count, and, for a domain that receives mail, MTA-STS and TLS-RPT. Each problem
 * becomes a finding with a severity and the values its translated message needs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DMARC, LookupOptions, MTASTS, SpfAnalysis } from "@sdxc/email-auth";

import { NameNotFoundError, resolve } from "@sdxc/doh";
import {
	analyzeSpf,
	discoverDmarc,
	discoverMtaSts,
	discoverTlsRpt,
	fetchMtaStsPolicy,
	matchesMxPattern,
	mtaStsPolicyUrl,
} from "@sdxc/email-auth";
import { isFailure } from "@sdxc/result";

import type { EmailAuthFinding } from "~/app/services/dns/findings";

import { sortEmailAuthFindings } from "~/app/services/dns/findings";

/** What the audit of one domain found. */
export interface EmailAuthCheck {
	domain: string;
	/**
	 * Whether the domain publishes a mail exchanger, `null` when the MX lookup failed. Only
	 * a domain that receives mail is held to MTA-STS and TLS-RPT.
	 */
	receivesMail: boolean | null;
	/** Most severe first. */
	findings: EmailAuthFinding[];
}

/**
 * Audits `domain`'s email authentication. Every lookup runs in parallel, and a resolver
 * failure becomes a `lookup-failed` finding for that protocol, so one bad answer never
 * reads as a missing record.
 *
 * @param domain - The monitored domain.
 * @param options - Resolver, signal and timeout for every lookup.
 * @returns The findings, most severe first; empty for a domain with nothing to fix.
 * @example let { findings } = await checkEmailAuth("example.com");
 */
export async function checkEmailAuth(
	domain: string,
	options: LookupOptions = {},
): Promise<EmailAuthCheck> {
	let name = domain.trim().toLowerCase().replace(/\.$/, "");
	let [dmarc, spf, mx] = await Promise.all([
		discoverDmarc(name, options),
		analyzeSpf(name, options),
		mailExchangers(name, options),
	]);

	let findings: EmailAuthFinding[] = [];
	if (isFailure(dmarc)) findings.push(lookupFailed("DMARC"));
	else findings.push(...dmarcFindings(name, dmarc.data));
	if (isFailure(spf)) findings.push(lookupFailed("SPF"));
	else findings.push(...spfFindings(name, spf.data));

	if (mx === null) findings.push(lookupFailed("MX"));
	if (mx !== null && mx.length > 0) findings.push(...(await receivingFindings(name, mx, options)));

	return {
		domain: name,
		receivesMail: mx === null ? null : mx.length > 0,
		findings: sortEmailAuthFindings(distinct(findings)),
	};
}

/**
 * The DMARC findings: no policy, several records, a policy that only monitors, the
 * testing flag, no aggregate reports, and values receivers discard.
 */
export function dmarcFindings(domain: string, discovery: DMARC.Discovery): EmailAuthFinding[] {
	let own = discovery.lookups.find((lookup) => lookup.domain === domain);
	if (own?.found === "multiple") {
		return [finding("dmarc-multiple", "critical", { domain: `_dmarc.${domain}` })];
	}

	let { record, policy } = discovery;
	if (record === null || policy === null) {
		return [finding("dmarc-missing", "critical", { domain: `_dmarc.${domain}` })];
	}

	let policyDomain = discovery.policyDomain ?? domain;
	let findings: EmailAuthFinding[] = [];
	if (policy === "none")
		findings.push(finding("dmarc-policy-none", "warning", { domain: policyDomain }));
	else if (record.testing)
		findings.push(finding("dmarc-testing", "warning", { domain: policyDomain }));
	if (record.issues.length > 0) {
		let tags = [...new Set(record.issues.map((issue) => issue.tag))].join(", ");
		findings.push(finding("dmarc-invalid-tags", "warning", { domain: policyDomain, tags }));
	}
	if (record.rua.length === 0) {
		findings.push(finding("dmarc-no-reports", "notice", { domain: policyDomain }));
	}
	return findings;
}

/**
 * The SPF findings: no record, several, one that does not parse, more than ten lookups,
 * a broken `include`, `+all`, and `ptr`.
 */
export function spfFindings(domain: string, audit: SpfAnalysis): EmailAuthFinding[] {
	if (audit.status === "none") return [finding("spf-missing", "critical", { domain })];
	if (audit.status === "multiple") return [finding("spf-multiple", "critical", { domain })];
	if (audit.status === "invalid") return [finding("spf-invalid", "critical", { domain })];

	let findings: EmailAuthFinding[] = [];
	for (let problem of audit.problems) {
		switch (problem.code) {
			case "too-many-lookups":
				findings.push(
					finding("spf-too-many-lookups", "critical", { domain, count: problem.lookups }),
				);
				break;
			case "target-missing":
			case "multiple-records":
			case "invalid-record":
			case "loop":
				findings.push(
					finding("spf-broken-include", "critical", { domain, target: problem.domain }),
				);
				break;
			case "permissive-all":
				findings.push(finding("spf-permissive-all", "critical", { domain: problem.domain }));
				break;
			case "ptr-mechanism":
				findings.push(finding("spf-ptr", "notice", { domain: problem.domain }));
				break;
			case "lookup-failed":
				findings.push(lookupFailed("SPF"));
				break;
		}
	}
	return findings;
}

/** The MTA-STS and TLS-RPT findings for a domain that receives mail at `mx`. */
async function receivingFindings(
	domain: string,
	mx: string[],
	options: LookupOptions,
): Promise<EmailAuthFinding[]> {
	let [sts, tlsRpt] = await Promise.all([
		discoverMtaSts(domain, options),
		discoverTlsRpt(domain, options),
	]);

	let findings: EmailAuthFinding[] = [];
	if (isFailure(sts)) findings.push(lookupFailed("MTA-STS"));
	else findings.push(...(await mtaStsFindings(domain, mx, sts.data, options)));

	if (isFailure(tlsRpt)) findings.push(lookupFailed("TLS-RPT"));
	else if (tlsRpt.data.status === "none") {
		findings.push(finding("tls-rpt-missing", "notice", { domain: `_smtp._tls.${domain}` }));
	} else if (tlsRpt.data.status !== "found") {
		findings.push(finding("tls-rpt-invalid", "warning", { domain: `_smtp._tls.${domain}` }));
	}
	return findings;
}

/**
 * The MTA-STS findings: no policy, a record senders ignore, a policy file they cannot
 * fetch, testing mode, and MX hosts the policy does not allow.
 */
export async function mtaStsFindings(
	domain: string,
	mx: string[],
	discovery: MTASTS.Discovery,
	options: Pick<LookupOptions, "signal"> = {},
): Promise<EmailAuthFinding[]> {
	if (discovery.status === "none") {
		return [finding("mta-sts-missing", "notice", { domain: `_mta-sts.${domain}` })];
	}
	if (discovery.status !== "found") {
		return [finding("mta-sts-invalid", "warning", { domain: `_mta-sts.${domain}` })];
	}

	let policy = await fetchMtaStsPolicy(domain, {
		timeout: "10 seconds",
		...(options.signal ? { signal: options.signal } : {}),
	});
	if (isFailure(policy)) {
		return [finding("mta-sts-policy-unreachable", "critical", { url: mtaStsPolicyUrl(domain) })];
	}

	let findings: EmailAuthFinding[] = [];
	if (policy.data.mode === "testing")
		findings.push(finding("mta-sts-testing", "warning", { domain }));
	if (policy.data.mode !== "none") {
		let severity: EmailAuthFinding["severity"] =
			policy.data.mode === "enforce" ? "critical" : "warning";
		for (let host of mx.filter((exchange) => !matchesMxPattern(exchange, policy.data.mx))) {
			findings.push(finding("mta-sts-mx-mismatch", severity, { domain, host }));
		}
	}
	return findings;
}

/**
 * The domain's MX hosts: empty for a domain that receives no mail, a null MX (RFC 7505)
 * included, and `null` when the resolver could not answer.
 */
async function mailExchangers(domain: string, options: LookupOptions): Promise<string[] | null> {
	let answer = await resolve(domain, "MX", {
		...(options.resolver ? { resolver: options.resolver } : {}),
		...(options.signal ? { signal: options.signal } : {}),
		...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
	});
	if (isFailure(answer)) return answer.error instanceof NameNotFoundError ? [] : null;
	return answer.data.records
		.map((record) => record.exchange.replace(/\.$/, "").toLowerCase())
		.filter((exchange) => exchange !== "" && exchange !== ".");
}

/** A finding for a protocol whose lookup the resolver could not answer. */
function lookupFailed(record: string): EmailAuthFinding {
	return finding("lookup-failed", "warning", { record });
}

/**
 * The findings with repeats removed, since several failed targets inside one SPF tree
 * each report the same unchecked protocol.
 */
function distinct(findings: EmailAuthFinding[]): EmailAuthFinding[] {
	let seen = new Set<string>();
	return findings.filter((entry) => {
		let key = JSON.stringify(entry);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/** A finding in positional form, which keeps each rule above to one line. */
function finding(
	code: EmailAuthFinding["code"],
	severity: EmailAuthFinding["severity"],
	values: EmailAuthFinding["values"],
): EmailAuthFinding {
	return { code, severity, values };
}

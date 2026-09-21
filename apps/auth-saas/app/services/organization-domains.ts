/**
 * The Worker-side half of organization domain verification (see
 * `database/organizations.ts`): looking up whether an arbitrary domain — an
 * organization's own, never a tenant's custom domain — has actually published the
 * TXT record `addOrganizationDomain` minted. The tenant object only ever trusts
 * that a lookup already ran; the lookup itself is network I/O, so it happens here,
 * against Cloudflare's public DNS-over-HTTPS resolver, and reports back through
 * `confirmOrganizationDomain` once it finds a match.
 *
 * Nothing here runs on a schedule yet — a scheduled job, or an on-demand "check
 * now" call, once either exists, calls `verifyOrganizationDomain` for a claimed
 * domain still waiting on its record, the same deferral this codebase already
 * uses for every sweep left unwired to a trigger.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type Tenant from "~/database/tenant-do";

/** Cloudflare's own DNS-over-HTTPS resolver, queried in JSON form. */
const DNS_QUERY_URL = "https://cloudflare-dns.com/dns-query";

/** The DNS record type number for TXT, as the JSON resolver's own answers carry it. */
const TXT_RECORD_TYPE = 16;

export interface VerifyOrganizationDomainInput {
	organizationId: string;
	domain: string;
}

export type VerifyOrganizationDomainResult =
	| { outcome: "verified" }
	| { outcome: "already-verified" }
	| { outcome: "no-match" }
	| { outcome: "not-found" };

/**
 * Looks up the TXT record a claimed domain expects, and marks it verified on a
 * match. Reads what to expect from `describeOrganizationDomain` rather than
 * recomputing it, so the tenant object's own record of the expected value is
 * always what this checks a real answer against.
 *
 * @param stub - The tenant's Durable Object stub.
 * @param input - The organization and domain to verify.
 * @returns Whether the domain was just verified, was already verified, has no
 * matching record yet, or names no claimed domain at all.
 */
export async function verifyOrganizationDomain(
	stub: DurableObjectStub<Tenant>,
	input: VerifyOrganizationDomainInput,
): Promise<VerifyOrganizationDomainResult> {
	let described = await stub.describeOrganizationDomain(input);
	if (!described.ok) return { outcome: "not-found" };
	if (described.verifiedAt !== null) return { outcome: "already-verified" };

	let published = await lookupTxtRecord(described.verification.name);
	if (!published.includes(described.verification.value)) return { outcome: "no-match" };

	await stub.confirmOrganizationDomain({
		organizationId: input.organizationId,
		domain: input.domain,
	});
	return { outcome: "verified" };
}

/** One answer entry the JSON resolver returns, trimmed to what a TXT lookup needs. */
interface DnsAnswer {
	type: number;
	data: string;
}

/**
 * Every TXT value currently published at a name, queried over DNS-over-HTTPS so
 * this runs from a Worker with no raw UDP socket available to it. A record
 * absent, a resolver error, or a non-OK HTTP status all answer as no values
 * published rather than throwing, since "nothing there yet" is this lookup's
 * ordinary, expected outcome while a customer's DNS change propagates.
 */
async function lookupTxtRecord(name: string): Promise<string[]> {
	let url = new URL(DNS_QUERY_URL);
	url.searchParams.set("name", name);
	url.searchParams.set("type", "TXT");

	let response = await fetch(url, { headers: { Accept: "application/dns-json" } });
	if (!response.ok) return [];

	let body = (await response.json()) as { Answer?: DnsAnswer[] };
	let answers = body.Answer ?? [];

	return answers
		.filter((answer) => answer.type === TXT_RECORD_TYPE)
		.map((answer) => unquoteTxtValue(answer.data));
}

/**
 * A TXT answer's `data` comes back wrapped in double quotes, with any quote or
 * backslash inside it escaped — the resolver's own JSON encoding of the DNS wire
 * format, not this lookup's. Strips both so the value compares equal to the
 * plain string the tenant object minted when the domain was claimed.
 */
function unquoteTxtValue(data: string): string {
	let unwrapped = data.startsWith('"') && data.endsWith('"') ? data.slice(1, -1) : data;
	return unwrapped.replace(/\\(.)/g, "$1");
}

/**
 * The Worker-side half of organization domain verification (see
 * `database/organizations.ts`): looking up whether an arbitrary domain — an
 * organization's own, never a tenant's custom domain — has actually published the
 * TXT record `addOrganizationDomain` minted. The tenant object only ever trusts
 * that a lookup already ran; the lookup itself is network I/O, so it happens here,
 * over DNS-over-HTTPS (`@sdxc/doh`), and reports back through
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

import { verifyTxtRecord } from "@sdxc/doh";
import { isFailure } from "@sdxc/result";

import type Tenant from "~/database/tenant-do";

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
 * matching record yet, or names no claimed domain at all. A resolver that cannot
 * answer reads as no match, the same outcome a record still propagating has.
 */
export async function verifyOrganizationDomain(
	stub: DurableObjectStub<Tenant>,
	input: VerifyOrganizationDomainInput,
): Promise<VerifyOrganizationDomainResult> {
	let described = await stub.describeOrganizationDomain(input);
	if (!described.ok) return { outcome: "not-found" };
	if (described.verifiedAt !== null) return { outcome: "already-verified" };

	let published = await verifyTxtRecord(described.verification.name, described.verification.value);
	if (isFailure(published) || !published.data) return { outcome: "no-match" };

	await stub.confirmOrganizationDomain({
		organizationId: input.organizationId,
		domain: input.domain,
	});
	return { outcome: "verified" };
}

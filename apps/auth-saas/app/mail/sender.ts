/**
 * The sender identity every hosted-flow message carries: the platform's own verified
 * address, with a display name derived from the tenant sending it. `ctx.tenant` names
 * only the tenant's id, region and issuer today — no `tenants.name` from the control
 * plane reaches the Worker router — so the name is stood in for by the issuer's own
 * subdomain label, which is at least particular to the tenant rather than identical
 * across every one of them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Address } from "@sdxc/mail";
import type { RequestContext } from "remix/router";

/** A generic fallback used only when an issuer somehow carries no readable label. */
const FALLBACK_SENDER_NAME = "Account";

/**
 * Parses the `"Display Name <address@host>"` shape `EMAIL_FROM` is configured as, or a
 * bare address with no display name.
 *
 * @param raw - The configured sender string.
 * @returns The address, with a name when the input carried one.
 */
export function parseSenderAddress(raw: string): Address {
	let match = /^(.*)<(.+)>$/.exec(raw.trim());
	if (!match) return { email: raw.trim() };

	let name = match[1]?.trim().replace(/^"|"$/g, "");
	let email = match[2]?.trim() ?? raw.trim();

	return name ? { email, name } : { email };
}

/**
 * Derives a display name from a tenant's own issuer hostname: the subdomain label a
 * default tenant is provisioned under, capitalized. Real per-tenant branding needs the
 * control plane's own tenant name and a verified sending domain, neither of which
 * crosses into this router yet, so this is a fallback rather than that name.
 *
 * @param issuer - The resolved tenant's issuer, as `ctx.tenant.issuer` carries it.
 * @returns The derived display name, or a generic fallback when the issuer carries
 * nothing to derive one from.
 */
export function senderNameFromIssuer(issuer: string): string {
	let hostname: string;

	try {
		hostname = new URL(issuer).hostname;
	} catch {
		return FALLBACK_SENDER_NAME;
	}

	let label = hostname.split(".")[0];
	if (!label) return FALLBACK_SENDER_NAME;

	return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * The `From` address one tenant's message sends with: the platform's own verified
 * mailbox, named for the tenant sending it.
 *
 * @param platformFrom - The platform's own configured sender, parsed from `EMAIL_FROM`.
 * @param issuer - The resolved tenant's issuer.
 * @returns The address to send this tenant's message from.
 */
export function tenantSenderAddress(platformFrom: Address, issuer: string): Address {
	return { email: platformFrom.email, name: senderNameFromIssuer(issuer) };
}

/**
 * The `From` override a hosted-flow controller sends this tenant's message with, built
 * from the same platform sender address the mail middleware itself was configured from.
 *
 * @param ctx - The request context (provides `tenant` and `platformSender`).
 * @returns The address to pass as `send()`'s `from` override.
 */
export function senderAddressFor(ctx: RequestContext): Address {
	return tenantSenderAddress(ctx.platformSender, ctx.tenant.issuer);
}

/**
 * Whether a domain can receive mail, through DNS over HTTPS: its MX hosts, the RFC 7505
 * null MX that opts out of mail, and the RFC 5321 implicit MX through A/AAAA. It proves
 * the domain accepts mail, never that a mailbox exists — that takes an SMTP probe.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { DoH, DoHError } from "@sdxc/doh";
import type { Result } from "@sdxc/result";

import { NameNotFoundError, resolve } from "@sdxc/doh";
import { failure, success } from "@sdxc/result";

/** The domain's mail hosts, as a sender would find them. */
export interface MailServers {
	domain: string;
	/** MX exchanges by ascending preference; the domain itself when `implicit`. */
	hosts: string[];
	/** The domain published no MX, so mail goes to its own A/AAAA address (RFC 5321 §5.1). */
	implicit: boolean;
	/** Seconds the answer may be cached: the smallest TTL among the records it rests on. */
	ttl: number | null;
}

/**
 * Why a domain was refused. `lookup-failed` means the answer is unknown — SERVFAIL, a
 * timeout, a resolver outage — so the caller chooses whether that fails open or closed.
 */
export type MailServerReason = "null-mx" | "no-mail-server" | "domain-not-found" | "lookup-failed";

/** The failure `checkMailServer` returns; `cause` holds the resolver's error when there was one. */
export class MailServerError extends Error {
	override name = "MailServerError";

	readonly reason: MailServerReason;

	/**
	 * @param domain - The domain checked.
	 * @param reason - Why it cannot receive mail, or that the lookup failed.
	 * @param cause - The DoH error behind `domain-not-found` and `lookup-failed`.
	 */
	constructor(domain: string, reason: MailServerReason, cause?: DoHError) {
		super(`${domain} cannot be confirmed to receive mail: ${reason}`, { cause });
		this.reason = reason;
	}
}

/** The exchange of an RFC 7505 null MX, as `@sdxc/doh` spells the root. */
const NULL_MX_EXCHANGE = ".";

/**
 * Checks that `domain` can receive mail. MX hosts win; a null MX alone refuses the
 * domain; with no MX at all, an A or AAAA record makes the domain its own mail host.
 * A failed A or AAAA lookup counts only when the other family found no address.
 *
 * @param domain - An ASCII domain, such as `EmailAddress.domain`.
 * @param options - Passed to each DoH lookup: resolver, timeout, abort signal.
 * @returns The mail hosts, or why the domain was refused.
 */
export async function checkMailServer(
	domain: string,
	options?: DoH.ResolveOptions,
): Promise<Result<MailServers, MailServerError>> {
	let mx = await resolve(domain, "MX", options);
	if (mx.status === "failure") return failure(lookupError(domain, mx.error));

	if (mx.data.records.length > 0) {
		let hosts = mx.data.records
			.filter((record) => record.exchange !== NULL_MX_EXCHANGE)
			.sort((a, b) => a.preference - b.preference)
			.map((record) => record.exchange);

		if (hosts.length === 0) return failure(new MailServerError(domain, "null-mx"));
		return success({ domain, hosts, implicit: false, ttl: mx.data.ttl });
	}

	let answers = await Promise.all([
		resolve(domain, "A", options),
		resolve(domain, "AAAA", options),
	]);

	let ttls: number[] = [];
	for (let answer of answers) {
		if (answer.status === "success" && answer.data.ttl !== null) ttls.push(answer.data.ttl);
	}
	if (ttls.length > 0) {
		return success({ domain, hosts: [domain], implicit: true, ttl: Math.min(...ttls) });
	}

	for (let answer of answers) {
		if (answer.status === "failure") return failure(lookupError(domain, answer.error));
	}

	return failure(new MailServerError(domain, "no-mail-server"));
}

/** Tells a vanished domain from a lookup whose outcome is unknown. */
function lookupError(domain: string, error: DoHError): MailServerError {
	let reason: MailServerReason =
		error instanceof NameNotFoundError ? "domain-not-found" : "lookup-failed";
	return new MailServerError(domain, reason, error);
}

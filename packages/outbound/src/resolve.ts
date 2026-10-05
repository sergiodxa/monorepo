/**
 * Resolves a URL's host over DNS-over-HTTPS and refuses it unless every address it
 * answers with is public, which is what catches a public name whose records point
 * inside a network. A Worker cannot pin a connection to the addresses checked here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DoHError } from "@sdxc/doh";
import type { Result } from "@sdxc/result";

import { NameNotFoundError, resolve } from "@sdxc/doh";
import { IP } from "@sdxc/ip";
import { failure, isFailure, isSuccess, success } from "@sdxc/result";

import { OutboundError } from "./error.js";

/** What a lookup may spend. */
export interface ResolveHostOptions {
	/** Aborts both lookups, so the caller's deadline covers resolution too. */
	signal?: AbortSignal;
}

/**
 * Resolves the `A` and `AAAA` records of a URL's host. An address literal answers
 * itself. A record the resolver could not parse is refused with the rest, since an
 * address that cannot be read cannot be judged public.
 *
 * @param url - A URL, normally one `checkUrl` already let through.
 * @param options - The signal both lookups carry.
 * @returns Every address the host resolved to, all public; `refused-host` for a name
 * with no address, `refused-address` for any address that is not public, and
 * `network` when the resolver could not answer.
 * @example let addresses = await resolveHost(new URL("https://example.com/"));
 */
export async function resolveHost(
	url: URL,
	options: ResolveHostOptions = {},
): Promise<Result<string[], OutboundError>> {
	let literal = IP.parse(url.hostname);
	if (isSuccess(literal)) return success([literal.data.toString()]);

	let host = url.hostname.replace(/\.+$/u, "");
	let lookup = options.signal ? { signal: options.signal } : {};
	let [a, aaaa] = await Promise.all([resolve(host, "A", lookup), resolve(host, "AAAA", lookup)]);

	if (isFailure(a)) return failure(lookupFailed(url, host, a.error));
	if (isFailure(aaaa)) return failure(lookupFailed(url, host, aaaa.error));

	if (a.data.unparsed.length > 0 || aaaa.data.unparsed.length > 0) {
		return failure(
			new OutboundError(
				"refused-address",
				url.href,
				`Refused ${url.href}: ${host} answered an unreadable address`,
			),
		);
	}

	let addresses = [...a.data.records, ...aaaa.data.records].map((record) => record.address);
	if (addresses.length === 0) {
		return failure(
			new OutboundError("refused-host", url.href, `Refused ${url.href}: ${host} has no address`),
		);
	}

	for (let address of addresses) {
		let ip = IP.parse(address);
		if (isSuccess(ip) && ip.data.isPublic) continue;
		return failure(
			new OutboundError(
				"refused-address",
				url.href,
				`Refused ${url.href}: ${host} resolves to ${address}`,
			),
		);
	}

	return success(addresses);
}

/**
 * Reads a failed lookup: NXDOMAIN is the name saying it does not exist, which no
 * retry changes, and every other failure is the resolver's.
 */
function lookupFailed(url: URL, host: string, error: DoHError): OutboundError {
	if (error instanceof NameNotFoundError) {
		return new OutboundError(
			"refused-host",
			url.href,
			`Refused ${url.href}: ${host} does not exist`,
		);
	}
	return new OutboundError("network", url.href, `Failed to resolve ${host}: ${error.message}`, {
		cause: error,
	});
}

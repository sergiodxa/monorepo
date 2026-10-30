/**
 * Resolves the connecting client's IP address from the one header the app's proxy
 * or edge sets, parsed into an `IP` so a forged or malformed header never becomes
 * a rate limit key or a stored address.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { IP } from "@sdxc/ip";
import { isSuccess } from "@sdxc/result";

/**
 * Headers that hosting platforms and proxies set to the connecting client's
 * address. Each one is trustworthy only where the platform in front of the app
 * overwrites it, so a caller names the single header its own platform sets.
 */
export const CLIENT_IP_HEADERS = Object.freeze([
	"CF-Connecting-IP",
	"X-Forwarded-For",
	"Forwarded",
	"X-Real-IP",
	"X-Client-IP",
	"X-Azure-ClientIP",
	"Fly-Client-IP",
	"Fastly-Client-IP",
	"True-Client-IP",
	"X-Cluster-Client-IP",
	"DO-Connecting-IP",
	"Oxygen-Buyer-IP",
] as const);

/** A header name from `CLIENT_IP_HEADERS`. */
export type ClientIPHeader = (typeof CLIENT_IP_HEADERS)[number];

/** Which header carries the client's address, and how many proxies append to it. */
export interface ClientIPOptions {
	/**
	 * The header the platform in front of the app sets. Any other name is read as
	 * a single address. Only this header is read, so a client sending another
	 * one changes nothing.
	 * @default "CF-Connecting-IP"
	 */
	header?: ClientIPHeader | (string & {});
	/**
	 * For `X-Forwarded-For` and `Forwarded`: how many trusted proxies append an
	 * entry, counted from the right. Entries left of those came from the client
	 * and are ignored; a list shorter than this, or a value that is not a
	 * positive integer, answers `null`.
	 * @default 1
	 */
	proxies?: number;
}

/**
 * Returns the client's address from the configured header. A header carrying
 * one address answers it; `X-Forwarded-For` and `Forwarded` answer the entry the
 * outermost trusted proxy appended. Missing, malformed or repeated values answer
 * `null`, so one fallback covers every request no trusted proxy vouched for.
 *
 * @param source - The incoming request, or its headers.
 * @param options - The header to read and, for proxy lists, the proxy count.
 * @returns The parsed address, or `null` when no trusted address is present.
 * @example
 * let key = getClientIP(request)?.network({ v4: 32, v6: 64 }).toString() ?? "unknown";
 * @example
 * let ip = getClientIP(request, { header: "X-Forwarded-For", proxies: 2 });
 */
export function getClientIP(source: Request | Headers, options: ClientIPOptions = {}): IP | null {
	let { header = "CF-Connecting-IP", proxies = 1 } = options;
	let headers = source instanceof Request ? source.headers : source;
	let value = headers.get(header);
	if (value === null) return null;

	let name = header.toLowerCase();
	if (name !== "x-forwarded-for" && name !== "forwarded") return parse(value);

	if (!Number.isInteger(proxies) || proxies < 1) return null;
	let entries = value.split(",");
	let entry = entries[entries.length - proxies];
	if (entry === undefined) return null;

	let address = name === "forwarded" ? forwardedFor(entry) : entry;
	return address === null ? null : parse(withoutPort(address.trim()));
}

/** Parses text into an `IP`, answering `null` for anything that is not exactly one address. */
function parse(text: string): IP | null {
	let ip = IP.parse(text);
	return isSuccess(ip) ? ip.data : null;
}

/**
 * Reads the `for` parameter of one RFC 7239 `Forwarded` element, unquoted.
 * Elements are split on every comma before this runs, so a quoted comma a
 * client injects only adds elements on the left, where nothing is read.
 */
function forwardedFor(element: string): string | null {
	for (let pair of element.split(";")) {
		let [key, ...rest] = pair.split("=");
		if (key?.trim().toLowerCase() !== "for") continue;
		let value = rest.join("=").trim();
		if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
			value = value.slice(1, -1);
		}
		return value;
	}
	return null;
}

/**
 * Drops the port a proxy may append to a list entry (`192.0.2.1:4711`,
 * `[2001:db8::1]:4711`), keeping a bare IPv6 address whole.
 */
function withoutPort(text: string): string {
	let bracketed = /^(\[[^\]]+\])(?::\d+)?$/.exec(text);
	if (bracketed?.[1]) return bracketed[1];
	let v4 = /^([\d.]+):\d+$/.exec(text);
	if (v4?.[1]) return v4[1];
	return text;
}

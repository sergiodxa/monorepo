/**
 * Decides whether a URL is somewhere a Worker should send a request, from the URL
 * alone: the scheme, any credentials, the port, and a host that is a public address
 * or a name outside every reserved suffix. No request and no lookup is made here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { IP } from "@sdxc/ip";
import { failure, isSuccess, success } from "@sdxc/result";

import { OutboundError } from "./error.js";

/** The port each scheme uses when the URL names none. */
const DEFAULT_PORTS: Record<string, number> = { "http:": 80, "https:": 443 };

/**
 * Name suffixes that never denote a public host: resolver-local names, private-network
 * conventions, and the RFC 2606 and RFC 6761 reserved names. Matched against whole
 * trailing labels, so `example` refuses `www.example` and leaves `example.com` alone.
 */
const RESERVED_SUFFIXES: readonly string[] = [
	"localhost",
	"local",
	"internal",
	"intranet",
	"lan",
	"corp",
	"private",
	"home.arpa",
	"test",
	"invalid",
	"example",
];

/** Which URLs a check lets through; every field defaults to the strictest public policy. */
export interface CheckOptions {
	/**
	 * `"public"` refuses reserved names and non-public addresses; `"any"` keeps only the
	 * scheme and credential rules, for a caller that reaches its own network on purpose.
	 *
	 * @default "public"
	 */
	hosts?: "public" | "any";
	/**
	 * `"public"` lets through an address literal that is on the public internet;
	 * `"refuse"` refuses every literal, so only a name can be asked.
	 *
	 * @default "public"
	 */
	literals?: "public" | "refuse";
	/**
	 * `"any"` lets through every port, `"default"` only the scheme's own, and a list
	 * only the ports it names, an omitted port counting as the scheme's own.
	 *
	 * @default "any"
	 */
	ports?: "any" | "default" | readonly number[];
}

/**
 * Parses a URL and refuses it unless every rule passes. The rules run on the parsed
 * URL, so a host spelled in octal, hex or with a trailing dot is judged by the address
 * or name it normalizes to.
 *
 * @param input - The URL as a stranger wrote it, or one already parsed.
 * @param options - Which hosts, literals and ports are allowed.
 * @returns The parsed URL, or the `OutboundError` naming the rule that refused it.
 * @example checkUrl("https://example.com/feed.xml"); // success
 * @example checkUrl("http://169.254.169.254/"); // failure: refused-address
 */
export function checkUrl(
	input: string | URL,
	options: CheckOptions = {},
): Result<URL, OutboundError> {
	let text = String(input);
	if (!URL.canParse(text)) {
		return failure(new OutboundError("invalid-url", text, `Refused ${text}: it is not a URL`));
	}

	let url = new URL(text);
	let refuse = (code: OutboundError["code"], why: string) =>
		failure(new OutboundError(code, url.href, `Refused ${url.href}: ${why}`));

	if (!(url.protocol in DEFAULT_PORTS)) {
		return refuse("refused-scheme", "only HTTP(S) is fetched");
	}

	if (url.username !== "" || url.password !== "") {
		return refuse("refused-credentials", "it carries credentials");
	}

	if (!isAllowedPort(url, options.ports ?? "any")) {
		return refuse("refused-port", `port ${url.port} is not allowed`);
	}

	if (options.hosts === "any") return success(url);

	let literal = IP.parse(url.hostname);
	if (isSuccess(literal)) {
		if (options.literals === "refuse") return refuse("refused-address", "it names an address");
		if (!literal.data.isPublic) {
			return refuse(
				"refused-address",
				`${literal.data.toString()} is ${literal.data.classification}`,
			);
		}
		return success(url);
	}

	if (url.hostname.startsWith("[")) return refuse("refused-address", "it names an address");
	if (!isPublicName(url.hostname)) return refuse("refused-host", `${url.hostname} is not public`);

	return success(url);
}

/** Whether a URL's port, or its scheme's own when it names none, is one the policy allows. */
function isAllowedPort(url: URL, ports: NonNullable<CheckOptions["ports"]>): boolean {
	if (ports === "any") return true;
	if (ports === "default") return url.port === "";

	let port = url.port === "" ? DEFAULT_PORTS[url.protocol] : Number(url.port);
	return port !== undefined && ports.includes(port);
}

/**
 * Whether a name may be public. A single label is refused because a resolver's search
 * domains can complete it into an internal host, and trailing root dots are dropped
 * first so `localhost.` is judged as `localhost`.
 */
function isPublicName(hostname: string): boolean {
	let name = hostname.toLowerCase().replace(/\.+$/u, "");
	if (!name.includes(".")) return false;
	return !RESERVED_SUFFIXES.some((suffix) => name === suffix || name.endsWith(`.${suffix}`));
}

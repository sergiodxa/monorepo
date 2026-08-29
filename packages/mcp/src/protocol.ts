/**
 * Revision constants, the reserved `_meta` keys, and the header validation this
 * revision made mandatory.
 *
 * Revision `2026-07-28` removed the `initialize` handshake, so every request states its
 * own protocol version, client identity, and client capabilities — once in `_meta` and
 * again in HTTP headers, which intermediaries route on without parsing the body. The two
 * copies have to agree, and checking that is a security boundary rather than a
 * formality: a gateway authorizing on a header while the server executes the body is
 * exactly the split this validation closes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The protocol revisions this server implements, newest first. A request naming anything
 * else is refused with `UnsupportedProtocolVersion`, which carries this list so the
 * client can retry with a revision both sides know.
 */
export const SUPPORTED_PROTOCOL_VERSIONS = ["2026-07-28"] as const;

/** The revision a server announces when it has to name one. */
export const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

/** Header mirroring the `_meta` protocol version. Required on every request. */
export const PROTOCOL_VERSION_HEADER = "MCP-Protocol-Version";

/** Header mirroring the message's `method`. Required on every request. */
export const METHOD_HEADER = "Mcp-Method";

/** Header mirroring `params.name`. Required on `tools/call`. */
export const NAME_HEADER = "Mcp-Name";

/**
 * The `_meta` keys this revision reserves, kept as constants because a typo here would
 * silently produce a request that looks valid but is missing a required field.
 */
export const MetaKey = {
	/** The revision the request is written against. Required. */
	ProtocolVersion: "io.modelcontextprotocol/protocolVersion",
	/** The client's name and version. Advisory, and not verified. */
	ClientInfo: "io.modelcontextprotocol/clientInfo",
	/** What the client can do. Required, and may be empty. */
	ClientCapabilities: "io.modelcontextprotocol/clientCapabilities",
	/** The server's name and version, attached to every result. */
	ServerInfo: "io.modelcontextprotocol/serverInfo",
} as const;

/** A self-reported name and version, for display and logs only. */
export interface Implementation {
	name: string;
	title?: string;
	version: string;
}

/** What a client declares it can do. Open-ended by design. */
export type ClientCapabilities = Record<string, unknown>;

/** The protocol fields every request carries in `_meta`. */
export interface RequestMetadata {
	protocolVersion: string;
	clientInfo: Implementation | undefined;
	clientCapabilities: ClientCapabilities;
}

/** Whether a revision string is one this server implements. */
export function isSupportedVersion(version: string): boolean {
	return (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(version);
}

/** Marks a value that could not be read, with the reason to report. */
export interface MetadataProblem {
	reason: string;
}

/**
 * Reads the required protocol fields out of a request's `params._meta`.
 *
 * @param params The message's `params`, which may be absent.
 * @returns The metadata, or the reason it could not be read. A missing required field is
 * `-32602` at the call site, since the request is malformed rather than unsupported.
 */
export function readRequestMetadata(
	params: Record<string, unknown> | undefined,
): RequestMetadata | MetadataProblem {
	let meta = params?._meta;
	if (typeof meta !== "object" || meta === null || Array.isArray(meta)) {
		return { reason: "Request is missing the required _meta object" };
	}

	let fields = meta as Record<string, unknown>;

	let protocolVersion = fields[MetaKey.ProtocolVersion];
	if (typeof protocolVersion !== "string") {
		return { reason: `Request _meta is missing ${MetaKey.ProtocolVersion}` };
	}

	let capabilities = fields[MetaKey.ClientCapabilities];
	if (typeof capabilities !== "object" || capabilities === null || Array.isArray(capabilities)) {
		return { reason: `Request _meta is missing ${MetaKey.ClientCapabilities}` };
	}

	let info = fields[MetaKey.ClientInfo];
	let clientInfo =
		typeof info === "object" && info !== null && !Array.isArray(info)
			? (info as unknown as Implementation)
			: undefined;

	return {
		protocolVersion,
		clientInfo,
		clientCapabilities: capabilities as ClientCapabilities,
	};
}

/** Reports whether {@link readRequestMetadata} failed. */
export function isMetadataProblem(
	value: RequestMetadata | MetadataProblem,
): value is MetadataProblem {
	return "reason" in value;
}

/** Marks a header value carried as Base64 because it is not header-safe as written. */
const BASE64_SENTINEL = /^=\?base64\?(.*)\?=$/;

/**
 * Decodes a header value that may use the Base64 sentinel form clients use for any value
 * that is not plain printable ASCII. An undecodable value is returned as written, so the
 * caller's comparison fails and the request is refused as a header mismatch.
 *
 * @param value The raw header value.
 * @returns The decoded value, or the input unchanged when it carries no sentinel or fails
 * to decode.
 */
export function decodeHeaderValue(value: string): string {
	let match = BASE64_SENTINEL.exec(value);
	if (!match?.[1]) return value;

	try {
		return new TextDecoder().decode(Uint8Array.from(atob(match[1]), (c) => c.codePointAt(0) ?? 0));
	} catch {
		return value;
	}
}

/**
 * Client ID Metadata Documents: a relying party whose own `client_id` is an `https://`
 * URL it controls, resolved by fetching that URL rather than reading a stored
 * registration row. Fetching the same URL again is exactly as authoritative as a stored
 * record would be, so a client identified this way is never written to the tenant's own
 * client table — the authorize and consent steps read this module's resolution instead
 * of `database/clients.ts`'s own lookup whenever a presented `client_id` has this shape.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** How long a fetched document stands before a fresh fetch is owed, bounding one authorize/consent round trip to a single fetch without holding a stale document indefinitely. */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** The largest response body this fetch reads, matching the specification's own recommendation. */
const MAX_BODY_BYTES = 5 * 1024;

/**
 * Every fetched document, keyed by its own URL and shared across every tenant this
 * instance serves: the content a URL answers with is public and identifies the same
 * client regardless of which tenant is asking, so nothing about caching it this way
 * leaks one tenant's data into another's.
 */
const cache = new Map<string, { resolution: CimdResolution; cachedAt: number }>();

/**
 * A CIMD client's whole record, in the same shape a registered client's record carries
 * into the authorization decision and the consent screen it builds.
 */
export interface CimdClientRecord {
	id: string;
	name: string;
	redirectUris: string[];
	responseTypes: string[];
	/** The scopes this client may request, exactly as its own document declares them; a document declaring none grants none. */
	scopes: string[];
	logoUri: string | null;
	policyUri: string | null;
	tosUri: string | null;
}

/** What resolving a `client_id` URL answers with: the record it declared, or why its document was refused. */
export type CimdResolution =
	| { ok: true; client: CimdClientRecord }
	| { ok: false; reason: "not-found" | "invalid-metadata" };

/** Parses a URL, answering `null` rather than throwing for one that is not absolute. */
function tryParseUrl(value: string): URL | null {
	try {
		return new URL(value);
	} catch {
		return null;
	}
}

/**
 * Whether a `client_id` names a Client ID Metadata Document rather than an opaque id
 * this tenant issued itself: an absolute `https:` URL, carrying no userinfo or fragment
 * component and at least one path segment beyond the root, the shape the specification
 * requires so the URL can double as the document's own fetchable address.
 *
 * @param clientId - The `client_id` an authorize or token request presented.
 * @returns Whether this `client_id` should be resolved by fetching it rather than by a
 * registry lookup.
 */
export function isClientIdUrl(clientId: string): boolean {
	let parsed = tryParseUrl(clientId);
	if (!parsed) return false;
	if (parsed.protocol !== "https:") return false;
	if (parsed.username !== "" || parsed.password !== "") return false;
	if (parsed.hash !== "") return false;
	if (parsed.pathname === "" || parsed.pathname === "/") return false;
	return true;
}

/** Reads at most {@link MAX_BODY_BYTES} of a response's body, refusing a document that runs past it. */
async function readBoundedText(response: Response): Promise<string | null> {
	let text = await response.text();
	return text.length > MAX_BODY_BYTES ? null : text;
}

/** Every string in a JSON value's array, dropping any entry that is not one. */
function stringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((entry): entry is string => typeof entry === "string")
		: [];
}

/**
 * Fetches and validates the document at a candidate CIMD URL: a plain `GET`, no
 * redirect followed, a `200` response read no further than the specification's own
 * size recommendation, and the document's own `client_id` checked against the exact
 * URL it was fetched from — the anti-impersonation check that keeps a metadata host
 * from vouching for an identity it does not itself serve. `redirect_uris` must name at
 * least one URI, the minimum a consent screen and a redirect-target check both need.
 */
async function fetchCimdDocument(clientId: string): Promise<CimdResolution> {
	let response: Response;
	try {
		response = await fetch(clientId, {
			method: "GET",
			redirect: "manual",
			headers: { Accept: "application/json" },
		});
	} catch {
		return { ok: false, reason: "not-found" };
	}

	if (response.status !== 200) return { ok: false, reason: "not-found" };

	let contentType = response.headers.get("Content-Type") ?? "";
	if (!contentType.toLowerCase().includes("json")) return { ok: false, reason: "invalid-metadata" };

	let text = await readBoundedText(response);
	if (text === null) return { ok: false, reason: "invalid-metadata" };

	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return { ok: false, reason: "invalid-metadata" };
	}

	if (typeof parsed !== "object" || parsed === null)
		return { ok: false, reason: "invalid-metadata" };
	let document = parsed as Record<string, unknown>;

	if (document.client_id !== clientId) return { ok: false, reason: "invalid-metadata" };

	let redirectUris = stringArray(document.redirect_uris);
	if (redirectUris.length === 0) return { ok: false, reason: "invalid-metadata" };

	let responseTypes = stringArray(document.response_types);

	return {
		ok: true,
		client: {
			id: clientId,
			name: typeof document.client_name === "string" ? document.client_name : clientId,
			redirectUris,
			responseTypes: responseTypes.length > 0 ? responseTypes : ["code"],
			scopes: typeof document.scope === "string" ? document.scope.split(/\s+/).filter(Boolean) : [],
			logoUri: typeof document.logo_uri === "string" ? document.logo_uri : null,
			policyUri: typeof document.policy_uri === "string" ? document.policy_uri : null,
			tosUri: typeof document.tos_uri === "string" ? document.tos_uri : null,
		},
	};
}

/**
 * Resolves a CIMD `client_id`, reusing a still-fresh cached document rather than
 * fetching again within the same authorize/consent round trip.
 *
 * @param clientId - The `https://` URL presented as `client_id`; call {@link isClientIdUrl}
 * first to know a lookup belongs here rather than in the tenant's own client table.
 * @param now - The clock a cached entry's freshness is measured against.
 * @returns The resolved client record, or why the document was refused.
 */
export async function resolveCimdClient(clientId: string, now: number): Promise<CimdResolution> {
	let cached = cache.get(clientId);
	if (cached && now - cached.cachedAt < CACHE_TTL_MS) return cached.resolution;

	let resolution = await fetchCimdDocument(clientId);
	cache.set(clientId, { resolution, cachedAt: now });
	return resolution;
}

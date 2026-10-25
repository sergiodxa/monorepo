/**
 * Client ID Metadata Documents: a relying party whose own `client_id` is an `https://` URL it
 * controls, resolved by fetching that URL rather than reading a stored registration row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure } from "@sdxc/result";
import { isClientIdentifierUrl, parse } from "@sdxc/well-known/client-id-metadata-document";

/** How long a fetched document stands before a fresh fetch is owed, bounding one authorize/consent round trip to a single fetch without holding a stale document indefinitely. */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** The largest response body this fetch reads, matching the specification's own recommendation. */
const MAX_BODY_BYTES = 5 * 1024;

/**
 * Every valid fetched document, keyed by its own URL and shared across every tenant this
 * instance serves: a URL's public content identifies the same client whichever tenant
 * asks. A refusal stays out, so the next request fetches the document again.
 */
const CACHE = new Map<string, { resolution: CimdResolution; cachedAt: number }>();

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

/**
 * Whether a `client_id` names a Client ID Metadata Document rather than an opaque id
 * this tenant issued itself: a Client Identifier URL whose path goes beyond the root,
 * since a document at `/` would collide with the client's own home page.
 *
 * @param clientId - The `client_id` an authorize or token request presented.
 * @returns Whether this `client_id` should be resolved by fetching it rather than by a registry lookup.
 */
export function isClientIdUrl(clientId: string): boolean {
	return isClientIdentifierUrl(clientId) && new URL(clientId).pathname !== "/";
}

/** Reads at most {@link MAX_BODY_BYTES} of a response's body, refusing a document that runs past it. */
async function readBoundedText(response: Response): Promise<string | null> {
	let text = await response.text();
	return text.length > MAX_BODY_BYTES ? null : text;
}

/**
 * Fetches and validates the document at a candidate CIMD URL: a plain `GET`, no
 * redirect followed, a `200` JSON response read no further than the specification's own
 * size recommendation. Only a public client resolves, since PKCE is its whole proof here.
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

	let parsed = parse(text, { clientId });
	if (isFailure(parsed)) return { ok: false, reason: "invalid-metadata" };
	let document = parsed.data;

	if (document.redirectUris.length === 0) return { ok: false, reason: "invalid-metadata" };
	if (document.tokenEndpointAuthMethod !== "none") return { ok: false, reason: "invalid-metadata" };

	return {
		ok: true,
		client: {
			id: clientId,
			name: document.clientName?.value ?? clientId,
			redirectUris: document.redirectUris,
			responseTypes: document.responseTypes.length > 0 ? document.responseTypes : ["code"],
			scopes: document.scope,
			logoUri: document.logoUri?.href ?? null,
			policyUri: document.policyUri?.href ?? null,
			tosUri: document.tosUri?.href ?? null,
		},
	};
}

/**
 * Resolves a CIMD `client_id`, reusing a still-fresh cached document within the same
 * authorize/consent round trip; a refused document is fetched again on the next call.
 *
 * @param clientId - The `https://` URL presented as `client_id`; call {@link isClientIdUrl} first to know a lookup belongs here rather than in the tenant's own client table.
 * @param now - The clock a cached entry's freshness is measured against.
 * @returns The resolved client record, or why the document was refused.
 */
export async function resolveCimdClient(clientId: string, now: number): Promise<CimdResolution> {
	let cached = CACHE.get(clientId);
	if (cached && now - cached.cachedAt < CACHE_TTL_MS) return cached.resolution;

	let resolution = await fetchCimdDocument(clientId);
	if (resolution.ok) CACHE.set(clientId, { resolution, cachedAt: now });
	return resolution;
}

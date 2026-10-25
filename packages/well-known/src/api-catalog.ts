/**
 * The RFC 9727 API catalog served at `/.well-known/api-catalog`: an RFC 9264 link set
 * naming every API a host publishes, each with its machine-readable description, human
 * documentation, policies and health endpoint, so a client discovers them from the origin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { LinksetLink } from "@sdxc/link-header/linkset";
import type { Result } from "@sdxc/result";

import { serializeLink } from "@sdxc/link-header";
import { JSON_MEDIA_TYPE, parseJson, stringifyJson } from "@sdxc/link-header/linkset";
import { failure, isFailure, success } from "@sdxc/result";

import type { WellKnownFormat } from "./format.js";

import { WellKnownParseError } from "./parse-error.js";

export const NAME = "api-catalog";

/** The profile URI RFC 9727 §7.3 registers, marking a link set as an API catalog. */
export const PROFILE = "https://www.rfc-editor.org/info/rfc9727";

export const MEDIA_TYPE = `${JSON_MEDIA_TYPE}; profile="${PROFILE}"`;

/** The relation type that points at an API catalog, from a page or from another catalog. */
export const LINK_RELATION = "api-catalog";

/** A catalog: the links of its link set, read and written through `@sdxc/link-header/linkset`. */
export interface ApiCatalog {
	links: LinksetLink[];
}

/** One resource an API's metadata link points at. */
export interface ApiCatalogTarget {
	/** Resolved against the catalog's URL, so a path names a resource on the catalog's host. */
	href: URL | string;
	/** The media type a client gets, such as `application/json` for an OpenAPI document. */
	type?: string;
	title?: string;
}

/** One API, with the RFC 8631 relations RFC 9727 Appendix A.1 describes it through. */
export interface ApiDescription {
	/** The API's endpoint: the catalog's `item` link points here, and its metadata hangs off it. */
	url: URL | string;
	/** A name for the API, carried on its `item` link. */
	title?: string;
	/** Machine-readable descriptions, such as an OpenAPI document (`service-desc`). */
	serviceDesc?: ApiCatalogTarget[];
	/** Documentation for people (`service-doc`). */
	serviceDoc?: ApiCatalogTarget[];
	/** Other machine-readable metadata, such as usage policies (`service-meta`). */
	serviceMeta?: ApiCatalogTarget[];
	/** The API's health or status endpoint (`status`). */
	status?: ApiCatalogTarget[];
}

/** What a catalog lists. */
export interface ApiCatalogInput {
	/** The catalog's own URL: the anchor of its `item` links and the base for every relative href. */
	url: URL | string;
	apis: ApiDescription[];
	/** Other catalogs this one nests, for APIs grouped by domain or product (RFC 9727 §4.3). */
	catalogs?: Array<URL | string>;
}

/** The metadata relations an {@link ApiDescription} carries, in the order the catalog lists them. */
const METADATA_RELATIONS = [
	["serviceDesc", "service-desc"],
	["serviceDoc", "service-doc"],
	["serviceMeta", "service-meta"],
	["status", "status"],
] as const;

/**
 * A reference as an absolute URL against the catalog's, since RFC 9264 asks a link set to
 * carry no relative references; one that cannot be resolved stays as written.
 *
 * @param reference - A URL or a path.
 * @param base - The catalog's URL.
 */
function absolute(reference: URL | string, base: string): string {
	return URL.parse(String(reference), base)?.href ?? String(reference);
}

/**
 * Builds a catalog combining both shapes RFC 9727 Appendix A shows: an `item` link from the
 * catalog to each API, then each API's own metadata links anchored at its endpoint. Every
 * reference is made absolute against `url`.
 *
 * @param input - The catalog's URL, its APIs and any nested catalogs.
 * @returns The catalog, ready for `stringify` or `serve`.
 * @example
 * build({
 *   url: new URL("/.well-known/api-catalog", ctx.url),
 *   apis: [{ url: "/api/v1", serviceDesc: [{ href: "/api/v1/openapi.json", type: "application/json" }], status: [{ href: "/health" }] }],
 * });
 */
export function build(input: ApiCatalogInput): ApiCatalog {
	let anchor = String(input.url);
	let links: LinksetLink[] = [];

	for (let api of input.apis) {
		let link: LinksetLink = { anchor, rel: "item", href: absolute(api.url, anchor) };
		if (api.title !== undefined) link.title = api.title;
		links.push(link);
	}
	for (let catalog of input.catalogs ?? []) {
		links.push({ anchor, rel: LINK_RELATION, href: absolute(catalog, anchor) });
	}

	for (let api of input.apis) {
		let endpoint = absolute(api.url, anchor);
		for (let [member, rel] of METADATA_RELATIONS) {
			for (let target of api[member] ?? []) {
				let link: LinksetLink = { anchor: endpoint, rel, href: absolute(target.href, anchor) };
				if (target.type !== undefined) link.type = target.type;
				if (target.title !== undefined) link.title = target.title;
				links.push(link);
			}
		}
	}

	return { links };
}

/**
 * Reads a catalog. The link set must follow RFC 9264's JSON form and hold at least one
 * link, since RFC 9727 §4.1 requires a catalog to link to its APIs.
 *
 * @param text - The served JSON.
 * @returns The catalog, or every place it breaks either RFC.
 * @example let catalog = parse(await (await fetch(wellKnownUrl(origin, NAME, "append"))).text());
 */
export function parse(text: string): Result<ApiCatalog, WellKnownParseError> {
	let links = parseJson(text);
	if (isFailure(links)) return failure(new WellKnownParseError(NAME, links.error.issues));
	if (links.data.length === 0) {
		return failure(
			new WellKnownParseError(NAME, [{ at: "/linkset", message: "The catalog links to no API." }]),
		);
	}
	return success({ links: links.data });
}

/**
 * Writes a catalog as its `application/linkset+json` document.
 *
 * @param document - The catalog.
 */
export function stringify(document: ApiCatalog): string {
	return stringifyJson(document.links);
}

/**
 * A catalog as a servable format: the link set media type with the RFC 9727 profile, CORS so
 * a browser-based API explorer can read it, and on every answer, `HEAD` included, the
 * `Link: <…>; rel="api-catalog"` that RFC 9727 §2 requires.
 */
export const apiCatalog: WellKnownFormat<ApiCatalog> = {
	name: NAME,
	mediaType: MEDIA_TYPE,
	placement: "append",
	cors: true,
	headers: { Link: serializeLink(`/.well-known/${NAME}`, LINK_RELATION) },
	stringify,
	parse,
};

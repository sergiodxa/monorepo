/**
 * Builds the responses the Micropub specification defines: the statuses and `Location`
 * headers of writes, JSON error bodies with the RFC 6750 challenge, and the query answers
 * written with their wire names.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { MF2 } from "@sdxc/microformats";

import type { Micropub } from "../index.js";

/**
 * The status of each error code. `insufficient_scope` is 401 as the specification and
 * micropub.rocks define it, which departs from RFC 6750's 403.
 */
const ERROR_STATUS: Record<Micropub.ErrorCode, number> = {
	invalid_request: 400,
	unauthorized: 401,
	forbidden: 403,
	insufficient_scope: 401,
};

/** `201 Created` with the new post's URL, for a post stored before responding. */
export function created(location: string | URL): Response {
	return withLocation(201, location);
}

/** `202 Accepted` with the URL the post will have, for a create processed asynchronously. */
export function accepted(location: string | URL): Response {
	return withLocation(202, location);
}

/** `204`, or `201` with `Location` when the update moved the post. */
export function updated(location?: string | URL): Response {
	return location === undefined ? new Response(null, { status: 204 }) : withLocation(201, location);
}

/** `204` for a delete or undelete, or `201` with `Location` when an undelete restored the post at a new URL. */
export function deleted(location?: string | URL): Response {
	return updated(location);
}

/**
 * The JSON error body. `unauthorized` and `insufficient_scope` also carry a
 * `WWW-Authenticate: Bearer` challenge; `insufficient_scope` names its error, description
 * and scope there too, as RFC 6750 writes them.
 *
 * @param description - Written as `error_description`, meant for the client's developer
 * @param details - The scopes that would authorize the request
 */
export function error(
	code: Micropub.ErrorCode,
	description?: string,
	details: Micropub.ErrorDetails = {},
): Response {
	let body: Record<string, string> = { error: code };
	if (description !== undefined) body.error_description = description;
	if (details.scope !== undefined) body.scope = details.scope.join(" ");
	let headers = new Headers();
	if (code === "unauthorized") headers.set("WWW-Authenticate", "Bearer");
	if (code === "insufficient_scope") {
		let params = Object.entries(body).map(([name, value]) => `${name}="${quoted(value)}"`);
		headers.set("WWW-Authenticate", `Bearer ${params.join(", ")}`);
	}
	return Response.json(body, { status: ERROR_STATUS[code], headers });
}

/** Writes the config with wire names (`media-endpoint`, `syndicate-to`, `post-types`), leaving out absent members. */
export function config(config: Micropub.Config): Response {
	let body: Record<string, unknown> = {};
	if (config.mediaEndpoint !== undefined) body["media-endpoint"] = config.mediaEndpoint;
	if (config.syndicateTo !== undefined) body["syndicate-to"] = config.syndicateTo;
	if (config.q !== undefined) body.q = config.q;
	if (config.postTypes !== undefined) body["post-types"] = config.postTypes;
	return Response.json(body);
}

/** The `q=syndicate-to` answer; no targets is an empty array, which clients expect. */
export function syndicateTo(targets: Micropub.SyndicationTarget[]): Response {
	return Response.json({ "syndicate-to": targets });
}

/**
 * The `q=source` answer: the whole item when no properties were requested, otherwise
 * `{ properties }` holding only the requested names the post has, without `type`.
 */
export function source(item: MF2.Item, properties: string[] = []): Response {
	if (properties.length === 0) return Response.json(item);
	let selected: Record<string, MF2.PropertyValue[]> = {};
	for (let name of properties) {
		let values = item.properties[name];
		if (values !== undefined) selected[name] = values;
	}
	return Response.json({ properties: selected });
}

/** The answer to the `q=category` extension. */
export function categories(names: string[]): Response {
	return Response.json({ categories: names });
}

/** An empty response with `Location`. */
function withLocation(status: number, location: string | URL): Response {
	return new Response(null, { status, headers: { Location: String(location) } });
}

/** A value escaped for an RFC 9110 quoted string. */
function quoted(value: string): string {
	return value.replace(/["\\]/g, "\\$&");
}

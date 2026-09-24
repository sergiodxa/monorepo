/**
 * Decodes a Micropub GET into a typed query. `q` is read from the full query string,
 * so an endpoint URL carrying its own parameters (`?micropub=endpoint&q=config`) works
 * as the specification requires clients to append rather than replace.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";
import { parseSafe } from "remix/data-schema";

import type { Micropub } from "../index.js";

import { MicropubRequestError } from "./errors.js";
import { URL_SCHEMA } from "./operation.js";
import { headerToken } from "./token.js";

/**
 * Decodes the query and the header token. `q=source` requires an absolute `url` and
 * reads `properties[]` and `properties` alike; an unknown `q` is passed through as an
 * extension with every parameter, for the endpoint to answer or reject.
 *
 * @returns The query with its token, or why the request is invalid
 */
export function parseQuery(
	request: Request,
): Result<Micropub.Parsed<Micropub.Query>, MicropubRequestError> {
	let token = headerToken(request);
	if (isFailure(token)) return token;
	let query = toQuery(new URL(request.url).searchParams);
	if (isFailure(query)) return query;
	return success({ body: query.data, accessToken: token.data });
}

/** The query `params` describe. */
function toQuery(params: URLSearchParams): Result<Micropub.Query, MicropubRequestError> {
	let q = params.get("q");
	if (q === null || q === "") {
		return failure(new MicropubRequestError("A Micropub query needs a q parameter."));
	}
	switch (q) {
		case "config":
			return success({ q });
		case "syndicate-to":
			return success({ q });
		case "category":
			return success({ q, filter: params.get("filter") });
		case "source": {
			let url = parseSafe(URL_SCHEMA, params.get("url") ?? undefined);
			if (!url.success) {
				return failure(
					new MicropubRequestError("q=source needs the absolute url of a post.", url.issues),
				);
			}
			let properties = [...params.getAll("properties[]"), ...params.getAll("properties")];
			return success({ q, url: url.value, properties });
		}
		default:
			return success({ q: "extension", name: q, params });
	}
}

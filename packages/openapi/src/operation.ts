/**
 * Operations: a route from a route map bound to the schemas of its params, query, body
 * and responses, its problem types and its security. The handler parses its input
 * through the operation, and the document describes the same declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { DescribedSchema, InferOutput } from "@sdxc/json-schema";
import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { MatchParams } from "remix/route-pattern/match";
import type { Route } from "remix/routes";

import { failure, success } from "@sdxc/result";

import { OperationInputError } from "./errors.js";

/** Any schema this package accepts: one that validates through data-schema and describes itself. */
type AnySchema = DescribedSchema<any, any>;

/** The pattern source a route was declared with. */
type PatternOf<R> = R extends Route<any, infer Pattern extends string> ? Pattern : string;

/** The variables a route's pattern captures, as the router hands them to a handler. */
export type PathParams<R> = MatchParams<PatternOf<R>>;

/** Whether two object types name exactly the same keys. */
type SameKeys<A, B> = [Exclude<keyof A, keyof B>, Exclude<keyof B, keyof A>] extends [never, never]
	? true
	: false;

/**
 * Resolves to `unknown` when a params schema names exactly the route's variables, and to
 * an impossible requirement otherwise, whose key spells out the rule in the compiler error.
 */
type ParamsMatchRoute<R, Params> =
	SameKeys<InferOutput<Params>, PathParams<R>> extends true
		? unknown
		: { readonly "params must name exactly the route's variables": keyof PathParams<R> };

/** One response an operation declares: a body schema per media type, and its headers. */
export interface ResponseSpec {
	description: string;
	/** A schema is `application/json`; a record names media types explicitly. */
	body?: AnySchema | Record<string, AnySchema>;
	headers?: Record<string, { schema: AnySchema; description?: string; required?: boolean }>;
}

/**
 * What an operation declares beside its route.
 *
 * @template R - The route it documents.
 * @template Params - The path params schema.
 * @template Query - The query schema.
 * @template Body - The request body schema.
 * @template Problems - Entry names from the document's problem catalog.
 */
export interface OperationSpec<
	R extends Route<any, any>,
	Params extends AnySchema | undefined,
	Query extends AnySchema | undefined,
	Body extends AnySchema | undefined,
	Problems extends string,
> {
	summary: string;
	description?: string;
	tags?: string[];
	/** Keys must equal the route pattern's variables; a missing or extra key fails to compile. */
	params?: Params & ParamsMatchRoute<R, Params>;
	/** An object schema; each key becomes a query parameter. */
	query?: Query;
	/** A schema is `application/json`; a record names media types explicitly. */
	body?: Body | Record<string, NonNullable<Body>>;
	responses: Record<number, ResponseSpec>;
	/** Entry names from the document's problem catalog; `add` refuses unknown names at compile time. */
	problems?: readonly Problems[];
	/** Scheme name to scopes; `[]` marks an unauthenticated operation. */
	security?: readonly Record<string, readonly string[]>[];
	deprecated?: boolean;
}

/** What `parse` yields for a part the operation declares no schema for. */
type OutputOr<S, Fallback> = S extends AnySchema ? InferOutput<S> : Fallback;

/** An operation's declared parts, as the document builder and the conformance checker read them. */
export interface OperationDeclaration {
	summary: string;
	description?: string;
	tags?: string[];
	params?: AnySchema;
	query?: AnySchema;
	body?: AnySchema | Record<string, AnySchema>;
	responses: Record<number, ResponseSpec>;
	problems?: readonly string[];
	security?: readonly Record<string, readonly string[]>[];
	deprecated?: boolean;
}

/**
 * An operation bound to its route, carrying the types its handler and its tests use.
 *
 * @template R - The route it documents.
 * @template Params - What `parse` yields for the path params.
 * @template Query - What `parse` yields for the query string.
 * @template Body - What `parse` yields for the body.
 * @template Problems - The catalog entries it declares.
 */
export interface Operation<
	R extends Route<any, any> = Route<any, any>,
	Params = unknown,
	Query = unknown,
	Body = unknown,
	Problems extends string = string,
> {
	readonly route: R;
	/** The name the route has in its route map, unique across a document. */
	readonly operationId: string;
	readonly spec: OperationDeclaration;
	/** Type-only: the catalog entries this operation declares, which `add` checks. */
	readonly "~problems"?: Problems;
	/**
	 * Parses params, query and body in that order, stopping at the first part that fails.
	 * The body is read by its `Content-Type`, so a request is parsed once.
	 */
	parse(
		request: Request,
		params: Record<string, string>,
	): Promise<Result<{ params: Params; query: Query; body: Body }, OperationInputError>>;
}

/**
 * Binds an operation spec to one route of a route map, keyed by the name it has there,
 * which becomes its `operationId`.
 *
 * @param name - The route's key in its route map, such as `monitorUpdate`.
 * @param route - The route it documents.
 * @param spec - Its schemas, responses, problems and security.
 * @example let monitorShow = defineOperation("monitorShow", routes.api.monitors.show, { summary: "Show a monitor", params: s.object({ monitorId: s.string() }), responses: { 200: { description: "The monitor", body: MonitorSchema } } });
 */
export function defineOperation<
	R extends Route<any, any>,
	Params extends AnySchema | undefined = undefined,
	Query extends AnySchema | undefined = undefined,
	Body extends AnySchema | undefined = undefined,
	const Problems extends string = never,
>(
	name: string,
	route: R,
	spec: OperationSpec<R, Params, Query, Body, Problems>,
): Operation<
	R,
	OutputOr<Params, PathParams<R>>,
	OutputOr<Query, undefined>,
	OutputOr<Body, undefined>,
	Problems
> {
	let declaration = spec as OperationDeclaration;
	return {
		route,
		operationId: name,
		spec: declaration,
		async parse(request, params) {
			let parsedParams = declaration.params
				? await validate(declaration.params, params, "params")
				: success(params);
			if (parsedParams.status === "failure") return parsedParams;

			let query = declaration.query
				? await validate(declaration.query, readQuery(request), "query")
				: success(undefined);
			if (query.status === "failure") return query;

			let body = await parseBody(declaration.body, request);
			if (body.status === "failure") return body;

			return success({ params: parsedParams.data, query: query.data, body: body.data } as {
				params: OutputOr<Params, PathParams<R>>;
				query: OutputOr<Query, undefined>;
				body: OutputOr<Body, undefined>;
			});
		},
	};
}

/**
 * Whether a declared body is one schema or a record of media types to schemas.
 *
 * @param body - The declared body.
 */
export function isSchema(body: AnySchema | Record<string, AnySchema>): body is AnySchema {
	return "~standard" in body;
}

/**
 * The media types a declared body or response accepts, each with its schema; a bare schema
 * is `application/json`.
 *
 * @param body - A declared body, or `undefined` for none.
 */
export function mediaTypes(
	body: AnySchema | Record<string, AnySchema> | undefined,
): Record<string, AnySchema> {
	if (body === undefined) return {};
	return isSchema(body) ? { "application/json": body } : body;
}

/**
 * The media type essence of a `Content-Type` value, lowercased and without parameters.
 *
 * @param value - The header value, or `null` when absent.
 */
export function essence(value: string | null): string | null {
	if (value === null) return null;
	return value.split(";")[0]?.trim().toLowerCase() ?? null;
}

/**
 * Whether a media type carries JSON: `application/json` or any `+json` suffix.
 *
 * @param mediaType - A media type essence.
 */
export function isJSONMediaType(mediaType: string): boolean {
	return mediaType === "application/json" || mediaType.endsWith("+json");
}

/** Runs a Standard Schema, awaiting it in case a schema from another library validates asynchronously. */
async function validate(
	schema: StandardSchemaV1,
	value: unknown,
	location: OperationInputError["location"],
): Promise<Result<any, OperationInputError>> {
	let result = await schema["~standard"].validate(value);
	if (result.issues) return failure(new OperationInputError(location, result.issues));
	return success(result.value);
}

/** The query string as an object: a key given once is a string, a repeated key an array. */
function readQuery(request: Request): Record<string, string | string[]> {
	return collect(new URL(request.url).searchParams);
}

/** Folds repeated entries into arrays, so an array schema receives every value. */
function collect(entries: Iterable<[string, unknown]>): Record<string, any> {
	let collected: Record<string, unknown> = {};
	for (let [key, value] of entries) {
		let existing = collected[key];
		if (existing === undefined) collected[key] = value;
		else if (Array.isArray(existing)) existing.push(value);
		else collected[key] = [existing, value];
	}
	return collected;
}

/**
 * Reads and validates the body against the schema for its `Content-Type`. A request with
 * no body validates `undefined`, so an `optional` body schema accepts it; a media type the
 * operation does not declare, or malformed JSON, fails with a single issue.
 */
async function parseBody(
	body: AnySchema | Record<string, AnySchema> | undefined,
	request: Request,
): Promise<Result<unknown, OperationInputError>> {
	if (body === undefined) return success(undefined);
	let accepted = mediaTypes(body);

	if (request.body === null) {
		let [first] = Object.values(accepted);
		return first === undefined ? success(undefined) : validate(first, undefined, "body");
	}

	let mediaType = essence(request.headers.get("Content-Type"));
	let schema = mediaType === null ? undefined : accepted[mediaType];
	if (mediaType === null || schema === undefined) {
		let expected = Object.keys(accepted).join(", ");
		return failure(
			new OperationInputError("body", [{ message: `Expected Content-Type ${expected}` }]),
		);
	}

	let value = await readBody(request, mediaType);
	if (value.status === "failure") return value;
	return validate(schema, value.data, "body");
}

/** Decodes a body by media type: JSON parsed, forms as objects, anything else as text. */
async function readBody(
	request: Request,
	mediaType: string,
): Promise<Result<unknown, OperationInputError>> {
	if (mediaType === "application/x-www-form-urlencoded" || mediaType === "multipart/form-data") {
		return success(collect(await request.formData()));
	}

	let text = await request.text();
	if (!isJSONMediaType(mediaType)) return success(text);
	if (text.trim() === "") return success(undefined);
	try {
		return success(JSON.parse(text));
	} catch {
		return failure(new OperationInputError("body", [{ message: "Expected a JSON body" }]));
	}
}

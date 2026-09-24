/**
 * The document builder: collects operations, then assembles an OpenAPI 3.1 document
 * from their routes and schemas, the security schemes, and a problem catalog whose
 * entries become reusable responses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { JSONSchema } from "@sdxc/json-schema";
import type { CatalogEntry, CatalogMethods, ProblemCatalog, ProblemEntries } from "@sdxc/problem";
import type { Result } from "@sdxc/result";
import type { StandardJSONSchemaV1 } from "@standard-schema/spec";

import { toJSONSchema } from "@sdxc/json-schema";
import { PROBLEM_MEDIA_TYPE } from "@sdxc/problem";
import { failure, success } from "@sdxc/result";

import type { Operation, OperationDeclaration } from "./operation.js";
import type { OpenAPI } from "./types.js";

import { OpenAPIBuildError } from "./errors.js";
import { mediaTypes } from "./operation.js";
import { toPathTemplate } from "./path.js";

/** The OpenAPI version a built document declares. */
export const OPENAPI_VERSION = "3.1.1";

/** The schema dialect a built document declares, JSON Schema 2020-12 with OpenAPI's vocabulary. */
export const JSON_SCHEMA_DIALECT = "https://spec.openapis.org/oas/3.1/dialect/base";

/** What `createDocument` needs beside the operations. */
export interface DocumentOptions<Entries extends ProblemEntries> {
	info: OpenAPI.Info;
	/** Absolute origins; the document never reads them from a request. */
	servers: OpenAPI.Server[];
	securitySchemes?: Record<string, OpenAPI.SecurityScheme>;
	/** Applied to every operation that declares no `security` of its own. */
	security?: readonly Record<string, readonly string[]>[];
	/** Each entry becomes `components.responses.<Name>`, for operations to list by name. */
	problems?: ProblemCatalog<Entries>;
	tags?: OpenAPI.Tag[];
}

/** An operation any document accepts, whatever its types, limited to the catalog's entry names. */
type DocumentOperation<Problems extends string> = Operation<any, any, any, any, Problems>;

/** Collects operations and assembles the document from them. */
export interface DocumentBuilder<Entries extends ProblemEntries = ProblemEntries> {
	/** Adds operations; one listing a problem the catalog lacks fails to compile. */
	add(...operations: DocumentOperation<keyof Entries & string>[]): DocumentBuilder<Entries>;
	/**
	 * Assembles the document. A duplicate operation, a route OpenAPI cannot express, params
	 * that disagree with the pattern, an unknown scheme or an unconvertible schema fails.
	 */
	build(): Result<OpenAPI.Document, OpenAPIBuildError>;
	/** Every scope any operation requires, per scheme, for OAuth protected-resource metadata. */
	scopes(): Record<string, string[]>;
	/** The operations added so far, in order, for tooling such as the conformance checker. */
	operations(): readonly Operation[];
	/** The catalog's entries, or none without a catalog. */
	problems(): CatalogEntry[];
}

/**
 * Starts a document. Nothing is assembled until `build()`, so a worker can create the
 * builder at module scope and build on the first request.
 *
 * @param options - The document's info, servers, security schemes and problem catalog.
 * @example let document = createDocument({ info: { title: "Uptime API", version: "1" }, servers: [{ url: "https://uptime.example.com" }], problems }).add(monitorShow, monitorUpdate);
 */
export function createDocument<Entries extends ProblemEntries = Record<never, never>>(
	options: DocumentOptions<Entries>,
): DocumentBuilder<Entries> {
	let operations: Operation[] = [];
	let builder: DocumentBuilder<Entries> = {
		add(...added) {
			operations.push(...(added as Operation[]));
			return builder;
		},
		build: () => assemble(options, operations),
		scopes() {
			let scopes = new Map<string, Set<string>>();
			for (let operation of operations) {
				for (let requirement of operation.spec.security ?? options.security ?? []) {
					for (let [scheme, required] of Object.entries(requirement)) {
						let set = scopes.get(scheme) ?? new Set();
						for (let scope of required) set.add(scope);
						scopes.set(scheme, set);
					}
				}
			}
			return Object.fromEntries([...scopes].map(([scheme, set]) => [scheme, [...set]]));
		},
		operations: () => [...operations],
		problems: () => catalogEntries(options),
	};
	return builder;
}

/**
 * The catalog's entries, or none. Read through the catalog's methods, since a generic
 * catalog's builder names could otherwise shadow `entries` in the type.
 */
function catalogEntries<Entries extends ProblemEntries>(
	options: DocumentOptions<Entries>,
): CatalogEntry[] {
	return (options.problems as CatalogMethods<Entries> | undefined)?.entries() ?? [];
}

/** The RFC 9457 members every problem document may carry. */
const PROBLEM_SCHEMA: JSONSchema = {
	type: "object",
	description: "An RFC 9457 problem details document",
	properties: {
		type: { type: "string", format: "uri-reference" },
		title: { type: "string" },
		status: { type: "integer" },
		detail: { type: "string" },
		instance: { type: "string", format: "uri-reference" },
	},
};

/** The state one build threads through every operation. */
interface Assembly {
	schemas: Record<string, JSONSchema>;
	responses: Record<string, OpenAPI.Response>;
	securitySchemes: Record<string, OpenAPI.SecurityScheme>;
	/** Problem entries by name, with the component names they were written under. */
	problems: Map<string, { entry: CatalogEntry; response: string; schema: string }>;
}

/** Assembles the document, stopping at the first failure. */
function assemble<Entries extends ProblemEntries>(
	options: DocumentOptions<Entries>,
	operations: Operation[],
): Result<OpenAPI.Document, OpenAPIBuildError> {
	for (let [index, server] of options.servers.entries()) {
		if (!URL.canParse(server.url)) {
			return buildFailure(
				`Server URL "${server.url}" is not absolute`,
				null,
				`/servers/${index}/url`,
			);
		}
	}

	let assembly: Assembly = {
		schemas: {},
		responses: {},
		securitySchemes: { ...options.securitySchemes },
		problems: new Map(),
	};

	let security = checkSecurity(assembly, options.security, null, "/security");
	if (security.status === "failure") return security;

	let problems = addProblems(assembly, catalogEntries(options));
	if (problems.status === "failure") return problems;

	let paths: Record<string, OpenAPI.PathItem> = {};
	let seen = new Set<string>();
	for (let operation of operations) {
		if (seen.has(operation.operationId)) {
			return buildFailure(
				`Operation "${operation.operationId}" is added twice`,
				operation.operationId,
				"/paths",
			);
		}
		seen.add(operation.operationId);

		let added = addOperation(assembly, paths, operation);
		if (added.status === "failure") return added;
	}

	let document: OpenAPI.Document = {
		openapi: OPENAPI_VERSION,
		info: { ...options.info },
		jsonSchemaDialect: JSON_SCHEMA_DIALECT,
		servers: options.servers.map((server) => ({ ...server })),
		paths,
		components: {
			schemas: assembly.schemas,
			responses: assembly.responses,
			securitySchemes: assembly.securitySchemes,
		},
	};
	if (options.security !== undefined) document.security = toRequirements(options.security);
	if (options.tags !== undefined) document.tags = options.tags.map((tag) => ({ ...tag }));
	return success(document);
}

/**
 * Writes the problem schemas and responses: one `Problem` schema for the RFC 9457 base,
 * and per entry a schema pinning its `type`, `status` and `title` with its extensions, and
 * a response under the entry's PascalCase name.
 */
function addProblems(assembly: Assembly, entries: CatalogEntry[]): Result<void, OpenAPIBuildError> {
	if (entries.length === 0) return success(undefined);
	assembly.schemas.Problem = PROBLEM_SCHEMA;

	for (let entry of entries) {
		let response = pascalCase(entry.name);
		let schemaName = `${response}Problem`;
		let pointer = `/components/schemas/${escapePointer(schemaName)}`;

		let allOf: JSONSchema[] = [
			{ $ref: "#/components/schemas/Problem" },
			{
				type: "object",
				properties: {
					type: { const: entry.type },
					title: { const: entry.title },
					status: { const: entry.status },
				},
				required: ["type", "title", "status"],
			},
		];
		if (entry.extensions !== undefined) {
			let extensions = convertSchema(
				assembly,
				entry.extensions as unknown as StandardJSONSchemaV1,
				null,
				pointer,
			);
			if (extensions.status === "failure") return extensions;
			allOf.push(extensions.data);
		}

		let schema = register(assembly, schemaName, { allOf }, null);
		if (schema.status === "failure") return schema;
		assembly.responses[response] = {
			description: entry.title,
			content: { [PROBLEM_MEDIA_TYPE]: { schema: { $ref: `#/components/schemas/${schemaName}` } } },
		};
		assembly.problems.set(entry.name, { entry, response, schema: schemaName });
	}
	return success(undefined);
}

/** Adds one operation under its path and method. */
function addOperation(
	assembly: Assembly,
	paths: Record<string, OpenAPI.PathItem>,
	operation: Operation,
): Result<void, OpenAPIBuildError> {
	let { operationId, route, spec } = operation;
	let template = toPathTemplate(route.pattern);
	if (template.status === "failure") {
		return buildFailure(template.error.message, operationId, "/paths");
	}
	if (route.method === "ANY") {
		return buildFailure(
			`Operation "${operationId}" matches any method; OpenAPI documents one method per operation`,
			operationId,
			"/paths",
		);
	}

	let method = route.method.toLowerCase() as OpenAPI.Method;
	let pointer = `/paths/${escapePointer(template.data.path)}/${method}`;
	let item = paths[template.data.path] ?? {};
	if (item[method] !== undefined) {
		return buildFailure(
			`Operation "${operationId}" repeats ${route.method} ${template.data.path}`,
			operationId,
			pointer,
		);
	}

	let parameters = describeParameters(assembly, operation, template.data.variables, pointer);
	if (parameters.status === "failure") return parameters;

	let described: OpenAPI.Operation = { operationId, summary: spec.summary };
	if (spec.description !== undefined) described.description = spec.description;
	if (spec.tags !== undefined) described.tags = [...spec.tags];
	if (parameters.data.length > 0) described.parameters = parameters.data;

	if (spec.body !== undefined) {
		let content = describeContent(
			assembly,
			spec.body,
			operationId,
			`${pointer}/requestBody/content`,
		);
		if (content.status === "failure") return content;
		described.requestBody = { required: true, content: content.data };
	}

	let responses = describeResponses(assembly, spec, operationId, `${pointer}/responses`);
	if (responses.status === "failure") return responses;
	described.responses = responses.data;

	if (spec.security !== undefined) {
		let checked = checkSecurity(assembly, spec.security, operationId, `${pointer}/security`);
		if (checked.status === "failure") return checked;
		described.security = toRequirements(spec.security);
	}
	if (spec.deprecated === true) described.deprecated = true;

	item[method] = described;
	paths[template.data.path] = item;
	return success(undefined);
}

/**
 * Describes path and query parameters. Path parameters are always required, and a params
 * schema must name exactly the pattern's variables; without one, each variable is a string.
 */
function describeParameters(
	assembly: Assembly,
	operation: Operation,
	variables: string[],
	pointer: string,
): Result<OpenAPI.Parameter[], OpenAPIBuildError> {
	let { operationId, spec } = operation;
	let parameters: OpenAPI.Parameter[] = [];
	let at = `${pointer}/parameters`;

	let pathProperties: Record<string, JSONSchema> = {};
	if (spec.params !== undefined) {
		let params = objectProperties(assembly, spec.params, operationId, at);
		if (params.status === "failure") return params;
		pathProperties = params.data.properties;
		let declared = Object.keys(pathProperties).sort();
		if (declared.join() !== [...variables].sort().join()) {
			return buildFailure(
				`Operation "${operationId}" declares params [${declared.join(", ")}] for variables [${variables.join(", ")}]`,
				operationId,
				at,
			);
		}
	}
	for (let name of variables) {
		parameters.push(parameter(name, "path", true, pathProperties[name] ?? { type: "string" }));
	}

	if (spec.query !== undefined) {
		let query = objectProperties(assembly, spec.query, operationId, at);
		if (query.status === "failure") return query;
		for (let [name, schema] of Object.entries(query.data.properties)) {
			parameters.push(parameter(name, "query", query.data.required.includes(name), schema));
		}
	}
	return success(parameters);
}

/** A parameter object, lifting the schema's `description` to where readers look for it. */
function parameter(
	name: string,
	location: OpenAPI.Parameter["in"],
	required: boolean,
	schema: JSONSchema,
): OpenAPI.Parameter {
	let described: OpenAPI.Parameter = { name, in: location, required, schema };
	if (schema.description !== undefined) described.description = schema.description;
	return described;
}

/** The properties of an object schema, following a `$ref` to a named one. */
function objectProperties(
	assembly: Assembly,
	schema: StandardJSONSchemaV1,
	operationId: string,
	pointer: string,
): Result<{ properties: Record<string, JSONSchema>; required: string[] }, OpenAPIBuildError> {
	let converted = convertSchema(assembly, schema, operationId, pointer);
	if (converted.status === "failure") return converted;

	let json = converted.data;
	let ref = json.$ref?.match(/^#\/components\/schemas\/(.+)$/)?.[1];
	if (ref !== undefined) json = assembly.schemas[ref] ?? json;
	if (json.type !== "object" || json.properties === undefined) {
		return buildFailure(
			`Operation "${operationId}" needs an object schema for its parameters`,
			operationId,
			pointer,
		);
	}
	return success({ properties: json.properties, required: json.required ?? [] });
}

/** Describes a body per media type. */
function describeContent(
	assembly: Assembly,
	body: NonNullable<OperationDeclaration["body"]>,
	operationId: string,
	pointer: string,
): Result<Record<string, OpenAPI.MediaType>, OpenAPIBuildError> {
	let content: Record<string, OpenAPI.MediaType> = {};
	for (let [mediaType, schema] of Object.entries(mediaTypes(body))) {
		let converted = convertSchema(
			assembly,
			schema,
			operationId,
			`${pointer}/${escapePointer(mediaType)}/schema`,
		);
		if (converted.status === "failure") return converted;
		content[mediaType] = { schema: converted.data };
	}
	return success(content);
}

/**
 * Describes the declared responses, then each problem status: one entry is a `$ref` to its
 * response, several entries sharing a status merge into one response with `oneOf`.
 */
function describeResponses(
	assembly: Assembly,
	spec: OperationDeclaration,
	operationId: string,
	pointer: string,
): Result<Record<string, OpenAPI.Response | OpenAPI.Reference>, OpenAPIBuildError> {
	let responses: Record<string, OpenAPI.Response | OpenAPI.Reference> = {};
	for (let [status, response] of Object.entries(spec.responses)) {
		let at = `${pointer}/${status}`;
		let described: OpenAPI.Response = { description: response.description };
		if (response.headers !== undefined) {
			let headers: Record<string, OpenAPI.Header> = {};
			for (let [name, header] of Object.entries(response.headers)) {
				let schema = convertSchema(assembly, header.schema, operationId, `${at}/headers/${name}`);
				if (schema.status === "failure") return schema;
				headers[name] = { schema: schema.data };
				if (header.description !== undefined) headers[name].description = header.description;
				if (header.required !== undefined) headers[name].required = header.required;
			}
			described.headers = headers;
		}
		if (response.body !== undefined) {
			let content = describeContent(assembly, response.body, operationId, `${at}/content`);
			if (content.status === "failure") return content;
			described.content = content.data;
		}
		responses[status] = described;
	}

	let byStatus = new Map<number, { response: string; schema: string; title: string }[]>();
	for (let name of spec.problems ?? []) {
		let problem = assembly.problems.get(name);
		if (problem === undefined) {
			return buildFailure(
				`Operation "${operationId}" lists problem "${name}", which the catalog lacks`,
				operationId,
				pointer,
			);
		}
		let group = byStatus.get(problem.entry.status) ?? [];
		group.push({ response: problem.response, schema: problem.schema, title: problem.entry.title });
		byStatus.set(problem.entry.status, group);
	}

	for (let [status, group] of byStatus) {
		if (responses[status] !== undefined) {
			return buildFailure(
				`Operation "${operationId}" declares status ${status} both as a response and as a problem`,
				operationId,
				`${pointer}/${status}`,
			);
		}
		let [only] = group;
		if (group.length === 1 && only !== undefined) {
			responses[status] = { $ref: `#/components/responses/${only.response}` };
			continue;
		}
		responses[status] = {
			description: group.map((problem) => problem.title).join("; "),
			content: {
				[PROBLEM_MEDIA_TYPE]: {
					schema: {
						oneOf: group.map((problem) => ({ $ref: `#/components/schemas/${problem.schema}` })),
					},
				},
			},
		};
	}
	return success(responses);
}

/** Refuses a security requirement naming a scheme the document does not declare. */
function checkSecurity(
	assembly: Assembly,
	requirements: readonly Record<string, readonly string[]>[] | undefined,
	operationId: string | null,
	pointer: string,
): Result<void, OpenAPIBuildError> {
	for (let requirement of requirements ?? []) {
		for (let scheme of Object.keys(requirement)) {
			if (assembly.securitySchemes[scheme] === undefined) {
				return buildFailure(`Security scheme "${scheme}" is not declared`, operationId, pointer);
			}
		}
	}
	return success(undefined);
}

/** Copies readonly requirements into the document's mutable shape. */
function toRequirements(
	requirements: readonly Record<string, readonly string[]>[],
): OpenAPI.SecurityRequirement[] {
	return requirements.map((requirement) =>
		Object.fromEntries(
			Object.entries(requirement).map(([scheme, scopes]) => [scheme, [...scopes]]),
		),
	);
}

/**
 * Converts a schema's input side, hoisting its named schemas into `components.schemas`
 * and pointing its references there. Response bodies use the input side too, since the
 * conformance checker validates a response by passing its body to the schema.
 */
function convertSchema(
	assembly: Assembly,
	schema: StandardJSONSchemaV1,
	operationId: string | null,
	pointer: string,
): Result<JSONSchema, OpenAPIBuildError> {
	let converted = toJSONSchema(schema);
	if (converted.status === "failure") {
		return buildFailure(converted.error.message, operationId, pointer, { cause: converted.error });
	}

	let { $schema: _, $defs, ...json } = converted.data;
	for (let [name, definition] of Object.entries($defs ?? {})) {
		let registered = register(assembly, name, rewriteRefs(definition), operationId);
		if (registered.status === "failure") return registered;
	}
	return success(rewriteRefs(json));
}

/** Records a component schema; one name for two different schemas is a failure. */
function register(
	assembly: Assembly,
	name: string,
	schema: JSONSchema,
	operationId: string | null,
): Result<void, OpenAPIBuildError> {
	let existing = assembly.schemas[name];
	if (existing !== undefined && !isDeepEqual(existing, schema)) {
		return buildFailure(
			`Two different schemas are named "${name}"`,
			operationId,
			`/components/schemas/${escapePointer(name)}`,
		);
	}
	assembly.schemas[name] = schema;
	return success(undefined);
}

/** Keywords holding instance values, which a reference rewrite leaves as written. */
const LITERAL_KEYWORDS = new Set(["const", "enum", "default", "examples"]);

/** Points `$defs` references, including discriminator mappings, at `components.schemas`. */
function rewriteRefs<T>(value: T): T {
	if (typeof value === "string") {
		return value.replace(/^#\/\$defs\//, "#/components/schemas/") as T;
	}
	if (Array.isArray(value)) return value.map(rewriteRefs) as T;
	if (typeof value !== "object" || value === null) return value;

	let rewritten: Record<string, unknown> = {};
	for (let [key, entry] of Object.entries(value)) {
		if (LITERAL_KEYWORDS.has(key)) rewritten[key] = entry;
		else if (key === "$ref" || key === "mapping" || typeof entry === "object") {
			rewritten[key] = rewriteRefs(entry);
		} else rewritten[key] = entry;
	}
	return rewritten as T;
}

/** A catalog entry name as a component name: `notFound` becomes `NotFound`. */
function pascalCase(name: string): string {
	return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Escapes one JSON Pointer segment per RFC 6901.
 *
 * @param segment - A key, such as a path template.
 */
export function escapePointer(segment: string): string {
	return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}

/** A failed build. */
function buildFailure(
	message: string,
	operationId: string | null,
	pointer: string,
	options?: ErrorOptions,
): Result<never, OpenAPIBuildError> {
	return failure(new OpenAPIBuildError(message, operationId, pointer, options));
}

/** Structural equality over JSON values. */
function isDeepEqual(left: unknown, right: unknown): boolean {
	if (left === right) return true;
	if (typeof left !== "object" || typeof right !== "object" || left === null || right === null) {
		return false;
	}
	if (Array.isArray(left) !== Array.isArray(right)) return false;
	let leftKeys = Object.keys(left);
	if (leftKeys.length !== Object.keys(right).length) return false;
	return leftKeys.every((key) =>
		isDeepEqual((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]),
	);
}

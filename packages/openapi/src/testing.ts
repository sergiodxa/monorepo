/**
 * Conformance checking for tests: an exchange is held against the operations a document
 * declares, so a response the document does not describe is a violation, and a declared
 * status no test produced is reported as uncovered.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CatalogEntry } from "@sdxc/problem";
import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Matcher } from "remix/route-pattern/match";
import type { Middleware } from "remix/router";

import { PROBLEM_MEDIA_TYPE, toPointer } from "@sdxc/problem";
import { failure, success } from "@sdxc/result";
import { createMatcher } from "remix/route-pattern/match";

import type { DocumentBuilder } from "./document.js";
import type { Operation, ResponseSpec } from "./operation.js";

import { essence, isJSONMediaType, mediaTypes } from "./operation.js";

/** One way a response departs from the document. */
export interface Violation {
	/** The operation the request matched, `null` when it matched none. */
	operationId: string | null;
	kind:
		| "undocumented-operation"
		| "undocumented-status"
		| "undocumented-media-type"
		| "undocumented-problem-type"
		| "missing-header"
		| "body-mismatch";
	message: string;
	/** A JSON Pointer into the response body, for a body mismatch. */
	pointer?: string;
}

/** A response that departs from the document, listing every departure found. */
export class ConformanceError extends Error {
	override name = "ConformanceError";
	readonly violations: readonly Violation[];

	/** @param violations - Every departure, in the order they were found. */
	constructor(violations: readonly Violation[]) {
		super(violations.map((violation) => violation.message).join("\n"));
		this.violations = violations;
	}
}

/** What one exchange showed: the operation it matched, and how the response departed from it. */
interface Inspection {
	operationId: string | null;
	status: number;
	violations: Violation[];
}

/** The RFC 9457 members, which never count among a problem's extensions. */
const STANDARD_MEMBERS = new Set(["type", "title", "status", "detail", "instance"]);

/** Each operation's matcher, built once per operation. */
const MATCHERS = new WeakMap<Operation, Matcher>();

/**
 * Checks one exchange against the document's operations. The response body is read from a
 * clone, and validated with the declared schema's own `~standard.validate`, the code its
 * JSON Schema was derived from.
 *
 * @param document - The builder whose operations describe the API.
 * @param request - The request as sent; only its method and URL are read.
 * @param response - The response to check.
 * @example let result = await checkResponse(buildApiDocument(), request, await router.fetch(request));
 */
export async function checkResponse(
	document: DocumentBuilder<any>,
	request: Request,
	response: Response,
): Promise<Result<void, ConformanceError>> {
	let { violations } = await inspect(document, request, response);
	return violations.length === 0 ? success(undefined) : failure(new ConformanceError(violations));
}

/**
 * Records every exchange a test router serves, for a suite-level assertion. Install
 * `middleware` first on the router so it sees every response, then assert that
 * `violations()` is empty and, when the suite is complete, that `uncovered()` is too.
 *
 * @param document - The builder whose operations describe the API.
 * @example let recorder = createConformanceRecorder(buildApiDocument()); let router = createRouter({ middleware: [recorder.middleware] });
 */
export function createConformanceRecorder(document: DocumentBuilder<any>): {
	middleware: Middleware;
	violations(): readonly Violation[];
	/** Declared `operationId` + status pairs no recorded exchange produced. */
	uncovered(): readonly { operationId: string; status: number }[];
} {
	let violations: Violation[] = [];
	let covered = new Set<string>();

	return {
		async middleware(context, next) {
			let response = await next();
			let inspection = await inspect(document, context.request, response);
			violations.push(...inspection.violations);
			if (inspection.operationId !== null) {
				covered.add(`${inspection.operationId} ${inspection.status}`);
			}
			return response;
		},
		violations: () => [...violations],
		uncovered() {
			let problems = document.problems();
			let missing: { operationId: string; status: number }[] = [];
			for (let operation of document.operations()) {
				for (let status of declaredStatuses(operation, problems)) {
					if (!covered.has(`${operation.operationId} ${status}`)) {
						missing.push({ operationId: operation.operationId, status });
					}
				}
			}
			return missing;
		},
	};
}

/** The statuses an operation documents: its responses, then its problems' statuses. */
function declaredStatuses(operation: Operation, problems: CatalogEntry[]): number[] {
	let statuses = new Set(Object.keys(operation.spec.responses).map(Number));
	for (let name of operation.spec.problems ?? []) {
		let entry = problems.find((candidate) => candidate.name === name);
		if (entry !== undefined) statuses.add(entry.status);
	}
	return [...statuses];
}

/** Finds the operation a request matches and collects every way the response departs from it. */
async function inspect(
	document: DocumentBuilder<any>,
	request: Request,
	response: Response,
): Promise<Inspection> {
	let status = response.status;
	let operation = document.operations().find((candidate) => matches(candidate, request));
	if (operation === undefined) {
		return {
			operationId: null,
			status,
			violations: [
				{
					operationId: null,
					kind: "undocumented-operation",
					message: `${request.method} ${new URL(request.url).pathname} matches no operation`,
				},
			],
		};
	}

	let { operationId } = operation;
	let declared = operation.spec.responses[status];
	if (declared !== undefined) {
		return {
			operationId,
			status,
			violations: await checkDeclared(operationId, declared, response),
		};
	}

	let problems = document
		.problems()
		.filter((entry) => entry.status === status && operation.spec.problems?.includes(entry.name));
	if (problems.length > 0) {
		return { operationId, status, violations: await checkProblem(operationId, problems, response) };
	}

	return {
		operationId,
		status,
		violations: [
			{
				operationId,
				kind: "undocumented-status",
				message: `${operationId} documents no ${status} response`,
			},
		],
	};
}

/** Whether a request is for an operation's route; `HEAD` matches a `GET` route, as routers serve it. */
function matches(operation: Operation, request: Request): boolean {
	let { method } = operation.route;
	let methodMatches =
		method === "ANY" ||
		method === request.method ||
		(method === "GET" && request.method === "HEAD");
	if (!methodMatches) return false;

	let matcher = MATCHERS.get(operation) ?? createMatcher(operation.route.pattern);
	MATCHERS.set(operation, matcher);
	return matcher.match(request.url) !== null;
}

/** Checks a response against a declared status: required headers, media type and body. */
async function checkDeclared(
	operationId: string,
	declared: ResponseSpec,
	response: Response,
): Promise<Violation[]> {
	let violations: Violation[] = [];
	for (let [name, header] of Object.entries(declared.headers ?? {})) {
		if (header.required === true && !response.headers.has(name)) {
			violations.push({
				operationId,
				kind: "missing-header",
				message: `${operationId} ${response.status} is missing the ${name} header`,
			});
		}
	}

	let accepted = mediaTypes(declared.body);
	let mediaType = essence(response.headers.get("Content-Type"));
	if (mediaType === null) {
		if (Object.keys(accepted).length === 0) return violations;
		violations.push(undocumentedMediaType(operationId, response.status, "no Content-Type"));
		return violations;
	}

	let schema = accepted[mediaType];
	if (schema === undefined) {
		violations.push(undocumentedMediaType(operationId, response.status, mediaType));
		return violations;
	}

	let body = await readBody(response, mediaType);
	if (body.status === "failure") {
		violations.push({
			operationId,
			kind: "body-mismatch",
			message: body.error.message,
			pointer: "",
		});
		return violations;
	}
	violations.push(...(await validateBody(operationId, schema, body.data)));
	return violations;
}

/**
 * Checks a problem response: its media type, that its `type` is one of the entries the
 * operation lists for this status, and that its extensions pass the entry's schema.
 */
async function checkProblem(
	operationId: string,
	entries: CatalogEntry[],
	response: Response,
): Promise<Violation[]> {
	let mediaType = essence(response.headers.get("Content-Type"));
	if (mediaType !== PROBLEM_MEDIA_TYPE) {
		return [undocumentedMediaType(operationId, response.status, mediaType ?? "no Content-Type")];
	}

	let body = await readBody(response, mediaType);
	if (body.status === "failure") {
		return [{ operationId, kind: "body-mismatch", message: body.error.message, pointer: "" }];
	}

	let document =
		typeof body.data === "object" && body.data !== null
			? (body.data as Record<string, unknown>)
			: {};
	let entry = entries.find((candidate) => candidate.type === document.type);
	if (entry === undefined) {
		return [
			{
				operationId,
				kind: "undocumented-problem-type",
				message: `${operationId} documents no ${response.status} problem of type ${JSON.stringify(document.type)}`,
			},
		];
	}
	if (entry.extensions === undefined) return [];

	let extensions = Object.fromEntries(
		Object.entries(document).filter(([key]) => !STANDARD_MEMBERS.has(key)),
	);
	return validateBody(operationId, entry.extensions, extensions);
}

/** A violation for a media type the declared response does not list. */
function undocumentedMediaType(operationId: string, status: number, found: string): Violation {
	return {
		operationId,
		kind: "undocumented-media-type",
		message: `${operationId} ${status} does not document ${found}`,
	};
}

/** Reads a clone of the body: JSON media types parsed, anything else as text. */
async function readBody(response: Response, mediaType: string): Promise<Result<unknown, Error>> {
	let text = await response.clone().text();
	if (!isJSONMediaType(mediaType)) return success(text);
	try {
		return success(JSON.parse(text));
	} catch {
		return failure(new Error(`The ${mediaType} body is not valid JSON`));
	}
}

/** Validates a body with a schema's own validator, one violation per issue. */
async function validateBody(
	operationId: string,
	schema: StandardSchemaV1,
	value: unknown,
): Promise<Violation[]> {
	let result = await schema["~standard"].validate(value);
	return (result.issues ?? []).map((issue) => {
		let pointer = toPointer(issue.path);
		return {
			operationId,
			kind: "body-mismatch",
			message: `${operationId}: ${issue.message} at "${pointer}"`,
			pointer,
		};
	});
}

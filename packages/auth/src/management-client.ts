/**
 * The client for the provider's own records, reading a subject over the management
 * API with a token its service client issues. Every read answers with a `Result`,
 * keeping a record that is absent apart from a provider that could not answer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { LinkValue } from "@sdxc/pagination";
import type { Result } from "@sdxc/result";

import * as s from "@remix-run/data-schema";
import { url } from "@remix-run/data-schema/checks";
import { parseLinkHeader } from "@sdxc/pagination";
import { failure, isFailure, isSuccess, success, wrap } from "@sdxc/result";

import { nonJsonMediaType } from "./content-type.js";

/** Path the management API serves one subject at, with the id appended to it. */
const SUBJECT_PATH = "/api/subjects";

/**
 * A timestamp as the wire carries it, refused before it could reach a caller as a
 * `Date` that reads `Invalid Date` at every use.
 */
const TIMESTAMP_SCHEMA = s
	.string()
	.refine((value) => !Number.isNaN(Date.parse(value)), "Expected an ISO-8601 timestamp")
	.transform((value) => new Date(value));

/**
 * The envelope a subject read answers with. The provider publishes these member
 * names and ISO-8601 timestamps as a frozen contract, so a payload missing one is
 * reported as a provider the caller cannot read.
 */
const SUBJECT_SCHEMA = s.object({
	subject: s.object({
		id: s.string(),
		createdAt: TIMESTAMP_SCHEMA,
		updatedAt: TIMESTAMP_SCHEMA,
		displayName: s.string(),
		avatar: s.string().pipe(url()),
		role: s.enum_(["user", "admin"]),
		username: s.string(),
		emailAddress: s.string(),
	}),
});

/**
 * Why the management API produced no record. Closed, so a caller can exhaust every
 * case, and stable, so a log groups reads that failed the same way together.
 */
export const ManagementErrorCode = {
	/** The management API refused the credential this client presented. */
	Unauthorized: "unauthorized",
	/** The management API asked for a slower rate before it would answer. */
	RateLimited: "rate_limited",
	/** The management API failed while producing an answer. */
	ProviderFailed: "provider_failed",
	/** The request reached no answer at all. */
	RequestFailed: "request_failed",
	/** The answer arrived in a shape outside the record's contract. */
	InvalidResponse: "invalid_response",
} as const;

/** Which way a read failed, exhaustive so a `switch` over it closes. */
export type ManagementErrorCode = (typeof ManagementErrorCode)[keyof typeof ManagementErrorCode];

/** Diagnostic context attached to a {@link ManagementError}. */
export interface ManagementErrorOptions {
	/** Which way the read failed, for branching and for grouping in logs. */
	code: ManagementErrorCode;
	/** The status the provider answered with, where the failure came from a response. */
	status?: number;
	/** Underlying error or validation issues, preserved for the stack trace. */
	cause?: unknown;
}

/**
 * The failure a management read reports when the provider produced no record: it
 * refused, throttled, failed, or answered unreadably. Each of these can succeed on
 * a later attempt, so a caller may retry one where it would pass over an absence.
 */
export class ManagementError extends Error {
	/** Which way the read failed. */
	readonly code: ManagementErrorCode;

	/** The status the provider answered with, and `null` when it never answered. */
	readonly status: number | null;

	/**
	 * Builds a failure carrying its code alongside the message.
	 *
	 * @param message - What went wrong, phrased for an operator reading a log.
	 * @param options - The code, the status, and the underlying cause.
	 */
	constructor(message: string, options: ManagementErrorOptions) {
		super(message, { cause: options.cause });
		this.name = "ManagementError";
		this.code = options.code;
		this.status = options.status ?? null;
	}

	/**
	 * Reports whether a value is a `ManagementError` carrying one specific code,
	 * giving a caller a single narrowing test to branch a retry decision on.
	 *
	 * @param error - The failure a read answered with.
	 * @param code - The code to test for.
	 */
	static is(error: unknown, code: ManagementErrorCode): error is ManagementError {
		return error instanceof ManagementError && error.code === code;
	}
}

/**
 * The failure a management read reports when the provider holds no record under the
 * requested id. This is a definite answer from the provider, so a caller resolving
 * several ids may leave this one out and keep the rest.
 */
export class SubjectNotFoundError extends Error {
	/** The id the provider found no record under. */
	readonly subjectId: string;

	/** @param subjectId - The subject that was asked for. */
	constructor(subjectId: string) {
		super(`Subject not found: ${subjectId}`);
		this.name = "SubjectNotFoundError";
		this.subjectId = subjectId;
	}
}

/** The media type a tenant-scoped failure declares, naming RFC 9457 by its registered subtype. */
const PROBLEM_MEDIA_TYPE = "application/problem+json";

/** One field-level issue inside a validation failure's `errors` array. */
export interface ManagementProblemDetail {
	/** Which field the issue names, as a JSON Pointer into the request body. */
	pointer: string;
	/** A stable code for this issue, for a caller branching without reading `message`. */
	code: string;
	/** The issue, phrased for the person who will read it. */
	message: string;
}

/** The fields a tenant-scoped failure carries, decoded straight off its RFC 9457 body. */
export interface ManagementProblemOptions {
	type: string;
	title: string;
	status: number;
	detail?: string;
	instance?: string;
	errors?: ManagementProblemDetail[];
}

/**
 * The failure a tenant-scoped call reports when the platform's own management API refused
 * it: a structured RFC 9457 `application/problem+json` body rather than the flat status code
 * {@link ManagementError} covers. `type` is the stable identifier worth branching on; `title`
 * and `detail` are prose for a log, and `errors` is populated only for a validation failure.
 */
export class ManagementProblem extends Error {
	/** A stable URI naming the failure, the field worth comparing across responses. */
	readonly type: string;
	/** A short, human-readable summary of the failure. */
	readonly title: string;
	/** The HTTP status the response carried alongside this body. */
	readonly status: number;
	/** A longer explanation specific to this occurrence, or `null` when the response left it off. */
	readonly detail: string | null;
	/** The request id the platform's own logs are keyed by, or `null` when the response left it off. */
	readonly instance: string | null;
	/** One entry per invalid field, populated only for a validation failure. */
	readonly errors: ManagementProblemDetail[];

	/** @param options - The fields decoded off the response's RFC 9457 body. */
	constructor(options: ManagementProblemOptions) {
		super(options.detail ?? options.title);
		this.name = "ManagementProblem";
		this.type = options.type;
		this.title = options.title;
		this.status = options.status;
		this.detail = options.detail ?? null;
		this.instance = options.instance ?? null;
		this.errors = options.errors ?? [];
	}
}

/** The shape a tenant-scoped failure's body is decoded against before becoming a {@link ManagementProblem}. */
const PROBLEM_SCHEMA = s.object({
	type: s.string(),
	title: s.string(),
	status: s.number(),
	detail: s.optional(s.string()),
	instance: s.optional(s.string()),
	errors: s.optional(
		s.array(s.object({ pointer: s.string(), code: s.string(), message: s.string() })),
	),
});

/**
 * Names what a non-2xx answer means for a caller deciding between waiting and
 * stopping, since the status is all the provider tells those two apart by.
 *
 * @param status - Status the provider answered with.
 */
function codeForStatus(status: number): ManagementErrorCode {
	if (status === 401 || status === 403) return ManagementErrorCode.Unauthorized;
	if (status === 429) return ManagementErrorCode.RateLimited;
	return ManagementErrorCode.ProviderFailed;
}

/** A query value worth sending; `undefined` and `null` mean "leave this parameter off". */
type QueryValue = string | number | boolean | null | undefined;

/**
 * Builds the absolute path one tenant's resource is served at, `encodeURIComponent`-ing
 * every id and literal segment so a value containing a slash never reshapes the path
 * around it.
 *
 * @param tenantId - The tenant every route in this surface is scoped to.
 * @param segments - The resource path under that tenant, as literal names and ids.
 */
function tenantPath(tenantId: string, ...segments: (string | number)[]): string {
	return [
		"",
		"tenants",
		encodeURIComponent(tenantId),
		...segments.map((segment) => encodeURIComponent(String(segment))),
	].join("/");
}

/**
 * Reads the continuation targets a keyset list answers with off its `Link` header,
 * leaving the RFC 8288 parsing itself to `@sdxc/pagination`.
 *
 * @param header - The response's own `Link` header value.
 */
function cursorsFromLinkHeader(header: string | null): {
	next: string | null;
	prev: string | null;
} {
	let links: LinkValue[] = parseLinkHeader(header);

	return {
		next: links.find((link) => link.rels.includes("next"))?.target ?? null,
		prev: links.find((link) => link.rels.includes("prev"))?.target ?? null,
	};
}

/**
 * One tenant's identifier, exactly as a subject's own state names it: which kind it
 * is, its value, whether it has proven itself, and whether it is the address every
 * account notice reaches.
 */
const TENANT_IDENTIFIER_STATE_SCHEMA = s.object({
	kind: s.enum_(["email", "username"] as const),
	value: s.string(),
	verified: s.boolean(),
	verifiedAt: s.nullable(s.number()),
	isPrimary: s.boolean(),
});

/** A declared attribute's value, kept to the flat shape a tenant may write and read back. */
const ATTRIBUTE_VALUE_SCHEMA = s.nullable(s.union([s.string(), s.number(), s.boolean()]));

/** One subject as the tenant-scoped surface answers a read of it, second factor included. */
const TENANT_SUBJECT_SCHEMA = s.object({
	id: s.string(),
	status: s.enum_(["active", "blocked"] as const),
	name: s.nullable(s.string()),
	givenName: s.nullable(s.string()),
	familyName: s.nullable(s.string()),
	nickname: s.nullable(s.string()),
	preferredUsername: s.nullable(s.string()),
	picture: s.nullable(s.string()),
	locale: s.nullable(s.string()),
	zoneinfo: s.nullable(s.string()),
	identifiers: s.array(TENANT_IDENTIFIER_STATE_SCHEMA),
	attributes: s.record(s.string(), ATTRIBUTE_VALUE_SCHEMA),
	totpFactor: s.object({ label: s.nullable(s.string()), lastUsedAt: s.nullable(s.number()) }),
	recoveryCodesRemaining: s.number(),
	trustedDevices: s.array(
		s.object({
			id: s.string(),
			createdAt: s.number(),
			expiresAt: s.number(),
			ip: s.nullable(s.string()),
			userAgent: s.nullable(s.string()),
		}),
	),
});

/** What creating a subject answers: its new id, and every identifier's starting state. */
const CREATE_TENANT_SUBJECT_RESULT_SCHEMA = s.object({
	subjectId: s.string(),
	identifiers: s.array(TENANT_IDENTIFIER_STATE_SCHEMA),
});

/** An email identifier answers with a ticket to deliver; a username needs none. */
const ADD_TENANT_SUBJECT_IDENTIFIER_RESULT_SCHEMA = s.variant("kind", {
	email: s.object({
		identifierId: s.string(),
		kind: s.literal("email" as const),
		value: s.string(),
		ticket: s.string(),
		ticketExpiresAt: s.number(),
	}),
	username: s.object({
		identifierId: s.string(),
		kind: s.literal("username" as const),
		value: s.string(),
	}),
});

const VERIFY_TENANT_SUBJECT_IDENTIFIER_RESULT_SCHEMA = s.object({
	subjectId: s.string(),
	promotedPrimary: s.boolean(),
});

const REMOVE_TENANT_SUBJECT_IDENTIFIER_RESULT_SCHEMA = s.object({
	promotedPrimary: s.nullable(s.string()),
	notify: s.array(s.string()),
});

/** One live session as a subject's own credential list would render it. */
const TENANT_SESSION_SUMMARY_SCHEMA = s.object({
	id: s.string(),
	createdAt: s.number(),
	lastSeenAt: s.number(),
	amr: s.array(s.string()),
	ip: s.nullable(s.string()),
	userAgent: s.nullable(s.string()),
	country: s.nullable(s.string()),
	region: s.nullable(s.string()),
	city: s.nullable(s.string()),
});

const REVOKE_ALL_TENANT_SUBJECT_SESSIONS_RESULT_SCHEMA = s.object({ revoked: s.number() });

const FORCE_TENANT_SUBJECT_PASSWORD_RESET_RESULT_SCHEMA = s.object({
	passwordId: s.string(),
	reason: s.string(),
});

const RESET_TENANT_SUBJECT_SECOND_FACTOR_RESULT_SCHEMA = s.object({
	notifyAddress: s.nullable(s.string()),
});

/** A client's whole editable record, and the protocol capabilities it carries. */
const TENANT_CLIENT_RECORD_SCHEMA = s.object({
	id: s.string(),
	name: s.string(),
	kind: s.enum_(["confidential", "public"] as const),
	redirectUris: s.array(s.string()),
	postLogoutRedirectUris: s.array(s.string()),
	grantTypes: s.array(s.string()),
	responseTypes: s.array(s.string()),
	scopes: s.array(s.string()),
	tokenEndpointAuthMethod: s.enum_(["client_secret_basic", "client_secret_post", "none"] as const),
	requireConsent: s.boolean(),
	createdAt: s.number(),
	updatedAt: s.number(),
	disabledAt: s.nullable(s.number()),
});

/** One client as a tenant's own client list would render it. */
const TENANT_CLIENT_SUMMARY_SCHEMA = s.object({
	id: s.string(),
	name: s.string(),
	kind: s.enum_(["confidential", "public"] as const),
	tokenEndpointAuthMethod: s.enum_(["client_secret_basic", "client_secret_post", "none"] as const),
	createdAt: s.number(),
	disabledAt: s.nullable(s.number()),
});

const REGISTER_TENANT_CLIENT_RESULT_SCHEMA = s.object({
	client: TENANT_CLIENT_RECORD_SCHEMA,
	secret: s.nullable(s.string()),
});

const UPDATE_TENANT_CLIENT_RESULT_SCHEMA = s.object({ client: TENANT_CLIENT_RECORD_SCHEMA });

const ROTATE_TENANT_CLIENT_SECRET_RESULT_SCHEMA = s.object({
	secretId: s.string(),
	secret: s.string(),
	incumbentExpiresAt: s.nullable(s.number()),
});

/** One grant as a subject's own consent list would render it. */
const TENANT_GRANT_SUMMARY_SCHEMA = s.object({
	clientId: s.string(),
	clientName: s.string(),
	scopes: s.array(s.string()),
	createdAt: s.number(),
});

/** One row of this tenant's audit log, `context` and `detail` decoded back to objects. */
const TENANT_AUDIT_EVENT_SCHEMA = s.object({
	id: s.string(),
	at: s.number(),
	action: s.string(),
	actorType: s.enum_(["subject", "member", "client", "platform"] as const),
	actorId: s.string(),
	targetType: s.string(),
	targetId: s.string(),
	outcome: s.enum_(["succeeded", "failed", "denied"] as const),
	context: s.record(s.string(), s.any()),
	detail: s.record(s.string(), s.any()),
});

/**
 * A tenant's own public record: what a management client administers about the
 * tenant itself, leaving out the billing customer id and the payment provider's own
 * subscription id — both platform-internal linkage rather than a fact about the
 * tenant a caller here would act on — and the deletion tombstone a live tenant never
 * carries anyway.
 */
const TENANT_RECORD_SCHEMA = s.object({
	id: s.string(),
	name: s.string(),
	slug: s.string(),
	issuer: s.string(),
	region: s.enum_(["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"] as const),
	status: s.enum_(["active", "suspended", "deleted"] as const),
	planSlug: s.string(),
	subscriptionStatus: s.string(),
	currentPeriodEnd: s.nullable(s.number()),
	cancelAtPeriodEnd: s.boolean(),
	graceUntil: s.nullable(s.number()),
	lapsedAt: s.nullable(s.number()),
	createdAt: s.number(),
	updatedAt: s.number(),
});

const TENANT_MEMBER_SCHEMA = s.object({
	id: s.string(),
	tenantId: s.string(),
	subjectId: s.string(),
	role: s.enum_(["owner", "admin", "member"] as const),
	createdAt: s.number(),
	updatedAt: s.number(),
});

const TENANT_DOMAIN_SCHEMA = s.object({
	id: s.string(),
	tenantId: s.string(),
	hostname: s.string(),
	kind: s.enum_(["platform", "custom"] as const),
	status: s.enum_(["pending", "active", "failed"] as const),
	certificateStatus: s.nullable(s.string()),
	verificationName: s.nullable(s.string()),
	verificationValue: s.nullable(s.string()),
	createdAt: s.number(),
	updatedAt: s.number(),
});

const TENANT_DOMAIN_VERIFICATION_SCHEMA = s.object({
	status: s.enum_(["pending", "active", "failed"] as const),
	certificateStatus: s.nullable(s.string()),
	verificationName: s.nullable(s.string()),
	verificationValue: s.nullable(s.string()),
});

/**
 * The provider's management API, read as the client its service client authenticates
 * as. Every credential comes from that service client, so an app configures one set
 * of client credentials and reads records with them.
 *
 * @example
 * let admin = new ManagementClient(service);
 * let result = await admin.fetchSubjectById(subjectId);
 */
export class ManagementClient {
	#service: ManagementClient.Service;
	#baseUrl: URL;
	#resources: string[];
	#apiVersion: string | undefined;

	/**
	 * The version most recently echoed back on a tenant-scoped call's response,
	 * `null` before any such call has completed. Read it right after `await`ing a
	 * call to see which version actually served it, since a request naming no
	 * `apiVersion` is free to be served the platform's own oldest supported one.
	 */
	apiVersionReceived: string | null = null;

	/**
	 * Points a client at the records of the provider its service client speaks to.
	 *
	 * @param service - Service client every read takes its access token and, by
	 *   default, its origin from.
	 * @param options - Where the management API is served and how a token is scoped.
	 */
	constructor(service: ManagementClient.Service, options: ManagementClient.Options = {}) {
		this.#service = service;
		this.#baseUrl = new URL(options.baseUrl ?? service.issuer.url);
		this.#resources = options.resources ?? [];
		this.#apiVersion = options.apiVersion;
	}

	/**
	 * Reads one subject by id. An id the provider holds no record under answers
	 * `SubjectNotFoundError`, and a provider that refused, throttled, failed, or
	 * answered unreadably answers `ManagementError`.
	 *
	 * @param subjectId - The subject to read.
	 * @returns The subject, the absence of a record, or why no record arrived.
	 * @throws `AuthError` when the service client cannot obtain an access token.
	 * @example
	 * if (isFailure(result) && result.error instanceof SubjectNotFoundError) return null;
	 */
	async fetchSubjectById(
		subjectId: string,
	): Promise<Result<ManagementClient.Subject, SubjectNotFoundError | ManagementError>> {
		let token = await this.#service.token({ resources: this.#resources });
		let endpoint = new URL(`${SUBJECT_PATH}/${encodeURIComponent(subjectId)}`, this.#baseUrl);

		let answer = await wrap(() =>
			fetch(endpoint, {
				headers: { accept: "application/json", authorization: `Bearer ${token}` },
			}),
		);

		if (isFailure(answer)) {
			return failure(
				new ManagementError(`The request to ${endpoint.href} did not complete.`, {
					code: ManagementErrorCode.RequestFailed,
					cause: answer.error,
				}),
			);
		}

		let response = answer.data;

		if (response.status === 404) return failure(new SubjectNotFoundError(subjectId));

		if (!response.ok) {
			return failure(
				new ManagementError(`${endpoint.href} answered with status ${response.status}.`, {
					code: codeForStatus(response.status),
					status: response.status,
				}),
			);
		}

		return await this.#subject(endpoint, response);
	}

	/**
	 * Reads an answered body as the record it is contracted to hold, so a payload in
	 * another shape is reported as one the caller cannot read. An answer declaring a
	 * media type other than JSON is reported from that header alone.
	 *
	 * @param endpoint - Where the answer came from, named in the failure message.
	 * @param response - The answer, with its body still unread.
	 */
	async #subject(
		endpoint: URL,
		response: Response,
	): Promise<Result<ManagementClient.Subject, ManagementError>> {
		let mediaType = nonJsonMediaType(response);

		if (mediaType !== null) {
			return failure(
				new ManagementError(`${endpoint.href} answered with ${mediaType} instead of JSON.`, {
					code: ManagementErrorCode.InvalidResponse,
					status: response.status,
				}),
			);
		}

		let payload = await wrap(async () => JSON.parse(await response.text()) as unknown);

		if (isFailure(payload)) {
			return failure(
				new ManagementError(`${endpoint.href} answered with something other than JSON.`, {
					code: ManagementErrorCode.InvalidResponse,
					status: response.status,
					cause: payload.error,
				}),
			);
		}

		let parsed = s.parseSafe(SUBJECT_SCHEMA, payload.data);

		if (!parsed.success) {
			return failure(
				new ManagementError(`${endpoint.href} answered with a payload that is not a subject.`, {
					code: ManagementErrorCode.InvalidResponse,
					status: response.status,
					cause: parsed.issues,
				}),
			);
		}

		return success(parsed.value.subject);
	}

	/**
	 * Sends one tenant-scoped request: resolves the bearer token, appends the query
	 * string, names `X-API-Version` when one is configured or given for this call
	 * alone, and classifies a non-2xx answer into {@link ManagementProblem} or the
	 * flat {@link ManagementError} depending on what the response declares.
	 *
	 * @param method - The HTTP method to send.
	 * @param path - The absolute path under the configured base URL, from {@link tenantPath}.
	 * @param options - The body to encode, the query string to append, and an
	 *   `X-API-Version` for this call alone.
	 */
	async #send(
		method: string,
		path: string,
		options: { body?: unknown; query?: Record<string, QueryValue>; apiVersion?: string } = {},
	): Promise<Result<{ endpoint: URL; response: Response }, ManagementError | ManagementProblem>> {
		let token = await this.#service.token({ resources: this.#resources });
		let endpoint = new URL(path, this.#baseUrl);

		if (options.query) {
			for (let [key, value] of Object.entries(options.query)) {
				if (value === undefined || value === null) continue;
				endpoint.searchParams.set(key, String(value));
			}
		}

		let headers = new Headers({ accept: "application/json", authorization: `Bearer ${token}` });

		let apiVersion = options.apiVersion ?? this.#apiVersion;
		if (apiVersion !== undefined) headers.set("x-api-version", apiVersion);

		let init: RequestInit = { method, headers };
		if (options.body !== undefined) {
			headers.set("content-type", "application/json");
			init.body = JSON.stringify(options.body);
		}

		let answer = await wrap(() => fetch(endpoint, init));

		if (isFailure(answer)) {
			return failure(
				new ManagementError(`The request to ${endpoint.href} did not complete.`, {
					code: ManagementErrorCode.RequestFailed,
					cause: answer.error,
				}),
			);
		}

		let response = answer.data;
		this.apiVersionReceived = response.headers.get("x-api-version");

		if (!response.ok) return failure(await this.#problemFor(endpoint, response));

		return success({ endpoint, response });
	}

	/**
	 * Classifies a non-2xx answer: a body declaring `application/problem+json` decodes
	 * into a {@link ManagementProblem} carrying every RFC 9457 field the response gave;
	 * an unreadable body, or a plain status with none, falls back to the flat
	 * {@link ManagementError} every other failure in this client already reports.
	 *
	 * @param endpoint - Where the answer came from, named in a fallback failure's message.
	 * @param response - The non-2xx answer, with its body still unread.
	 */
	async #problemFor(
		endpoint: URL,
		response: Response,
	): Promise<ManagementError | ManagementProblem> {
		let declared = response.headers.get("content-type");
		let mediaType = declared ? (declared.split(";")[0]?.trim().toLowerCase() ?? null) : null;

		if (mediaType === PROBLEM_MEDIA_TYPE) {
			let payload = await wrap(async () => JSON.parse(await response.text()) as unknown);

			if (isSuccess(payload)) {
				let parsed = s.parseSafe(PROBLEM_SCHEMA, payload.data);
				if (parsed.success) return new ManagementProblem(parsed.value);
			}
		}

		return new ManagementError(`${endpoint.href} answered with status ${response.status}.`, {
			code: codeForStatus(response.status),
			status: response.status,
		});
	}

	/**
	 * Reads an answered body as the shape `schema` is contracted to hold, the generic
	 * version of this client's own {@link ManagementClient#subject} read that every
	 * tenant-scoped call shares rather than repeating its parse.
	 *
	 * @param endpoint - Where the answer came from, named in the failure message.
	 * @param response - The answer, with its body still unread.
	 * @param schema - What the body is validated against.
	 */
	async #decode<Output>(
		endpoint: URL,
		response: Response,
		schema: s.Schema<unknown, Output>,
	): Promise<Result<Output, ManagementError>> {
		let mediaType = nonJsonMediaType(response);

		if (mediaType !== null) {
			return failure(
				new ManagementError(`${endpoint.href} answered with ${mediaType} instead of JSON.`, {
					code: ManagementErrorCode.InvalidResponse,
					status: response.status,
				}),
			);
		}

		let payload = await wrap(async () => JSON.parse(await response.text()) as unknown);

		if (isFailure(payload)) {
			return failure(
				new ManagementError(`${endpoint.href} answered with something other than JSON.`, {
					code: ManagementErrorCode.InvalidResponse,
					status: response.status,
					cause: payload.error,
				}),
			);
		}

		let parsed = s.parseSafe(schema, payload.data);

		if (!parsed.success) {
			return failure(
				new ManagementError(`${endpoint.href} answered with a payload this client cannot read.`, {
					code: ManagementErrorCode.InvalidResponse,
					status: response.status,
					cause: parsed.issues,
				}),
			);
		}

		return success(parsed.value);
	}

	/**
	 * Sends one tenant-scoped call and, on success, decodes its body against `schema` —
	 * or, when a call answers with nothing worth reading, reports success with no value
	 * at all. Every method in this client's tenant-scoped surface is one call to this.
	 *
	 * @param method - The HTTP method to send.
	 * @param path - The absolute path under the configured base URL.
	 * @param options - The body and query string to send, the schema the answer is
	 *   validated against, and an `X-API-Version` for this call alone.
	 */
	async #call<Output = void>(
		method: string,
		path: string,
		options: {
			body?: unknown;
			query?: Record<string, QueryValue>;
			apiVersion?: string;
			schema?: s.Schema<unknown, Output>;
		} = {},
	): Promise<Result<Output, ManagementError | ManagementProblem>> {
		let sent = await this.#send(method, path, options);
		if (isFailure(sent)) return sent;

		if (!options.schema) return success(undefined as Output);

		return this.#decode(sent.data.endpoint, sent.data.response, options.schema);
	}

	/**
	 * Sends one keyset list call, decoding its body as an array of `itemSchema` and its
	 * `Link` header into the continuation targets a caller pages with — the pagination
	 * half of {@link ManagementClient#call} every list method in this surface shares.
	 *
	 * @param path - The absolute path under the configured base URL.
	 * @param options - The query string to send and the schema each item validates against.
	 */
	async #page<Item>(
		path: string,
		options: { query?: Record<string, QueryValue>; itemSchema: s.Schema<unknown, Item> },
	): Promise<Result<ManagementClient.Page<Item>, ManagementError | ManagementProblem>> {
		let sent = await this.#send("GET", path, { query: options.query });
		if (isFailure(sent)) return sent;

		let { endpoint, response } = sent.data;
		let decoded = await this.#decode(endpoint, response, s.array(options.itemSchema));
		if (isFailure(decoded)) return decoded;

		return success({ items: decoded.data, ...cursorsFromLinkHeader(response.headers.get("link")) });
	}

	// -- Subjects and identifiers -------------------------------------------------

	/**
	 * Reads one tenant's subject by id: its profile, its identifiers, the attributes
	 * an administrator may see, and its second-factor state. Requires `subjects:read`.
	 *
	 * @param tenantId - The tenant the subject belongs to.
	 * @param subjectId - The subject to read.
	 */
	async fetchTenantSubjectById(
		tenantId: string,
		subjectId: string,
	): Promise<Result<ManagementClient.TenantSubject, ManagementError | ManagementProblem>> {
		return this.#call("GET", tenantPath(tenantId, "subjects", subjectId), {
			schema: TENANT_SUBJECT_SCHEMA,
		});
	}

	/**
	 * Creates a subject, claiming every identifier it starts with unverified.
	 * Requires `subjects:write`.
	 *
	 * @param tenantId - The tenant to create the subject in.
	 * @param input - The identifiers to claim, the profile claims, and any attributes to set.
	 */
	async createTenantSubject(
		tenantId: string,
		input: ManagementClient.CreateTenantSubjectInput,
	): Promise<
		Result<ManagementClient.CreateTenantSubjectResult, ManagementError | ManagementProblem>
	> {
		return this.#call("POST", tenantPath(tenantId, "subjects"), {
			body: input,
			schema: CREATE_TENANT_SUBJECT_RESULT_SCHEMA,
		});
	}

	/**
	 * Writes a subject's profile and declared attributes. Requires `subjects:write`.
	 *
	 * @param tenantId - The tenant the subject belongs to.
	 * @param subjectId - The subject to update.
	 * @param input - The profile columns and attributes to change.
	 */
	async updateTenantSubject(
		tenantId: string,
		subjectId: string,
		input: ManagementClient.UpdateTenantSubjectInput,
	): Promise<Result<void, ManagementError | ManagementProblem>> {
		return this.#call("PATCH", tenantPath(tenantId, "subjects", subjectId), { body: input });
	}

	/**
	 * Blocks a subject and revokes every session it holds. Requires `subjects:write`.
	 *
	 * @param tenantId - The tenant the subject belongs to.
	 * @param subjectId - The subject to block.
	 * @param input - Why the subject is being blocked.
	 */
	async blockTenantSubject(
		tenantId: string,
		subjectId: string,
		input: { reason: string },
	): Promise<Result<void, ManagementError | ManagementProblem>> {
		return this.#call("POST", tenantPath(tenantId, "subjects", subjectId, "block"), {
			body: input,
		});
	}

	/**
	 * Restores a blocked subject to active. Requires `subjects:write`.
	 *
	 * @param tenantId - The tenant the subject belongs to.
	 * @param subjectId - The subject to unblock.
	 */
	async unblockTenantSubject(
		tenantId: string,
		subjectId: string,
	): Promise<Result<void, ManagementError | ManagementProblem>> {
		return this.#call("POST", tenantPath(tenantId, "subjects", subjectId, "unblock"));
	}

	/**
	 * Deletes a subject, its identifiers, its attributes and its sessions, and
	 * retires the id for good. Requires `subjects:write`.
	 *
	 * @param tenantId - The tenant the subject belongs to.
	 * @param subjectId - The subject to delete.
	 */
	async deleteTenantSubject(
		tenantId: string,
		subjectId: string,
	): Promise<Result<void, ManagementError | ManagementProblem>> {
		return this.#call("DELETE", tenantPath(tenantId, "subjects", subjectId));
	}

	/**
	 * Claims a new identifier for an existing subject: an email starts unverified with
	 * a ticket for the caller to deliver, a username is usable immediately. Requires
	 * `subjects:write`.
	 *
	 * @param tenantId - The tenant the subject belongs to.
	 * @param subjectId - The subject to attach the identifier to.
	 * @param input - The identifier's kind and value.
	 */
	async addTenantSubjectIdentifier(
		tenantId: string,
		subjectId: string,
		input: { kind: ManagementClient.TenantIdentifierKind; value: string },
	): Promise<
		Result<ManagementClient.AddTenantSubjectIdentifierResult, ManagementError | ManagementProblem>
	> {
		return this.#call("POST", tenantPath(tenantId, "subjects", subjectId, "identifiers"), {
			body: input,
			schema: ADD_TENANT_SUBJECT_IDENTIFIER_RESULT_SCHEMA,
		});
	}

	/**
	 * Spends a verification ticket, resolving the subject it belongs to from the
	 * ticket alone — a verifying request names no subject of its own, since the
	 * ticket is what proves which one it is. Requires `subjects:write`.
	 *
	 * @param tenantId - The tenant the ticket was minted in.
	 * @param input - The ticket as it was delivered to the address.
	 */
	async verifyTenantSubjectIdentifier(
		tenantId: string,
		input: { ticket: string },
	): Promise<
		Result<
			ManagementClient.VerifyTenantSubjectIdentifierResult,
			ManagementError | ManagementProblem
		>
	> {
		return this.#call("POST", tenantPath(tenantId, "identifiers", "verify"), {
			body: input,
			schema: VERIFY_TENANT_SUBJECT_IDENTIFIER_RESULT_SCHEMA,
		});
	}

	/**
	 * Removes an identifier, refusing to take a subject's last verified email address
	 * when it is also their last remaining credential. Requires `subjects:write`.
	 *
	 * @param tenantId - The tenant the subject belongs to.
	 * @param subjectId - The subject the identifier belongs to.
	 * @param input - The identifier's value as entered.
	 */
	async removeTenantSubjectIdentifier(
		tenantId: string,
		subjectId: string,
		input: { value: string },
	): Promise<
		Result<
			ManagementClient.RemoveTenantSubjectIdentifierResult,
			ManagementError | ManagementProblem
		>
	> {
		return this.#call("DELETE", tenantPath(tenantId, "subjects", subjectId, "identifiers"), {
			query: { value: input.value },
			schema: REMOVE_TENANT_SUBJECT_IDENTIFIER_RESULT_SCHEMA,
		});
	}

	// -- Credentials and sessions --------------------------------------------------

	/**
	 * A page of a subject's live sessions, newest first. Requires `sessions:write` —
	 * this resource's scope vocabulary carries no separate read scope, so listing
	 * shares the one scope the resource was given rather than splitting it.
	 *
	 * @param tenantId - The tenant the subject belongs to.
	 * @param subjectId - The subject whose sessions to list.
	 * @param options - Where to page from.
	 */
	async listTenantSubjectSessions(
		tenantId: string,
		subjectId: string,
		options: { cursor?: string | null; limit?: number } = {},
	): Promise<
		Result<
			ManagementClient.Page<ManagementClient.TenantSessionSummary>,
			ManagementError | ManagementProblem
		>
	> {
		return this.#page(tenantPath(tenantId, "subjects", subjectId, "sessions"), {
			query: { cursor: options.cursor, limit: options.limit },
			itemSchema: TENANT_SESSION_SUMMARY_SCHEMA,
		});
	}

	/**
	 * Revokes one of a subject's sessions. Requires `sessions:write`.
	 *
	 * @param tenantId - The tenant the subject belongs to.
	 * @param subjectId - The subject the session belongs to.
	 * @param sessionId - The session to revoke.
	 * @param input - Why the session is being revoked.
	 */
	async revokeTenantSubjectSession(
		tenantId: string,
		subjectId: string,
		sessionId: string,
		input: { reason: string },
	): Promise<Result<void, ManagementError | ManagementProblem>> {
		return this.#call(
			"POST",
			tenantPath(tenantId, "subjects", subjectId, "sessions", sessionId, "revoke"),
			{ body: input },
		);
	}

	/**
	 * Revokes every live session a subject holds. Requires `sessions:write`.
	 *
	 * @param tenantId - The tenant the subject belongs to.
	 * @param subjectId - The subject whose sessions to revoke.
	 * @param input - Why the sessions are being revoked.
	 */
	async revokeAllTenantSubjectSessions(
		tenantId: string,
		subjectId: string,
		input: { reason?: string } = {},
	): Promise<Result<{ revoked: number }, ManagementError | ManagementProblem>> {
		return this.#call(
			"POST",
			tenantPath(tenantId, "subjects", subjectId, "sessions", "revoke-all"),
			{ body: input, schema: REVOKE_ALL_TENANT_SUBJECT_SESSIONS_RESULT_SCHEMA },
		);
	}

	/**
	 * Removes one of a subject's passkeys, refusing to take their last remaining
	 * credential. Requires `sessions:write`.
	 *
	 * @param tenantId - The tenant the subject belongs to.
	 * @param subjectId - The subject the passkey belongs to.
	 * @param credentialId - The passkey to revoke.
	 */
	async revokeTenantSubjectPasskey(
		tenantId: string,
		subjectId: string,
		credentialId: string,
	): Promise<Result<void, ManagementError | ManagementProblem>> {
		return this.#call(
			"DELETE",
			tenantPath(tenantId, "subjects", subjectId, "passkeys", credentialId),
		);
	}

	/**
	 * Marks a subject's current password as owing a change and revokes every session
	 * it holds, for a targeted response to a suspected compromise. Requires
	 * `sessions:write`.
	 *
	 * @param tenantId - The tenant the subject belongs to.
	 * @param subjectId - The subject to force a reset for.
	 * @param input - Why the reset is being forced.
	 */
	async forceTenantSubjectPasswordReset(
		tenantId: string,
		subjectId: string,
		input: { reason: string },
	): Promise<Result<{ passwordId: string; reason: string }, ManagementError | ManagementProblem>> {
		return this.#call(
			"POST",
			tenantPath(tenantId, "subjects", subjectId, "password", "force-reset"),
			{ body: input, schema: FORCE_TENANT_SUBJECT_PASSWORD_RESET_RESULT_SCHEMA },
		);
	}

	/**
	 * Removes a subject's second factor, every recovery code and every trusted
	 * device, revokes every session, and marks the subject as owing a fresh
	 * enrolment. Requires `sessions:write`.
	 *
	 * @param tenantId - The tenant the subject belongs to.
	 * @param subjectId - The subject being reset.
	 * @param input - Why the reset is being performed.
	 * @returns The address to notify of the reset, or `null` when the subject has none verified.
	 */
	async resetTenantSubjectSecondFactor(
		tenantId: string,
		subjectId: string,
		input: { reason: string },
	): Promise<Result<{ notifyAddress: string | null }, ManagementError | ManagementProblem>> {
		return this.#call(
			"POST",
			tenantPath(tenantId, "subjects", subjectId, "second-factor", "reset"),
			{ body: input, schema: RESET_TENANT_SUBJECT_SECOND_FACTOR_RESULT_SCHEMA },
		);
	}

	// -- Clients and secrets --------------------------------------------------------

	/**
	 * A page of the tenant's registered clients, most recently registered first.
	 * Requires `clients:write` — this resource's scope vocabulary carries no
	 * separate read scope, so listing shares the one scope the resource was given.
	 *
	 * @param tenantId - The tenant whose clients to list.
	 * @param options - Where to page from.
	 */
	async listTenantClients(
		tenantId: string,
		options: { cursor?: string | null; limit?: number } = {},
	): Promise<
		Result<
			ManagementClient.Page<ManagementClient.TenantClientSummary>,
			ManagementError | ManagementProblem
		>
	> {
		return this.#page(tenantPath(tenantId, "clients"), {
			query: { cursor: options.cursor, limit: options.limit },
			itemSchema: TENANT_CLIENT_SUMMARY_SCHEMA,
		});
	}

	/**
	 * Registers a client, minting its first secret when it is confidential. Requires
	 * `clients:write`.
	 *
	 * @param tenantId - The tenant to register the client in.
	 * @param input - The whole record to register.
	 * @returns The new record and the one-time plaintext secret (`null` for a public client).
	 */
	async registerTenantClient(
		tenantId: string,
		input: ManagementClient.RegisterTenantClientInput,
	): Promise<
		Result<
			{ client: ManagementClient.TenantClientRecord; secret: string | null },
			ManagementError | ManagementProblem
		>
	> {
		return this.#call("POST", tenantPath(tenantId, "clients"), {
			body: input,
			schema: REGISTER_TENANT_CLIENT_RESULT_SCHEMA,
		});
	}

	/**
	 * Replaces a client's editable fields as one set. Requires `clients:write`.
	 *
	 * @param tenantId - The tenant the client belongs to.
	 * @param clientId - The client to update.
	 * @param input - The whole new editable record.
	 */
	async updateTenantClient(
		tenantId: string,
		clientId: string,
		input: ManagementClient.UpdateTenantClientInput,
	): Promise<
		Result<{ client: ManagementClient.TenantClientRecord }, ManagementError | ManagementProblem>
	> {
		return this.#call("PUT", tenantPath(tenantId, "clients", clientId), {
			body: input,
			schema: UPDATE_TENANT_CLIENT_RESULT_SCHEMA,
		});
	}

	/**
	 * Mints a successor secret and opens the overlap window on the incumbent in one
	 * call. Requires `clients:write`.
	 *
	 * @param tenantId - The tenant the client belongs to.
	 * @param clientId - The client to rotate.
	 * @param input - How many days the incumbent keeps verifying once the successor is minted.
	 */
	async rotateTenantClientSecret(
		tenantId: string,
		clientId: string,
		input: { windowDays?: number } = {},
	): Promise<
		Result<
			{ secretId: string; secret: string; incumbentExpiresAt: number | null },
			ManagementError | ManagementProblem
		>
	> {
		return this.#call("POST", tenantPath(tenantId, "clients", clientId, "secrets", "rotate"), {
			body: input,
			schema: ROTATE_TENANT_CLIENT_SECRET_RESULT_SCHEMA,
		});
	}

	/**
	 * Closes one of a client's secrets immediately, refusing to take its last live
	 * one. Requires `clients:write`.
	 *
	 * @param tenantId - The tenant the client belongs to.
	 * @param clientId - The client the secret belongs to.
	 * @param secretId - The secret to revoke.
	 */
	async revokeTenantClientSecret(
		tenantId: string,
		clientId: string,
		secretId: string,
	): Promise<Result<void, ManagementError | ManagementProblem>> {
		return this.#call("DELETE", tenantPath(tenantId, "clients", clientId, "secrets", secretId));
	}

	/**
	 * Marks a client disabled. Requires `clients:write`.
	 *
	 * @param tenantId - The tenant the client belongs to.
	 * @param clientId - The client to disable.
	 */
	async disableTenantClient(
		tenantId: string,
		clientId: string,
	): Promise<Result<void, ManagementError | ManagementProblem>> {
		return this.#call("POST", tenantPath(tenantId, "clients", clientId, "disable"));
	}

	/**
	 * Deletes a client and its secrets. Requires `clients:write`.
	 *
	 * @param tenantId - The tenant the client belongs to.
	 * @param clientId - The client to delete.
	 */
	async deleteTenantClient(
		tenantId: string,
		clientId: string,
	): Promise<Result<void, ManagementError | ManagementProblem>> {
		return this.#call("DELETE", tenantPath(tenantId, "clients", clientId));
	}

	// -- Scopes, grants and roles -----------------------------------------------------

	/**
	 * A page of a subject's own grants, most recently agreed to first. A grant names
	 * a subject's standing decision about one client, so this reads under
	 * `subjects:read` — the scope vocabulary names none of its own for a grant,
	 * since a grant is a fact about the subject that holds it rather than a
	 * resource with a scope pair to itself.
	 *
	 * @param tenantId - The tenant the subject belongs to.
	 * @param subjectId - The subject whose grants to list.
	 * @param options - Where to page from.
	 */
	async listTenantGrants(
		tenantId: string,
		subjectId: string,
		options: { cursor?: string | null; limit?: number } = {},
	): Promise<
		Result<
			ManagementClient.Page<ManagementClient.TenantGrantSummary>,
			ManagementError | ManagementProblem
		>
	> {
		return this.#page(tenantPath(tenantId, "subjects", subjectId, "grants"), {
			query: { cursor: options.cursor, limit: options.limit },
			itemSchema: TENANT_GRANT_SUMMARY_SCHEMA,
		});
	}

	/**
	 * Ends a subject's standing decision for one client. Writes to the same resource
	 * a grant is read from, so this requires `subjects:write`.
	 *
	 * @param tenantId - The tenant the subject belongs to.
	 * @param subjectId - The subject whose grant to revoke.
	 * @param clientId - The client the grant was made to.
	 */
	async revokeTenantGrant(
		tenantId: string,
		subjectId: string,
		clientId: string,
	): Promise<Result<void, ManagementError | ManagementProblem>> {
		return this.#call("DELETE", tenantPath(tenantId, "subjects", subjectId, "grants", clientId));
	}

	// -- Audit events -----------------------------------------------------------------

	/**
	 * A page of this tenant's audit log over a time window, newest first, with
	 * optional filters. Requires `audit:read`.
	 *
	 * @param tenantId - The tenant whose audit log to read.
	 * @param options - The inclusive time window to read, optional filters, and
	 *   where to page from.
	 */
	async readTenantAuditPage(
		tenantId: string,
		options: ManagementClient.ReadTenantAuditPageOptions,
	): Promise<
		Result<
			ManagementClient.Page<ManagementClient.TenantAuditEvent>,
			ManagementError | ManagementProblem
		>
	> {
		return this.#page(tenantPath(tenantId, "audit-events"), {
			query: {
				from: options.from,
				to: options.to,
				action: options.action,
				actorId: options.actorId,
				targetId: options.targetId,
				cursor: options.cursor,
				limit: options.limit,
			},
			itemSchema: TENANT_AUDIT_EVENT_SCHEMA,
		});
	}

	// -- Tenants, members and domains --------------------------------------------------

	/**
	 * Reads a tenant's own public record. Requires `tenant:write` — this resource's
	 * scope vocabulary carries no separate read scope, so reading shares the one
	 * scope the resource was given.
	 *
	 * @param tenantId - The tenant to read.
	 */
	async fetchTenant(
		tenantId: string,
	): Promise<Result<ManagementClient.TenantRecord, ManagementError | ManagementProblem>> {
		return this.#call("GET", tenantPath(tenantId), { schema: TENANT_RECORD_SCHEMA });
	}

	/**
	 * Lists every membership of a tenant. Requires `members:write` — this resource's
	 * scope vocabulary carries no separate read scope, so listing shares the one
	 * scope the resource was given.
	 *
	 * @param tenantId - The tenant whose members to list.
	 */
	async listTenantMembers(
		tenantId: string,
	): Promise<Result<ManagementClient.TenantMember[], ManagementError | ManagementProblem>> {
		return this.#call("GET", tenantPath(tenantId, "members"), {
			schema: s.array(TENANT_MEMBER_SCHEMA),
		});
	}

	/**
	 * Grants a subject access to a tenant at a role — a direct grant rather than an
	 * email invitation, since no separate invitation mechanism exists today. Requires
	 * `members:write`.
	 *
	 * @param tenantId - The tenant to grant access to.
	 * @param input - The subject and the role the membership grants.
	 */
	async inviteTenantMember(
		tenantId: string,
		input: { subjectId: string; role: ManagementClient.TenantMemberRole },
	): Promise<Result<ManagementClient.TenantMember, ManagementError | ManagementProblem>> {
		return this.#call("POST", tenantPath(tenantId, "members"), {
			body: input,
			schema: TENANT_MEMBER_SCHEMA,
		});
	}

	/**
	 * Changes a membership's role. Requires `members:write`.
	 *
	 * @param tenantId - The tenant the membership belongs to.
	 * @param membershipId - The membership to change.
	 * @param input - The role to assign.
	 */
	async updateTenantMemberRole(
		tenantId: string,
		membershipId: string,
		input: { role: ManagementClient.TenantMemberRole },
	): Promise<Result<ManagementClient.TenantMember, ManagementError | ManagementProblem>> {
		return this.#call("PUT", tenantPath(tenantId, "members", membershipId), {
			body: input,
			schema: TENANT_MEMBER_SCHEMA,
		});
	}

	/**
	 * Revokes a subject's access to a tenant. Requires `members:write`.
	 *
	 * @param tenantId - The tenant the membership belongs to.
	 * @param membershipId - The membership to remove.
	 */
	async removeTenantMember(
		tenantId: string,
		membershipId: string,
	): Promise<Result<void, ManagementError | ManagementProblem>> {
		return this.#call("DELETE", tenantPath(tenantId, "members", membershipId));
	}

	/**
	 * Lists every domain of a tenant. Requires `tenant:write` — this resource's
	 * scope vocabulary carries no separate read scope, so listing shares the one
	 * scope the resource was given.
	 *
	 * @param tenantId - The tenant whose domains to list.
	 */
	async listTenantDomains(
		tenantId: string,
	): Promise<Result<ManagementClient.TenantDomain[], ManagementError | ManagementProblem>> {
		return this.#call("GET", tenantPath(tenantId, "domains"), {
			schema: s.array(TENANT_DOMAIN_SCHEMA),
		});
	}

	/**
	 * Registers a domain for a tenant: a platform domain starts active, a custom one
	 * starts pending until it verifies. Requires `tenant:write`.
	 *
	 * @param tenantId - The tenant to attach the domain to.
	 * @param input - The hostname and whether it is the platform default or customer-owned.
	 */
	async attachTenantDomain(
		tenantId: string,
		input: { hostname: string; kind: ManagementClient.TenantDomainKind },
	): Promise<Result<ManagementClient.TenantDomain, ManagementError | ManagementProblem>> {
		return this.#call("POST", tenantPath(tenantId, "domains"), {
			body: input,
			schema: TENANT_DOMAIN_SCHEMA,
		});
	}

	/**
	 * Reads a domain's verification and activation state. Requires `tenant:write`.
	 *
	 * @param tenantId - The tenant the domain belongs to.
	 * @param domainId - The domain to read.
	 */
	async fetchTenantDomainVerification(
		tenantId: string,
		domainId: string,
	): Promise<
		Result<ManagementClient.TenantDomainVerification, ManagementError | ManagementProblem>
	> {
		return this.#call("GET", tenantPath(tenantId, "domains", domainId, "verification"), {
			schema: TENANT_DOMAIN_VERIFICATION_SCHEMA,
		});
	}

	/**
	 * Sets the tenant's second-factor policy. Requires `tenant:write`.
	 *
	 * @param tenantId - The tenant to set the policy for.
	 * @param input - The policy to enforce.
	 */
	async updateTenantMfaPolicy(
		tenantId: string,
		input: { policy: "optional" | "required" },
	): Promise<Result<void, ManagementError | ManagementProblem>> {
		return this.#call("POST", tenantPath(tenantId, "mfa-policy"), { body: input });
	}
}

export namespace ManagementClient {
	/**
	 * A person's record as the management API publishes it, with both timestamps
	 * already widened into `Date` and `avatar` checked as an absolute URL.
	 */
	export interface Subject {
		id: string;
		createdAt: Date;
		updatedAt: Date;
		displayName: string;
		avatar: string;
		role: "user" | "admin";
		username: string;
		emailAddress: string;
	}

	/**
	 * What a {@link ManagementClient} needs of a service client: a bearer credential
	 * for the resource set a read is scoped to.
	 */
	export interface Service {
		/** The provider whose origin serves the management API by default. */
		readonly issuer: { readonly url: URL };

		/**
		 * Issues an access token the management API accepts.
		 *
		 * @param options - The resource indicators the token is scoped to.
		 */
		token(options?: { resources?: string[] }): Promise<string>;
	}

	/** How a {@link ManagementClient} is configured. */
	export interface Options {
		/**
		 * Where the management API is served, for a provider that serves it apart from
		 * the origin its OpenID Connect endpoints live on.
		 *
		 * @default the service client's issuer URL
		 */
		baseUrl?: string | URL;

		/**
		 * Resource indicators the access token is scoped to, for a provider that grants
		 * management access one resource at a time.
		 *
		 * @default []
		 */
		resources?: string[];

		/**
		 * The version of the tenant-scoped surface every call names in its
		 * `X-API-Version` header, as the date the provider published it. Left off, a
		 * request names none, which a provider that versions this way serves as its
		 * oldest supported version rather than refusing.
		 */
		apiVersion?: string;
	}

	/** One page of a keyset list, and the targets to continue paging with. */
	export interface Page<T> {
		items: T[];
		/** The target to follow for the next page, or `null` on the last one. */
		next: string | null;
		/** The target to follow for the previous page, or `null` on the first one. */
		prev: string | null;
	}

	// -- Subjects and identifiers ---------------------------------------------------

	/** Which kind of identifier a subject claims: an email address or a username. */
	export type TenantIdentifierKind = "email" | "username";

	/** One identifier as a tenant's own subject read would render it. */
	export interface TenantIdentifierState {
		kind: TenantIdentifierKind;
		value: string;
		verified: boolean;
		verifiedAt: number | null;
		isPrimary: boolean;
	}

	/** The standard OIDC profile claims a subject carries. */
	export interface TenantSubjectProfile {
		name?: string | null;
		givenName?: string | null;
		familyName?: string | null;
		nickname?: string | null;
		preferredUsername?: string | null;
		picture?: string | null;
		locale?: string | null;
		zoneinfo?: string | null;
	}

	/** A declared attribute's value, kept to a flat, wire-serializable shape. */
	export type TenantAttributeValue = string | number | boolean | null;

	/** A subject's TOTP factor; both fields `null` with none enrolled. */
	export interface TenantTotpFactor {
		label: string | null;
		lastUsedAt: number | null;
	}

	/** One remembered browser, carrying only what identifies it to the subject. */
	export interface TenantTrustedDevice {
		id: string;
		createdAt: number;
		expiresAt: number;
		ip: string | null;
		userAgent: string | null;
	}

	/** One tenant's subject, as {@link ManagementClient#fetchTenantSubjectById} answers it. */
	export interface TenantSubject {
		id: string;
		status: "active" | "blocked";
		name: string | null;
		givenName: string | null;
		familyName: string | null;
		nickname: string | null;
		preferredUsername: string | null;
		picture: string | null;
		locale: string | null;
		zoneinfo: string | null;
		identifiers: TenantIdentifierState[];
		attributes: Record<string, TenantAttributeValue>;
		totpFactor: TenantTotpFactor;
		recoveryCodesRemaining: number;
		trustedDevices: TenantTrustedDevice[];
	}

	/** What {@link ManagementClient#createTenantSubject} takes: the identifiers, profile and attributes to start a subject with. */
	export interface CreateTenantSubjectInput {
		identifiers?: { kind: TenantIdentifierKind; value: string }[];
		profile?: TenantSubjectProfile;
		attributes?: Record<string, unknown>;
	}

	/** What creating a subject answers: its new id, and every identifier's starting state. */
	export interface CreateTenantSubjectResult {
		subjectId: string;
		identifiers: TenantIdentifierState[];
	}

	/** What {@link ManagementClient#updateTenantSubject} takes: only the fields being changed. */
	export interface UpdateTenantSubjectInput {
		profile?: TenantSubjectProfile;
		attributes?: Record<string, unknown>;
	}

	/** What adding an identifier answers: a ticket to deliver for an email, nothing extra for a username. */
	export type AddTenantSubjectIdentifierResult =
		| {
				identifierId: string;
				kind: "email";
				value: string;
				ticket: string;
				ticketExpiresAt: number;
		  }
		| { identifierId: string; kind: "username"; value: string };

	/** What verifying an identifier answers: the subject it belongs to, and whether it became primary. */
	export interface VerifyTenantSubjectIdentifierResult {
		subjectId: string;
		promotedPrimary: boolean;
	}

	/** What removing an identifier answers: the address promoted to primary (or none), and who to notify. */
	export interface RemoveTenantSubjectIdentifierResult {
		promotedPrimary: string | null;
		notify: string[];
	}

	// -- Credentials and sessions ----------------------------------------------------

	/** One live session as {@link ManagementClient#listTenantSubjectSessions} renders it. */
	export interface TenantSessionSummary {
		id: string;
		createdAt: number;
		lastSeenAt: number;
		amr: string[];
		ip: string | null;
		userAgent: string | null;
		country: string | null;
		region: string | null;
		city: string | null;
	}

	// -- Clients and secrets ----------------------------------------------------------

	/** Whether a client holds a secret at all: a confidential one does, a public one never. */
	export type TenantClientKind = "confidential" | "public";

	/** How a client proves itself at the token endpoint. */
	export type TenantTokenEndpointAuthMethod = "client_secret_basic" | "client_secret_post" | "none";

	/** A client's whole editable record, as {@link ManagementClient#registerTenantClient} and {@link ManagementClient#updateTenantClient} answer it. */
	export interface TenantClientRecord {
		id: string;
		name: string;
		kind: TenantClientKind;
		redirectUris: string[];
		postLogoutRedirectUris: string[];
		grantTypes: string[];
		responseTypes: string[];
		scopes: string[];
		tokenEndpointAuthMethod: TenantTokenEndpointAuthMethod;
		requireConsent: boolean;
		createdAt: number;
		updatedAt: number;
		disabledAt: number | null;
	}

	/** One client as {@link ManagementClient#listTenantClients} renders it. */
	export interface TenantClientSummary {
		id: string;
		name: string;
		kind: TenantClientKind;
		tokenEndpointAuthMethod: TenantTokenEndpointAuthMethod;
		createdAt: number;
		disabledAt: number | null;
	}

	/** The whole record {@link ManagementClient#registerTenantClient} takes. */
	export interface RegisterTenantClientInput {
		name: string;
		kind: TenantClientKind;
		redirectUris: string[];
		postLogoutRedirectUris: string[];
		grantTypes: string[];
		responseTypes: string[];
		scopes: string[];
		tokenEndpointAuthMethod: TenantTokenEndpointAuthMethod;
		requireConsent: boolean;
	}

	/** The whole record {@link ManagementClient#updateTenantClient} takes. */
	export type UpdateTenantClientInput = RegisterTenantClientInput;

	// -- Scopes, grants and roles ------------------------------------------------------

	/** One grant as {@link ManagementClient#listTenantGrants} renders it. */
	export interface TenantGrantSummary {
		clientId: string;
		clientName: string;
		scopes: string[];
		createdAt: number;
	}

	// -- Audit events -------------------------------------------------------------------

	/** Who acted, or what was acted on: which kind of principal or record. */
	export type TenantAuditActorType = "subject" | "member" | "client" | "platform";

	/** How the operation an audit row describes turned out. */
	export type TenantAuditOutcome = "succeeded" | "failed" | "denied";

	/** One row of a tenant's audit log, as {@link ManagementClient#readTenantAuditPage} renders it. */
	export interface TenantAuditEvent {
		id: string;
		at: number;
		action: string;
		actorType: TenantAuditActorType;
		actorId: string;
		targetType: string;
		targetId: string;
		outcome: TenantAuditOutcome;
		context: Record<string, unknown>;
		detail: Record<string, unknown>;
	}

	/** What {@link ManagementClient#readTenantAuditPage} takes: the window to read and its optional filters. */
	export interface ReadTenantAuditPageOptions {
		from: number;
		to: number;
		action?: string;
		actorId?: string;
		targetId?: string;
		cursor?: string | null;
		limit?: number;
	}

	// -- Tenants, members and domains ----------------------------------------------------

	/** A tenant's own public record, as {@link ManagementClient#fetchTenant} answers it. */
	export interface TenantRecord {
		id: string;
		name: string;
		slug: string;
		issuer: string;
		region: "wnam" | "enam" | "sam" | "weur" | "eeur" | "apac" | "oc" | "afr" | "me";
		status: "active" | "suspended" | "deleted";
		planSlug: string;
		subscriptionStatus: string;
		currentPeriodEnd: number | null;
		cancelAtPeriodEnd: boolean;
		graceUntil: number | null;
		lapsedAt: number | null;
		createdAt: number;
		updatedAt: number;
	}

	/** A tenant membership's role. */
	export type TenantMemberRole = "owner" | "admin" | "member";

	/** One membership as {@link ManagementClient#listTenantMembers} renders it. */
	export interface TenantMember {
		id: string;
		tenantId: string;
		subjectId: string;
		role: TenantMemberRole;
		createdAt: number;
		updatedAt: number;
	}

	/** Whether a domain is the platform-issued default or a customer's own DNS. */
	export type TenantDomainKind = "platform" | "custom";

	/** A domain's DNS-verification/activation state. */
	export type TenantDomainStatus = "pending" | "active" | "failed";

	/** One domain as {@link ManagementClient#listTenantDomains} renders it. */
	export interface TenantDomain {
		id: string;
		tenantId: string;
		hostname: string;
		kind: TenantDomainKind;
		status: TenantDomainStatus;
		certificateStatus: string | null;
		verificationName: string | null;
		verificationValue: string | null;
		createdAt: number;
		updatedAt: number;
	}

	/** A domain's verification and activation state, as {@link ManagementClient#fetchTenantDomainVerification} answers it. */
	export interface TenantDomainVerification {
		status: TenantDomainStatus;
		certificateStatus: string | null;
		verificationName: string | null;
		verificationValue: string | null;
	}
}

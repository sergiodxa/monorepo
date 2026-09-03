/**
 * The client for the provider's own records, reading a subject over the management
 * API with a token its service client issues. Every read answers with a `Result`,
 * keeping a record that is absent apart from a provider that could not answer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";
import * as s from "remix/data-schema";
import { url } from "remix/data-schema/checks";

import { nonJsonMediaType } from "./content-type";

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
	}
}

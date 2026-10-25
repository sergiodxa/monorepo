/**
 * The two ways a JMAP exchange fails: the whole request (transport, an HTTP error with
 * its problem details, a body other than the JMAP document expected), or one method call in a request
 * the server processed. Both are returned inside a `Failure`, never thrown.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Problem } from "@sdxc/problem";

import type { MethodErrorType } from "./types.js";

/** The URN prefix of every problem type and error code in the JMAP registries. */
export const JMAP_ERROR_PREFIX = "urn:ietf:params:jmap:error:";

/**
 * Why a request produced no JMAP answer. `problem` is an HTTP error answered with problem
 * details and `http` one answered with any other body; `network` is the transport failing,
 * and `invalid-response` a success whose body fails the expected JMAP document's shape.
 */
export type JMAPRequestErrorCode = "problem" | "http" | "network" | "invalid-response";

/** The request-level problem types RFC 8620 defines, without their URN prefix. */
export type JMAPProblemType = "unknownCapability" | "notJSON" | "notRequest" | "limit";

/** What a request error carries beyond its code. */
export interface JMAPRequestErrorDetails {
	status?: number | null;
	problem?: Problem | null;
	cause?: unknown;
}

/** A session, API, upload, download or event-source request that failed as a whole. */
export class JMAPRequestError extends Error {
	override name = "JMAPRequestError";

	readonly code: JMAPRequestErrorCode;

	/** The HTTP status, for `problem` and `http`. */
	readonly status: number | null;

	/** The RFC 9457 problem details the server answered with, for `problem`. */
	readonly problem: Problem | null;

	/**
	 * @param code - Why the request failed.
	 * @param message - A description for logs.
	 * @param details - The status, problem and underlying cause.
	 */
	constructor(code: JMAPRequestErrorCode, message: string, details: JMAPRequestErrorDetails = {}) {
		super(message, { cause: details.cause });
		this.code = code;
		this.status = details.status ?? null;
		this.problem = details.problem ?? null;
	}

	/**
	 * The JMAP problem type without its URN prefix (`"limit"`, `"unknownCapability"`…), so a
	 * caller branches on a short name; `null` for a problem type outside JMAP's registry.
	 */
	get type(): JMAPProblemType | (string & {}) | null {
		let type = this.problem?.type;
		if (type === undefined || !type.startsWith(JMAP_ERROR_PREFIX)) return null;
		return type.slice(JMAP_ERROR_PREFIX.length);
	}

	/** The request limit a `limit` problem names, such as `"maxSizeRequest"`. */
	get limit(): string | null {
		let limit = this.problem?.extensions.limit;
		return typeof limit === "string" ? limit : null;
	}
}

/**
 * One method call's `error` response. The server left its state as it was for this call,
 * except on `serverPartialFail`, and ran the request's other calls as usual.
 */
export class JMAPMethodError extends Error {
	override name = "JMAPMethodError";

	/** An unlisted type is one the client should treat as `serverFail`. */
	readonly type: MethodErrorType | (string & {});

	/** The server's explanation; RFC 8620 marks it for debugging, not for display. */
	readonly description: string | null;

	/** The client's id of the call that failed. */
	readonly callId: string;

	/** Every argument of the error response, for the members a type adds. */
	readonly arguments: Record<string, unknown>;

	/**
	 * @param callId - The failed call's id.
	 * @param errorArguments - The `error` response's arguments; `type` defaults to `serverFail`.
	 */
	constructor(callId: string, errorArguments: Record<string, unknown>) {
		let type = typeof errorArguments.type === "string" ? errorArguments.type : "serverFail";
		let description =
			typeof errorArguments.description === "string" ? errorArguments.description : null;
		super(description ?? `The method call "${callId}" failed with ${type}.`);
		this.type = type;
		this.description = description;
		this.callId = callId;
		this.arguments = errorArguments;
	}

	/** The type as its registered URN, the form a problem type would name it in. */
	get uri(): string {
		return `${JMAP_ERROR_PREFIX}${this.type}`;
	}

	/** Whether the same call may succeed later; only `serverUnavailable` says so. */
	get retryable(): boolean {
		return this.type === "serverUnavailable";
	}
}

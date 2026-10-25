/**
 * The answer to a batch: every method response in order, read back per call with the
 * response type the `Methods` registry declares, and each call's `error` response as
 * a `JMAPMethodError`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";
import * as s from "remix/data-schema";

import type { Call } from "./batch.js";
import type { MethodName, ResponseOf } from "./methods.js";
import type { Id, Invocation } from "./types.js";

import { JMAPMethodError } from "./error.js";

/** The structural check a Response object passes before its responses are read. */
export const RESPONSE_SCHEMA = s.object(
	{
		methodResponses: s.array(s.tuple([s.string(), s.record(s.string(), s.any()), s.string()])),
		sessionState: s.string(),
		createdIds: s.optional(s.record(s.string(), s.string())),
	},
	{ unknownKeys: "passthrough" },
);

/** The Response object an API request answers with. */
export interface JMAPResponseObject {
	methodResponses: Invocation[];
	sessionState: string;
	createdIds?: Record<Id, Id>;
}

/** A batch's answer. */
export class BatchResponse {
	readonly methodResponses: readonly Invocation[];

	/** The session's current `state`; a value other than the session's means it changed. */
	readonly sessionState: string;

	/** Creation ids mapped to server ids, present when the batch passed `createdIds`. */
	readonly createdIds: Record<Id, Id> | null;

	/** @param response - The Response object. */
	constructor(response: JMAPResponseObject) {
		this.methodResponses = response.methodResponses;
		this.sessionState = response.sessionState;
		this.createdIds = response.createdIds ?? null;
	}

	/**
	 * The response to `call`, named after its method, or the response named `name` when one
	 * call answers with several (an `Email/copy` that moves adds an `Email/set`).
	 *
	 * @param call - A call from the batch that produced this response.
	 * @returns The response's arguments, or the call's error; a call the server left
	 *   unanswered reads as `serverFail`.
	 */
	get<Name extends MethodName>(call: Call<Name>): Result<ResponseOf<Name>, JMAPMethodError>;
	get<Name extends MethodName>(call: Call, name: Name): Result<ResponseOf<Name>, JMAPMethodError>;
	get(call: Call, name: string = call.name): Result<unknown, JMAPMethodError> {
		let responses = this.responses(call);
		let named = responses.find(([responseName]) => responseName === name);
		if (named !== undefined) return success(named[1]);
		let error = responses.find(([responseName]) => responseName === "error");
		if (error !== undefined) return failure(new JMAPMethodError(call.id, error[1]));
		return failure(
			new JMAPMethodError(call.id, {
				type: "serverFail",
				description: `The response has no "${name}" for the call "${call.id}".`,
			}),
		);
	}

	/**
	 * Every response `call` produced, in order.
	 *
	 * @param call - A call from the batch that produced this response.
	 */
	responses(call: Call): Invocation[] {
		return this.methodResponses.filter(([, , callId]) => callId === call.id);
	}
}

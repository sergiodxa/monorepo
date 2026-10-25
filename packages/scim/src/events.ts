/**
 * RFC 9967 SCIM events: the event URIs, a builder per event payload, the Security Event
 * Token that carries them signed through `@sdxc/jwt`, and the `202 Accepted` answer to an
 * asynchronous request, so a service provider can tell receivers what changed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ScimError } from "./lib/error.js";

/** Types for SCIM events and the tokens that carry them. */
export namespace Events {
	/**
	 * RFC 9967 §2.1's `sub_id`: the resource's path relative to the SCIM base URL, with any
	 * identifier both sides share, such as `externalId` or a `userName`.
	 */
	export interface Subject {
		/** Such as `/Users/2819c223`; a receiver may `GET` it under the agreed base URL. */
		uri: string;
		externalId?: string;
		id?: string;
		[attribute: string]: unknown;
	}

	/** The `sub_id` claim as a token carries it, in the `scim` format. */
	export interface SubjectId extends Subject {
		format: "scim";
	}

	/** One member of a token's `events` claim: the event URI and its payload. */
	export interface Event {
		uri: string;
		payload: Record<string, unknown>;
	}

	/**
	 * A provisioning payload: the resulting resource as `data` makes a `full` event, the
	 * changed attribute paths as `attributes` a `notice` one; exactly one is present.
	 */
	export type Change =
		| { data: object; attributes?: never; version?: string }
		| { attributes: string[]; data?: never; version?: string };

	/** The bulk response operation (RFC 7644 §3.7.3) an asynchronous request completed as. */
	export interface Completion {
		method: "POST" | "PUT" | "PATCH" | "DELETE";
		/** The HTTP status the request would have answered with. */
		status: number;
		version?: string;
		location?: string;
		bulkId?: string;
		/** The error document of a failed request, given as the error itself. */
		error?: ScimError;
	}

	/** What `createScimEvent` builds a token from. */
	export interface TokenInput {
		issuer: string;
		/** The receivers, such as each event feed's URI. */
		audience: string | string[];
		subject: Subject;
		/** One or more events arising from the same state change of the same subject. */
		events: [Event, ...Event[]];
		/**
		 * The originating transaction, shared by every token one change produces; required
		 * for asynchronous responses, where it is the `Set-Txn` the client was given.
		 */
		transaction?: string;
		/** The token's `jti`; a fresh random identifier when omitted. */
		id?: string;
		/** @default new Date() */
		issuedAt?: Date;
	}
}

export { acceptedResponse, prefersAsync, SET_TXN_HEADER } from "./lib/events/async.js";
export { EVENT_URIS, scimEvents } from "./lib/events/builders.js";
export { createScimEvent, ScimEventToken } from "./lib/events/token.js";

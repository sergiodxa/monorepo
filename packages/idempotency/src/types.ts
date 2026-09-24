/**
 * The contract between the middleware and wherever records live: what a claim asks, what
 * it can answer, and the stored outcome a replay is rebuilt from. Keeping it apart from any
 * database lets an app back it with D1, a Durable Object, or an RPC to either.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import type { IdempotencyStoreError } from "./errors.js";

/**
 * A completed outcome, holding enough to rebuild a byte-identical `Response`. It is plain
 * JSON, so a store can persist it as text and an RPC can pass it by value.
 */
export interface StoredResponse {
	status: number;
	/** Header pairs in order, lowercased; `Set-Cookie` is left out so a replay never hands out a session. */
	headers: [string, string][];
	/** The body bytes as standard base64, empty for a response without a body. */
	body: string;
}

/** What the middleware asks a store for when a keyed request arrives. */
export interface ClaimRequest {
	/** SHA-256 of prefix, scope, method, path and key; the key alone never identifies a record. */
	id: string;
	/** The request's fingerprint, or `null` when the middleware compares keys alone. */
	fingerprint: string | null;
	/** Epoch milliseconds every expiry in this claim is judged against. */
	now: number;
	/** How long a new in-flight claim holds before a retry may take it over as abandoned. */
	leaseMs: number;
	/** Epoch milliseconds after which the record no longer counts at all. */
	expiresAt: number;
}

/**
 * A claim's answer. `claimed` hands out the lease that `complete` and `release` must
 * present; the other two describe the live record another request owns.
 */
export type ClaimOutcome =
	| { status: "claimed"; lease: string }
	| { status: "in-flight"; fingerprint: string | null }
	| { status: "completed"; fingerprint: string | null; response: StoredResponse };

/**
 * Records one outcome per id. `claim` is atomic: of concurrent claims on an id, exactly one
 * answers `claimed`. A record is claimable again once it expires, or while it is in flight
 * past its lease. `complete` and `release` act only while `lease` still holds.
 */
export interface IdempotencyStore {
	/**
	 * Claims the id for this request, or reports the live record that stops it.
	 *
	 * @param request - The id, fingerprint and instants to judge the record by
	 */
	claim(request: ClaimRequest): Promise<Result<ClaimOutcome, IdempotencyStoreError>>;

	/**
	 * Stores the outcome under a held lease; a lease that was taken over changes nothing,
	 * so a resumed stale invocation cannot overwrite a newer outcome.
	 *
	 * @param id - The record id
	 * @param lease - The lease `claim` handed out
	 * @param response - The outcome to replay
	 * @param expiresAt - Epoch milliseconds until which the outcome is replayed
	 */
	complete(
		id: string,
		lease: string,
		response: StoredResponse,
		expiresAt: number,
	): Promise<Result<void, IdempotencyStoreError>>;

	/**
	 * Drops an in-flight claim under a held lease so a retry runs the handler again. A
	 * completed record, or a lease that was taken over, is left as it is.
	 *
	 * @param id - The record id
	 * @param lease - The lease `claim` handed out
	 */
	release(id: string, lease: string): Promise<Result<void, IdempotencyStoreError>>;
}

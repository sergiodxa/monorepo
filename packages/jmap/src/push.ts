/**
 * JMAP push: the StateChange a server pushes when data changes, the PushVerification a
 * new PushSubscription receives first, and readers for both, from a push service's POST
 * body or from the server's `text/event-stream`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { ValidationError } from "@sdxc/validate";

import { isSuccess } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";

import type { Id, UTCDate } from "./types.js";

import { readEventStream } from "./event-stream.js";

/** Each changed data type's new `state`, keyed by type name (`"Email"`, `"Mailbox"`…). */
export interface TypeState {
	[type: string]: string;
}

/**
 * What changed since the previous push: for each account, the new state of every changed
 * type. A state that differs from the client's is the cue to call that type's `/changes`.
 */
export interface StateChange {
	"@type": "StateChange";
	changed: Record<Id, TypeState>;
}

/** The first push a new PushSubscription receives; the client sets `verificationCode` on the subscription. */
export interface PushVerification {
	"@type": "PushVerification";
	pushSubscriptionId: string;
	verificationCode: string;
}

/** RFC 8291 keys a push service encrypts with, URL-safe base64. */
export interface PushKeys {
	p256dh: string;
	auth: string;
}

/**
 * A URL the server POSTs StateChanges to. `url` and `keys` are write-only, so `/get` omits
 * them, and until it is verified the server sends it only the verification.
 */
export interface PushSubscription {
	id: Id;
	/** Stable per client and device, so a client can find its own subscriptions after losing state. */
	deviceClientId: string;
	url: string;
	keys: PushKeys | null;
	verificationCode: string | null;
	expires: UTCDate | null;
	/** The type names to push; `null` pushes every type. */
	types: string[] | null;
}

/** An event the event-source stream delivered: a StateChange with its event id, or a keep-alive ping. */
export type PushEvent =
	| { type: "state"; id: string | null; change: StateChange }
	| { type: "ping"; interval: number };

/** The structural check every pushed StateChange passes. */
const STATE_CHANGE_SCHEMA = s.object({
	"@type": s.literal("StateChange"),
	changed: s.record(s.string(), s.record(s.string(), s.string())),
});

/** The structural check a PushVerification passes. */
const PUSH_VERIFICATION_SCHEMA = s.object({
	"@type": s.literal("PushVerification"),
	pushSubscriptionId: s.string(),
	verificationCode: s.string(),
});

/** Either object a push service delivers, told apart by `@type`. */
const PUSH_SCHEMA = s.variant("@type", {
	StateChange: STATE_CHANGE_SCHEMA,
	PushVerification: PUSH_VERIFICATION_SCHEMA,
});

/** A ping event's data. */
const PING_SCHEMA = s.object({ interval: s.number() });

/**
 * Reads a JSON body a push service delivered: the subscription's PushVerification, then
 * StateChanges. A decrypted RFC 8291 payload is read the same way.
 *
 * @param body - The parsed JSON body.
 * @returns The push object, or why it is neither type.
 * @example let push = await parsePush(await request.json());
 */
export async function parsePush(
	body: unknown,
): Promise<Result<StateChange | PushVerification, ValidationError>> {
	return await validate(body as Record<string, unknown>, PUSH_SCHEMA);
}

/**
 * Reads a JMAP event-source stream into `state` and `ping` events. An event of another name,
 * or with unparseable data, is skipped, since the next StateChange carries the full state.
 *
 * @param stream - The `text/event-stream` body.
 * @yields Each StateChange with the event id that followed it, and each ping's interval.
 */
export async function* readPushEvents(
	stream: ReadableStream<Uint8Array>,
): AsyncGenerator<PushEvent, void, undefined> {
	for await (let event of readEventStream(stream)) {
		let json = parseJson(event.data);
		if (event.event === "state") {
			let change = await validate(json, STATE_CHANGE_SCHEMA);
			if (isSuccess(change)) yield { type: "state", id: event.id, change: change.data };
		} else if (event.event === "ping") {
			let ping = await validate(json, PING_SCHEMA);
			if (isSuccess(ping)) yield { type: "ping", interval: ping.data.interval };
		}
	}
}

/**
 * `text` as JSON, or an empty object for text that fails to parse, which the schema check rejects.
 *
 * @param text - An event's data.
 */
function parseJson(text: string): Record<string, unknown> {
	try {
		return JSON.parse(text) as Record<string, unknown>;
	} catch {
		return {};
	}
}

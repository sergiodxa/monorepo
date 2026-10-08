/**
 * The one queue message shape federation work travels in: a verified inbox activity, a
 * fan-out of a published activity, or one delivery to one inbox, told apart by `kind` so
 * an app declares a single job and hands every message back to `Federation#process`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Schema } from "remix/data-schema";

import * as s from "remix/data-schema";
import { url } from "remix/data-schema/checks";

import type { FanOutInput } from "./delivery-fan-out.js";
import type { DeliveryInput } from "./delivery-post.js";
import type { Received } from "./inbox-receive.js";

import { isObject } from "./compact.js";
import { VERIFICATIONS } from "./inbox-receive.js";

/** A verified activity the inbox accepted, processed by the app's handlers. */
export interface InboxMessage extends Received {
	kind: "inbox";
}

/** A published activity, turned into one delivery per distinct inbox. */
export interface FanOutMessage extends FanOutInput {
	kind: "fanOut";
}

/**
 * One activity to one inbox. The activity travels whole, so every inbox receives the same
 * bytes even after the post it describes changes.
 */
export interface DeliverMessage extends DeliveryInput {
	kind: "deliver";
}

/** Every message federation enqueues; each fits a 128 KB queue message. */
export type Message = InboxMessage | FanOutMessage | DeliverMessage;

/** A decoded JSON object, as an inbox message's `activity` carries one. */
const JSON_OBJECT: Schema<unknown, Record<string, unknown>> = s.createSchema<
	unknown,
	Record<string, unknown>
>((value, context) =>
	isObject(value) ? { value } : s.fail("The activity must be a JSON object.", context.path),
);

/**
 * The Standard Schema of every message, so a job declared with it validates what the queue
 * hands back before `process` reads it.
 *
 * @example federation: job({ input: Federation.MESSAGE })
 */
export const MESSAGE: Schema<unknown, Message> = s.variant("kind", {
	inbox: s.object({
		kind: s.literal("inbox"),
		activity: JSON_OBJECT,
		actor: s.string(),
		signer: s.string(),
		keyId: s.string(),
		origin: s.string(),
		verification: s.enum_(VERIFICATIONS),
		receivedAt: s.string(),
	}),
	fanOut: s.object({
		kind: s.literal("fanOut"),
		actor: s.string().pipe(url()),
		activity: s.string(),
	}),
	deliver: s.object({
		kind: s.literal("deliver"),
		actor: s.string().pipe(url()),
		activity: s.string(),
		inbox: s.string().pipe(url()),
	}),
});

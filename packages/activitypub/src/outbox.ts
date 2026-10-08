/**
 * Delivery as two queued jobs the app declares from these input schemas: `fanOut` turns
 * one activity into a delivery per distinct inbox, and `deliver` signs and POSTs one of
 * them, with `DELIVERY_BACKOFF` spacing the retries a failing server earns.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Schema } from "remix/data-schema";

import { createBackoff } from "@sdxc/backoff";
import { object, string } from "remix/data-schema";
import { url } from "remix/data-schema/checks";

import type { FanOutInput } from "./lib/delivery-fan-out.js";
import type { DeliveryInput } from "./lib/delivery-post.js";

export type {
	FanOutErrorCode,
	FanOutInput,
	FanOutOptions,
	FanOutResult,
} from "./lib/delivery-fan-out.js";
export type {
	DeliverOptions,
	Delivered,
	DeliveryErrorCode,
	DeliveryInput,
} from "./lib/delivery-post.js";

export { INBOX_INPUT } from "./inbox.js";
export { fanOut, MAX_ACTIVITY_BYTES } from "./lib/delivery-fan-out.js";
export { deliver, DeliveryError, parseRetryAfter } from "./lib/delivery-post.js";

/**
 * The input of the fan-out job, as Standard Schema so `job({ input })` validates every
 * message: the sending local actor's id and the activity as JSON text.
 */
export const FAN_OUT_INPUT: Schema<unknown, FanOutInput> = object({
	actor: string().pipe(url()),
	activity: string(),
});

/**
 * The input of the delivery job: the signing actor, the activity as JSON text and the
 * inbox. The activity travels whole, so every inbox receives the same bytes even after
 * the post it describes changes.
 */
export const DELIVERY_INPUT: Schema<unknown, DeliveryInput> = object({
	actor: string().pipe(url()),
	activity: string(),
	inbox: string().pipe(url()),
});

/**
 * Waits after each failed delivery, about 21 hours over five retries, so a server down
 * for a day still receives the activity. A delivery that names `retryAfter` waits at
 * least that long.
 *
 * @example let delay = Math.max(sent.error.retryAfter ?? 0, DELIVERY_BACKOFF.delay(ctx.attempts));
 */
export const DELIVERY_BACKOFF = createBackoff({
	steps: ["5 minutes", "30 minutes", "2 hours", "6 hours", "12 hours"],
	jitter: 0.2,
});

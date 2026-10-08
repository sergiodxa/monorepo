/**
 * Vendor-neutral newsletter lists: the models an app programs against, the
 * provider contract every platform is reached through, one failure type and the
 * webhook endpoint. Providers live behind their own subpaths.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { Newsletter, SubscriberApi, WebhookApi } from "./contract.js";
export type { NewsletterErrorCode, NewsletterErrorOptions } from "./errors.js";
export type {
	ListSubscribersQuery,
	NewsletterEvent,
	NewsletterEventPayload,
	Page,
	SubscribeInput,
	SubscribeOutcome,
	Subscriber,
	SubscriberAttribution,
	SubscriberRef,
	SubscriberStatus,
	UpdateSubscriberInput,
} from "./types.js";
export type {
	NewsletterEventOf,
	NewsletterEventType,
	NewsletterWebhookHandler,
	NewsletterWebhookHandlers,
	NewsletterWebhookOptions,
} from "./webhook.js";

export { NewsletterError } from "./errors.js";
export { DEFAULT_PAGE_SIZE } from "./types.js";
export { NewsletterWebhook } from "./webhook.js";

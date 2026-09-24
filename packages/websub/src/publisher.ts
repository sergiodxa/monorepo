/**
 * The publisher half of WebSub: the `Link` header that advertises a topic's hubs, and the ping
 * that tells a hub a topic changed so it fetches and redistributes it. WebSub leaves the ping
 * unspecified, so it follows the `hub.mode=publish` form public hubs accept.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import { absoluteUrl, formRequest, send } from "./lib/send.js";

import { WebSubRequestError } from "./index.js";

/** Characters that would end or split a `Link` target, encoded where a URL carries them. */
const UNSAFE_IN_TARGET = /[<>"\s]/g;

/** Types for the publisher operations. */
export namespace Publisher {
	/** What a `Link` header advertises. */
	export interface LinksOptions {
		/** The hubs subscribers may subscribe through, in order of preference. */
		hubs: readonly string[];
		/** The topic URL subscribers key their subscription by. */
		self: string;
	}

	/** How a ping is sent. */
	export interface PublishOptions {
		/** @default 10_000 */
		timeoutMs?: number;
	}
}

/**
 * The `Link` header value that advertises the hubs and the topic, for example
 * `<https://hub>; rel="hub", <https://site/rss>; rel="self"`. A subscriber reads this header
 * before the document, so it reaches a publisher who cannot edit the feed itself.
 *
 * @param options - The hubs and the topic.
 * @example new Response(feed, { headers: { link: links({ hubs: [hub], self: feedUrl }) } });
 */
export function links(options: Publisher.LinksOptions): string {
	let entries = options.hubs.map((hub) => `<${target(hub)}>; rel="hub"`);
	entries.push(`<${target(options.self)}>; rel="self"`);
	return entries.join(", ");
}

/**
 * Builds the `hub.mode=publish` form without sending it: one `hub.url` field per topic, so one
 * ping covers every feed a change touched.
 *
 * @param hub - The hub to notify.
 * @param topics - The topic, or topics, that changed.
 * @returns The request, or a refusal for a hub that is not an absolute URL or an empty topic list.
 */
export function publishRequest(
	hub: string,
	topics: string | readonly string[],
): Result<Request, WebSubRequestError> {
	let url = absoluteUrl(hub, "hub");
	if (isFailure(url)) return url;

	let list = typeof topics === "string" ? [topics] : topics;
	if (list.length === 0) return failure(new WebSubRequestError("A ping names no topic"));

	let fields: [string, string][] = [["hub.mode", "publish"]];
	for (let topic of list) fields.push(["hub.url", topic]);

	return success(formRequest(url.data, fields));
}

/**
 * Tells a hub one or more topics changed. Success is any `2xx`; a hub fetches the topics the
 * moment it is pinged, so a publisher pings after its cached copies are purged.
 *
 * @param hub - The hub to notify.
 * @param topics - The topic, or topics, that changed.
 * @param options - How long the hub has to answer.
 * @returns Nothing when the hub accepted the ping, or why it did not.
 * @example let pinged = await publish(hubUrl, [feedUrl]);
 */
export async function publish(
	hub: string,
	topics: string | readonly string[],
	options: Publisher.PublishOptions = {},
): Promise<Result<void, WebSubRequestError>> {
	let request = publishRequest(hub, topics);
	if (isFailure(request)) return request;
	return send(request.data, (status) => status >= 200 && status < 300, options.timeoutMs);
}

/** A URL as a `Link` target, with the characters that would end the target encoded. */
function target(url: string): string {
	return url.replace(UNSAFE_IN_TARGET, (character) => encodeURIComponent(character));
}

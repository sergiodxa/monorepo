/**
 * The sending half of Webmention: which pages a post's content links to, which of them
 * a create, update or delete must notify, and the bounded discover-and-POST that
 * notifies one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { release } from "@sdxc/distill/retrieve";
import { parseDocument } from "@sdxc/html/document";
import { failure, isFailure, success } from "@sdxc/result";

import type { Discover } from "./discover.js";

import { discover } from "./discover.js";
import { TIMEOUT_MS } from "./lib/fetch.js";
import { baseOf, resolve } from "./lib/urls.js";

import type { Webmention } from "./index.js";

import { WebmentionFetchError, WebmentionSendError } from "./index.js";

/** Groups the sender's types under a single import surface. */
export namespace Sender {
	/** What discovering and sending may spend, and the name both ask under. */
	export interface Options extends Discover.Options {}

	/** What sending one mention came to. */
	export type Delivery =
		| {
				status: "sent";
				endpoint: URL;
				/** Any 2xx: `202` queued, `201` created with a status page in `location`, `200` done. */
				code: number;
				/** The status page the endpoint named, absolute, when it named one. */
				location: string | null;
		  }
		| { status: "no-endpoint" };

	/** Which targets a change to a post notifies. */
	export interface Plan {
		/** Every target to notify now: current links plus those notified before and since removed. */
		targets: URL[];
	}
}

/**
 * Discovers the target's endpoint and POSTs the pair to it. The POST follows no
 * redirect, carries no credentials, and runs under the same deadline as a fetch.
 *
 * @param pair - The page doing the mentioning and the page it mentions
 * @param options - The user agent to ask under, and the bounds
 * @returns The delivery, a fetch error (discovery, or a POST that never got an answer), or the endpoint's refusal
 */
export async function send(
	pair: Webmention.Pair,
	options: Sender.Options,
): Promise<Result<Sender.Delivery, WebmentionFetchError | WebmentionSendError>> {
	let discovered = await discover(pair.target, options);
	if (isFailure(discovered)) return discovered;

	let endpoint = discovered.data;
	if (endpoint === null) return success({ status: "no-endpoint" });

	let response: Response;
	try {
		response = await fetch(endpoint, {
			method: "POST",
			body: new URLSearchParams({ source: pair.source.href, target: pair.target.href }),
			headers: { "user-agent": options.userAgent },
			redirect: "manual",
			credentials: "omit",
			signal: AbortSignal.timeout(options.timeoutMs ?? TIMEOUT_MS),
		});
	} catch (error) {
		let reason = error instanceof Error ? error.message : String(error);
		return failure(new WebmentionFetchError(`Failed to send to ${endpoint.href}: ${reason}`, true));
	}

	release(response.body);

	if (response.status < 200 || response.status > 299) {
		return failure(
			new WebmentionSendError(
				`${endpoint.href} answered the Webmention with ${response.status}`,
				response.status,
			),
		);
	}

	let location = response.headers.get("location");
	return success({
		status: "sent",
		endpoint,
		code: response.status,
		location: location === null ? null : (resolve(location, endpoint)?.href ?? null),
	});
}

/**
 * The pages an entry's content links to with `<a>` or `<area>`, resolved against the
 * entry's URL, HTTP(S) only, each once in document order. Links to the entry's own
 * origin are left out, since a site notifies other sites.
 *
 * @param html - The rendered content of the entry
 * @param baseUrl - The entry's permalink
 */
export function outboundLinks(html: string, baseUrl: string | URL): URL[] {
	let document = parseDocument(html);
	if (isFailure(document)) return [];

	let base = baseOf(document.data, baseUrl);
	if (base === null) return [];

	let seen = new Set<string>();
	let links: URL[] = [];
	for (let element of Array.from(document.data.querySelectorAll("a[href], area[href]"))) {
		let url = resolve(element.getAttribute("href") ?? "", base);
		if (url === null || (url.protocol !== "http:" && url.protocol !== "https:")) continue;
		if (url.origin === base.origin || seen.has(url.href)) continue;
		seen.add(url.href);
		links.push(url);
	}
	return links;
}

/**
 * What a create, update or delete notifies: every current link, then every link
 * notified before that the post no longer carries, so a receiver learns a link was
 * removed. On delete, pass `[]` as `current` once the post answers `410`.
 *
 * @param current - The links the post carries now
 * @param previous - The targets notified for this post before
 */
export function plan(current: URL[], previous: URL[]): Sender.Plan {
	let seen = new Set<string>();
	let targets: URL[] = [];
	for (let url of [...current, ...previous]) {
		if (seen.has(url.href)) continue;
		seen.add(url.href);
		targets.push(url);
	}
	return { targets };
}

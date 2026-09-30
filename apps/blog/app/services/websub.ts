/**
 * The blog's WebSub publisher side: how a feed advertises the hub, in the document and in
 * the `Link` header a subscriber reads first, and the ping that tells the hub the feeds
 * changed. The hub is the `WEBSUB_HUB` variable, so moving hubs is a configuration change.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Log } from "@sdxc/logger";
import type { RSS } from "@sdxc/rss";

import { isFailure } from "@sdxc/result";
import { links, publish } from "@sdxc/websub/publisher";
import { env } from "cloudflare:workers";

/** What a feed carries so a subscriber discovers the hub and the topic it subscribes to. */
export interface HubAdvertisement {
	/** The hub's URL, for a format that declares its hub outside `atom:link`. */
	hubUrl: string;
	/** The channel's `atom:link` entries: `rel="self"` naming the topic and `rel="hub"`. */
	atomLink: RSS.AtomLink[];
	/** The `Link` header with the same hub and topic. */
	headers: { link: string };
}

/**
 * The hub and topic a feed declares in both places WebSub says a subscriber looks.
 *
 * @param self The feed's absolute URL, which subscribers key their subscription by.
 * @param type The feed's media type, declared on the `rel="self"` link.
 * @example let hub = advertiseHub(self); new RSS({ ...channel, atomLink: hub.atomLink });
 */
export function advertiseHub(self: string, type = "application/rss+xml"): HubAdvertisement {
	let hub = env.WEBSUB_HUB;
	return {
		hubUrl: hub,
		atomLink: [
			{ rel: "self", href: self, type },
			{ rel: "hub", href: hub },
		],
		headers: { link: links({ hubs: [hub], self }) },
	};
}

/**
 * Tells the hub the given feeds changed, so it fetches them and pushes the new items to
 * subscribers instead of waiting for their next poll. A refused or failed ping is a
 * warning on the invocation's log; subscribers still catch up on their fallback poll.
 *
 * @param topics The absolute URLs of the feeds that changed.
 * @param log Where a failed ping is reported; the invocation's log, when one is open.
 */
export async function pingHub(topics: string[], log: Log | undefined): Promise<void> {
	let pinged = await publish(env.WEBSUB_HUB, topics);
	if (isFailure(pinged)) {
		log?.warn("websub.publish.failed", {
			status: pinged.error.status,
			reason: pinged.error.message,
		});
	}
}

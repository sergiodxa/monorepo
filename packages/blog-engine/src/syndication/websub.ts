/**
 * The engine's WebSub publisher side: feeds advertise the blog's hub, and a CMS write pings
 * it with the feeds that changed. The hub is the owner's `websub_hub` setting, so each blog
 * chooses its own hub, or none, in which case feeds carry no hub and nothing is pinged.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RSS } from "@sdxc/rss";
import type { Database } from "remix/data-table";

import { currentLog } from "@sdxc/logger";
import { isFailure } from "@sdxc/result";
import { links, publish } from "@sdxc/websub/publisher";

import type { PostTypeDefinition } from "../post-types/models/post-type.js";

import routes from "../routes.js";
import { Settings } from "../settings/models/settings.js";

/** What a feed carries so a subscriber finds the hub and the topic it subscribes to. */
export interface HubAdvertisement {
	/** The channel's `atom:link` entries, `rel="self"` and `rel="hub"`. */
	atomLink: RSS.AtomLink[];
	/** The `Link` header naming the same hub and topic. */
	headers: HeadersInit;
}

/**
 * The hub and topic a feed declares, in the document and the `Link` header, or nothing
 * when the blog has no hub configured.
 *
 * @param hub - The blog's hub, `null` when it has none.
 * @param self - The feed's absolute URL.
 */
export function advertiseHub(hub: string | null, self: string): HubAdvertisement {
	if (hub === null) return { atomLink: [], headers: {} };
	return {
		atomLink: [
			{ rel: "self", href: self, type: "application/rss+xml" },
			{ rel: "hub", href: hub },
		],
		headers: { link: links({ hubs: [hub], self }) },
	};
}

/**
 * The feeds a write to one post type changes: the global feed, plus the type's own feed
 * when the type is public.
 *
 * @param origin - The blog's origin, taken from the request.
 * @param type - The post type the write touched.
 */
export function feedsFor(origin: string, type: PostTypeDefinition): string[] {
	let topics = [new URL(routes.rss.href(), origin).toString()];
	if (type.visible) {
		topics.push(new URL(routes.typeRss.href({ typePath: type.path }), origin).toString());
	}
	return topics;
}

/**
 * Pings the blog's hub with the feeds a write to `type` changed, so subscribers receive the
 * change without waiting for their next poll. Without a hub it does nothing; a refused ping
 * is a warning on the current log, since subscribers still catch up on their fallback poll.
 *
 * @param db - The blog's database, for the hub setting.
 * @param origin - The blog's origin, taken from the request.
 * @param type - The post type the write touched.
 */
export async function pingHub(db: Database, origin: string, type: PostTypeDefinition) {
	let hub = await Settings.websubHub(db);
	if (hub === null) return;

	let pinged = await publish(hub, feedsFor(origin, type));
	if (isFailure(pinged)) {
		currentLog()?.warn("websub.publish.failed", {
			status: pinged.error.status,
			reason: pinged.error.message,
		});
	}
}

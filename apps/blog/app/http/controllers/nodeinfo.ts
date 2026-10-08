/**
 * The NodeInfo 2.1 document `/.well-known/nodeinfo` links to: what software the blog runs,
 * that it speaks ActivityPub, that it has one user and no sign-up, and how many posts it
 * has federated. Fediverse servers and crawlers read it to describe the server.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { NodeInfo } from "@sdxc/well-known/nodeinfo";

import { nodeInfo } from "@sdxc/well-known/nodeinfo";
import { respond } from "@sdxc/well-known/response";
import { createAction } from "remix/router";

import { Post } from "~/app/repositories/post";
import { PROFILE } from "~/config/profile";
import routes from "~/routes/web";

/**
 * The software name NodeInfo reports, lowercase letters, digits and hyphens as its schema
 * requires. The site is its own software, so the name is the site's.
 */
const SOFTWARE_NAME = "sergiodxa";

/** The software version NodeInfo reports; the site ships continuously and names no release. */
const SOFTWARE_VERSION = "1.0.0";

/**
 * Builds the NodeInfo document. `localPosts` counts the published articles and tutorials,
 * which are the posts the blog federates.
 *
 * @param localPosts How many posts the outbox lists.
 */
export function nodeInfoDocument(localPosts: number): NodeInfo {
	return {
		version: "2.1",
		software: {
			name: SOFTWARE_NAME,
			version: SOFTWARE_VERSION,
			repository: null,
			homepage: PROFILE.canonical.origin,
		},
		protocols: ["activitypub"],
		services: { inbound: [], outbound: ["atom1.0", "rss2.0"] },
		openRegistrations: false,
		usage: {
			users: { total: 1, activeMonth: 1, activeHalfyear: 1 },
			localPosts,
			localComments: null,
		},
		metadata: {},
	};
}

/** Serves the NodeInfo 2.1 document with its profiled JSON media type. */
export default createAction(routes.nodeInfo, async (ctx) => {
	let posts = await Post.findFederatable(ctx.db);
	return await respond(nodeInfo, nodeInfoDocument(posts.length), { request: ctx.request });
});

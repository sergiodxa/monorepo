/**
 * Serves the reader's shelf as one concrete resource, handed over whole up to a page, so
 * attaching it costs a page rather than an archive.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createResource } from "@sdxc/mcp/server";

import { agentPage, agentStore, reported } from "~/app/mcp/page";
import resourceset from "~/app/mcp/resources";

/** Posts the shelf's resource carries. */
const SAVED_RESOURCE_POSTS = 50;

/** Reads the shelf, newest first. */
export default createResource(resourceset.saved, {
	read: async () => {
		let page = agentPage(await agentStore().savedQueue({ limit: SAVED_RESOURCE_POSTS }));

		return reported("saved", JSON.stringify(page, null, 2));
	},
});

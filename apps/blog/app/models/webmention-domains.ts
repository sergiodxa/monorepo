/**
 * The moderation policy an editor set for a mention source's host: an allowed host's
 * mentions are approved on arrival, and a blocked host can neither mention, follow nor
 * receive anything from the blog.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createModel } from "@sdxc/data-model";
import { unwrap } from "@sdxc/result";

import type { SelectWebmentionDomain } from "~/database/schema";

import { webmentionDomains } from "~/database/schema";

/** What an editor can set a host to. */
export type WebmentionPolicy = SelectWebmentionDomain["policy"];

export const WebmentionDomains = createModel(webmentionDomains, {
	methods: {
		/** The policy set for a host, or `null` while its mentions still wait for review. */
		async policyFor(host: string): Promise<WebmentionPolicy | null> {
			let row = await this.find(host);
			return row?.policy ?? null;
		},

		/** Sets a host's policy, replacing the one it had. */
		async setPolicy(host: string, policy: WebmentionPolicy): Promise<void> {
			unwrap(await this.upsert({ host, policy }));
		},
	},
});

export default WebmentionDomains;

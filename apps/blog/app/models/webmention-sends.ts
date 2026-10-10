/**
 * The Webmentions a post sent, one row per target, with what the last attempt came to. A
 * later send compares the post's links against these rows, so a link the post dropped is
 * notified once more and then forgotten.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createModel } from "@sdxc/data-model";
import { unwrap } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v7";

import { webmentionSends } from "~/database/schema";

/** What one attempt to notify a target came to. */
export interface SendOutcome {
	status: "sent" | "no-endpoint" | "failed";
	endpoint: string | null;
	code: number | null;
	location: string | null;
}

export const WebmentionSends = createModel(webmentionSends, {
	optional: ["id"],

	methods: {
		/** The targets a post sent to before, skipping a stored URL that no longer parses. */
		async targetsFor(postId: string): Promise<URL[]> {
			let rows = await this.query().where({ post_id: postId }).all();
			return rows.flatMap((row) => (URL.canParse(row.target) ? [new URL(row.target)] : []));
		},

		/** Records the latest attempt to notify `target`, replacing the previous one. */
		async record(postId: string, target: string, outcome: SendOutcome): Promise<void> {
			let existing = await this.findBy({ post_id: postId, target });
			if (existing === null) unwrap(await this.create({ post_id: postId, target, ...outcome }));
			else unwrap(await this.update(existing.id, outcome));
		},

		/** Forgets a target the post no longer links, once the removal was sent. */
		async forget(postId: string, target: string): Promise<void> {
			await this.query().where({ post_id: postId, target }).delete();
		},
	},

	callbacks: {
		async beforeCreate(values) {
			return { ...values, id: values.id ?? generateUUID() };
		},
	},
});

export default WebmentionSends;

/**
 * The posting model: the open listing the board renders, the search an agent runs, and the
 * sweep that closes stale postings. Publishing one through `create` assigns its id and
 * timestamps, then drops the cached listing and queues the confirmation once the row landed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createModel } from "@sdxc/data-model";
import { Jobs } from "@sdxc/jobs/router";
import { TypeID } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v4";
import { like, lt, or } from "remix/data-table";

import jobs from "~/app/jobs";
import { cache, LISTING_KEY } from "~/app/lib/cache";
import { postings } from "~/database/schema";

/** How many days a posting stays on the board before the nightly sweep closes it. */
export const POSTING_LIFETIME_DAYS = 30;

export const Postings = createModel(postings, {
	optional: ["id"],

	scopes: {
		/** Every read of the board hides an expired posting, so "open" is stated once. */
		open: (query) => query.where({ expired_at: null }),
		newest: (query) => query.orderBy("created_at", "desc"),
		matching: (query, term: string) =>
			query.where(
				or(
					like(postings.title, `%${term}%`),
					like(postings.company, `%${term}%`),
					like(postings.location, `%${term}%`),
				),
			),
	},

	methods: (model) => ({
		listOpen: (limit: number) => model.open().newest().limit(limit).all(),
		search: (term: string, limit: number) =>
			model.open().matching(term).newest().limit(limit).all(),
		/** Closes every open posting published before `cutoff`, answering how many it closed. */
		expirePublishedBefore: async (cutoff: number) => {
			let now = Date.now();
			let result = await model
				.open()
				.where(lt(postings.created_at, cutoff))
				.update({ expired_at: now, updated_at: now });
			return result.affectedRows;
		},
	}),

	callbacks: {
		/** Integer columns hold epoch milliseconds, so the timestamps are written here. */
		async beforeCreate(values) {
			let now = Date.now();
			return {
				...values,
				id: values.id ?? TypeID.fromUUID("job", generateUUID()).toString(),
				created_at: now,
				updated_at: now,
			};
		},

		/** Runs once the posting is stored, so a refused write mails nobody. */
		async afterCommit(event, ctx) {
			if (event.operation !== "create") return;
			await cache.delete(LISTING_KEY);
			await ctx
				.require(Jobs)
				.enqueue(jobs.sendConfirmation, { postingId: event.row.id, locale: ctx.locale });
		},
	},
});

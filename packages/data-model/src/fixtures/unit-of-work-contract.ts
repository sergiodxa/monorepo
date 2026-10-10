/**
 * The unit-of-work contract every adapter is held to: `afterCommit` events flush only after a
 * successful scope and drop on a throw or a returned `Failure`, a nested scope joins its parent,
 * and earlier writes roll back exactly where the database has real transactions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { failure, isFailure, unwrap } from "@sdxc/result";
import { fail } from "remix/data-table";
import { createContextKey, RequestContext } from "remix/router";
import { describe, expect, test } from "vitest";

import { createModel, createModels } from "../index.js";

import { createIds, posts, users } from "./schema.js";

/** A mailbox a callback sends to through the host context, the way an app's `Mail` key works. */
interface Mailbox {
	sent: string[];
	send(to: string): Promise<void>;
}

/** The context key the welcome mail is read through. */
const MAIL = createContextKey<Mailbox>();

/** How one adapter is opened and what it can promise. */
export interface UnitOfWorkSubject {
	/** Opens an empty database with the schema applied. */
	open(): Promise<Database>;
	/** What the models are bound with. */
	transactions: "database" | "none";
	/** Whether a failed scope rolls back the writes it already made. */
	atomic: boolean;
}

/** Builds the registry and a request context carrying a mailbox. */
async function setup(subject: UnitOfWorkSubject) {
	let ids = createIds();
	let db = await subject.open();
	let seen: Database[] = [];

	let Users = createModel(users, {
		optional: ["id", "role"],
		callbacks: {
			async beforeCreate(values) {
				return { ...values, id: values.id ?? ids(), role: values.role ?? "member" };
			},
			async afterCommit(event, ctx) {
				seen.push(ctx.db);
				if (event.operation === "create") await ctx.require(MAIL).send(event.row.email);
			},
		},
	});

	let Posts = createModel(posts, {
		optional: ["id"],
		callbacks: {
			async beforeCreate(values) {
				return { ...values, id: values.id ?? ids() };
			},
			async afterCreate(row) {
				if (row.published_at === "fail") return fail("Could not index the post");
			},
		},
	});

	let mailbox: Mailbox = {
		sent: [],
		async send(to) {
			mailbox.sent.push(to);
		},
	};
	let host = new RequestContext(new Request("https://example.com"));
	host.set(MAIL, mailbox);

	let models = createModels({ users: Users, posts: Posts }).bind({ db }, host, {
		transactions: subject.transactions,
	});

	return { db, models, mailbox, seen };
}

/**
 * Registers the contract for one adapter.
 *
 * @param label Names the adapter in the test report.
 * @param subject How to open it, and whether its transactions are real.
 */
export function describeUnitOfWork(label: string, subject: UnitOfWorkSubject): void {
	describe(`units of work on ${label}`, () => {
		test("outside a unit of work, afterCommit runs right after the write", async () => {
			let { models, mailbox } = await setup(subject);

			unwrap(await models.users.create({ email: "a@example.com", name: "A" }));

			expect(mailbox.sent).toEqual(["a@example.com"]);
		});

		test("inside a unit of work, events flush once the scope resolves with a success", async () => {
			let { models, mailbox } = await setup(subject);
			let during: string[] = [];

			let result = await models.transaction(async (scoped) => {
				let user = unwrap(await scoped.users.create({ email: "a@example.com", name: "A" }));
				unwrap(
					await scoped.posts.create({ type: "article", author_id: user.id, published_at: null }),
				);
				during.push(...mailbox.sent);
				return user;
			});

			expect(result.email).toBe("a@example.com");
			expect(during).toEqual([]);
			expect(mailbox.sent).toEqual(["a@example.com"]);
		});

		test("afterCommit runs with the binding's own database, not the finished transaction", async () => {
			let { db, models, seen } = await setup(subject);

			await models.transaction(async (scoped) =>
				scoped.users.create({ email: "a@example.com", name: "A" }),
			);

			expect(seen).toEqual([db]);
		});

		test("a returned Failure drops the events and comes back to the caller", async () => {
			let { models, mailbox } = await setup(subject);

			let result = await models.transaction(async (scoped) => {
				let user = unwrap(await scoped.users.create({ email: "a@example.com", name: "A" }));
				let post = await scoped.posts.create({
					type: "article",
					author_id: user.id,
					published_at: "fail",
				});
				if (isFailure(post)) return post;
				return failure(new Error("unreachable"));
			});

			expect(isFailure(result) && result.error.message).toBe("Validation Error");
			expect(mailbox.sent).toEqual([]);
			expect(await models.users.query().count()).toBe(subject.atomic ? 0 : 1);
		});

		test("a throw drops the events and rethrows", async () => {
			let { models, mailbox } = await setup(subject);

			let run = models.transaction(async (scoped) => {
				unwrap(await scoped.users.create({ email: "a@example.com", name: "A" }));
				throw new Error("boom");
			});

			await expect(run).rejects.toThrow("boom");
			expect(mailbox.sent).toEqual([]);
			expect(await models.users.query().count()).toBe(subject.atomic ? 0 : 1);
		});

		test("a scope opened inside another joins it and settles with it", async () => {
			let { models, mailbox } = await setup(subject);
			let inner: string[] = [];

			await models.transaction(async (outer) => {
				await outer.transaction(async (nested) => {
					unwrap(await nested.users.create({ email: "a@example.com", name: "A" }));
				});
				inner.push(...mailbox.sent);
				unwrap(await outer.users.create({ email: "b@example.com", name: "B" }));
			});

			expect(inner).toEqual([]);
			expect(mailbox.sent).toEqual(["a@example.com", "b@example.com"]);
		});

		test("a failing after-callback answers the failure, and keeps the row only without a transaction", async () => {
			let { models } = await setup(subject);
			let author = unwrap(await models.users.create({ email: "a@example.com", name: "A" }));

			let post = await models.posts.create({
				type: "article",
				author_id: author.id,
				published_at: "fail",
			});

			expect(isFailure(post)).toBe(true);
			expect(await models.posts.query().count()).toBe(subject.atomic ? 0 : 1);
		});
	});
}

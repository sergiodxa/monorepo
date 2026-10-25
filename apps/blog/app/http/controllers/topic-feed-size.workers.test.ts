/**
 * A kind's topic feed over more posts than one D1 statement binds. D1 refuses a statement with
 * more than 100 bound values, so this runs against the real binding, where reading every
 * match in one `in` list failed with a database error.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { RSS } from "@sdxc/rss";
import { generateUUID } from "@sdxc/uuid/v4";
import { env } from "cloudflare:test";
import { beforeAll, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import { migratedDatabase } from "~/app/test/d1";
import { seedAuthor } from "~/app/test/fixtures";
import { bindModels } from "~/app/test/models";

const ORIGIN = "https://blog.test";
const RUN = generateUUID().slice(0, 8);
const NOTES = 120;

/** A full `App.Env` over the real bindings, with the secrets a local run cannot read. */
function environment(): App.Env {
	return {
		IS_PROD: false,
		CLIENT_ID: "test",
		CLIENT_SECRET: "test",
		COOKIE_SESSION_SECRET: "test",
		AUTH: env.AUTH,
		REDIRECTS: env.REDIRECTS,
		CACHE: env.CACHE,
		MCP_RATE_LIMITER: undefined,
		waitUntil: () => {},
	};
}

beforeAll(async () => {
	let db = await migratedDatabase();
	let author = await seedAuthor(db);
	let models = bindModels(db);
	for (let index = 0; index < NOTES; index++) {
		let note = await models.notes.create({
			author_id: author,
			published_at: null,
			meta: { slug: `bulk-${RUN}-${index}`, content: `Bulk note ${index} ${RUN}.` },
		});
		if (isFailure(note)) throw new Error(JSON.stringify(note.error.issues));
	}
});

test("a kind's feed lists every post when there are more than one statement can bind", async () => {
	let response = await createWebRouter(environment()).fetch(
		new Request(new URL("/notes.rss", ORIGIN)),
	);
	expect(response.status).toBe(200);
	let feed = unwrap(RSS.parse(await response.text()));
	expect(feed.items.filter((item) => item.link?.includes(`bulk-${RUN}-`))).toHaveLength(NOTES);
});

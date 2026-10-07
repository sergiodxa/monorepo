/**
 * Drives a tutorial page through the real router inside workerd and checks its related
 * tutorials arrive inside the page: the `<Frame>` that carries them is resolved by the
 * server while it renders the page, so the section is there before any script runs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:test";
import { beforeAll, describe, expect, test } from "vitest";

import { TutorialPost } from "~/app/repositories/posts/tutorial";
import { migratedDatabase } from "~/app/test/d1";
import { seedAuthor } from "~/app/test/fixtures";

import createApplication from "../../../bootstrap/app";

const ORIGIN = "https://blog.test";

/** A slug prefix no other test file writes. */
const TOKEN = `zr${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;

/** A tag only this file's tutorials carry, which is what relates them to each other. */
const TAG = `tag${TOKEN}`;

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

/** Requests one URL through the real router. */
function get(path: string): Promise<Response> {
	return createApplication(environment()).fetch(new Request(new URL(path, ORIGIN)));
}

beforeAll(async () => {
	let db = await migratedDatabase();
	let author = await seedAuthor(db);

	for (let name of ["first", "second"]) {
		await TutorialPost.create(db, {
			author_id: author,
			published_at: "2026-03-01T12:00:00.000Z",
			meta: {
				slug: `${TOKEN}-${name}`,
				title: `The ${name} tutorial`,
				excerpt: "A tutorial.",
				content: "Body",
				tags: [TAG],
			},
		});
	}
});

describe("a tutorial page", () => {
	test("renders its related tutorials into the page itself", async () => {
		let response = await get(`/tutorials/${TOKEN}-first`);
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toContain("Related tutorials");
		expect(html).toContain(`href="/tutorials/${TOKEN}-second"`);
	});

	test("serves the same section on its own at the frame's address", async () => {
		let html = await (await get(`/frames/posts/tutorials/${TOKEN}-first/related`)).text();

		expect(html).toContain(`href="/tutorials/${TOKEN}-second"`);
	});
});

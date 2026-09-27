/**
 * Covers the feeds of a freshly provisioned blog, whose seeded site description is blank:
 * RSS requires a channel description, so the feed must still render.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Database } from "remix/data-table";

import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test } from "vitest";

import routes from "../../routes.js";
import { database } from "../../shared/middleware/database.js";
import { createTestDatabase } from "../../shared/test/db.js";

import { feedRss } from "./rss.js";

let db: Database;

beforeEach(async () => {
	({ db } = await createTestDatabase());
});

describe("GET /rss.xml", () => {
	/** Regression: a blank site description made the RSS writer throw, answering 500. */
	test("renders for a blog whose owner left the description blank", async () => {
		let router = createRouter({ middleware: [database(() => db)] });
		router.map(routes.rss, feedRss);

		let response = await router.fetch(new Request("https://blog.example.com/rss.xml"));

		expect(response.status).toBe(200);
		expect(await response.text()).toContain("<description>My Blog</description>");
	});
});

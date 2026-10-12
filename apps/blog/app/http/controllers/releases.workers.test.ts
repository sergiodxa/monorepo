/**
 * Tests the weekly releases posts through the real router and D1: the CMS lists each post
 * with its "Post on X" link and saves an edit to its title and content while keeping the
 * package list the share text names.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { unwrap } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";
import { env } from "cloudflare:test";
import { beforeAll, describe, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import { releaseShareText, shareIntent } from "~/app/services/share";
import { permalink } from "~/app/services/webmention";
import { migratedDatabase } from "~/app/test/d1";
import { bindModels } from "~/app/test/models";
import { seedAdmin, signedInCookie } from "~/app/test/session";
import routes from "~/routes/web";

/** The week every test reads, suffixed to keep it apart from other files sharing the storage. */
const SLUG = `2026-w42-${generateUUID().slice(0, 8)}`;

/** The packages the week released. */
const PACKAGES = [
	{ name: "@sdxc/result", url: "https://www.npmjs.com/package/@sdxc/result" },
	{ name: "remix-utils", url: "https://www.npmjs.com/package/remix-utils" },
];

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

/** Builds the router and sends one request through it, the way the Worker entrypoint does. */
function fetchPath(path: string, init?: RequestInit) {
	return createWebRouter(environment()).fetch(
		new Request(new URL(path, "https://blog.test"), init),
	);
}

/** `href` as the HTML escapes it inside an attribute. */
function attribute(href: string): string {
	return href.replaceAll("&", "&amp;");
}

let db: Database;
let cookie = "";
let releaseId = "";

beforeAll(async () => {
	db = await migratedDatabase();
	let adminId = await seedAdmin(db);
	cookie = await signedInCookie(adminId, environment().COOKIE_SESSION_SECRET);
	releaseId =
		unwrap(
			await bindModels(db).releases.publishWeek({ slug: SLUG, packages: PACKAGES }, adminId),
		) ?? "";
});

describe("the releases CMS", () => {
	test("lists each post with the author's share text naming its packages", async () => {
		let response = await fetchPath(routes.cms.releases.index.href(), { headers: { cookie } });
		let body = await response.text();
		let url = permalink({ postType: "releases", slug: SLUG }).href;

		expect(response.status).toBe(200);
		expect(body).toContain("Post on X");
		expect(body).toContain(
			attribute(
				shareIntent(
					releaseShareText({ packages: ["@sdxc/result", "remix-utils"], permalink: url }),
				),
			),
		);
	});

	test("saves an edited title and content, keeping the slug and packages", async () => {
		let body = new FormData();
		body.set("_method", "PUT");
		body.set("title", "Released this week");
		body.set("content", "- [@sdxc/result](https://www.npmjs.com/package/@sdxc/result)");

		let response = await fetchPath(routes.cms.releases.update.href({ id: releaseId }), {
			method: "POST",
			body,
			headers: { cookie, "sec-fetch-site": "same-origin" },
		});

		expect(response.status).toBe(303);
		let stored = await bindModels(db).releases.find(releaseId);
		expect(stored?.meta.title).toBe("Released this week");
		expect(stored?.meta.content).toBe(
			"- [@sdxc/result](https://www.npmjs.com/package/@sdxc/result)",
		);
		expect(stored?.meta.slug).toBe(SLUG);
		expect(stored?.meta.packages).toEqual(PACKAGES);
	});
});

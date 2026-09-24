import type { MF2 } from "@sdxc/microformats";

/**
 * Exercises the response builders against the status codes, headers and bodies of the
 * Micropub W3C Recommendation's examples, and the RFC 6750 `WWW-Authenticate` challenge
 * the specification points errors at.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import {
	accepted,
	categories,
	config,
	created,
	deleted,
	error,
	source,
	syndicateTo,
	updated,
} from "./index.js";

/** The post Examples 21 to 23 read back. */
const POST: MF2.Item = {
	type: ["h-entry"],
	properties: {
		published: ["2016-02-21T12:50:53-08:00"],
		content: ["Hello World"],
		category: ["foo", "bar"],
	},
};

describe("create responses", () => {
	test("Example 7: created answers 201 with Location", () => {
		let response = created("https://aaronpk.example/post/1000");

		expect(response.status).toBe(201);
		expect(response.headers.get("Location")).toBe("https://aaronpk.example/post/1000");
	});

	test("accepted answers 202 with Location, taking a URL object", () => {
		let response = accepted(new URL("https://aaronpk.example/post/1001"));

		expect(response.status).toBe(202);
		expect(response.headers.get("Location")).toBe("https://aaronpk.example/post/1001");
	});
});

describe("update and delete responses", () => {
	test("updated answers 204 without a body", async () => {
		let response = updated();

		expect(response.status).toBe(204);
		expect(response.headers.has("Location")).toBe(false);
		expect(await response.text()).toBe("");
	});

	test("updated answers 201 with the new Location when the post moved", () => {
		let response = updated("https://aaronpk.example/post/renamed");

		expect(response.status).toBe(201);
		expect(response.headers.get("Location")).toBe("https://aaronpk.example/post/renamed");
	});

	test("deleted answers 204, or 201 when an undelete restored the post elsewhere", () => {
		expect(deleted().status).toBe(204);

		let moved = deleted("https://aaronpk.example/post/restored");
		expect(moved.status).toBe(201);
		expect(moved.headers.get("Location")).toBe("https://aaronpk.example/post/restored");
	});
});

describe(error, () => {
	test("Example 25: invalid_request is 400 with a description", async () => {
		let response = error("invalid_request", "The post with the requested URL was not found");

		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Type")).toMatch(/^application\/json/);
		expect(await response.json()).toEqual({
			error: "invalid_request",
			error_description: "The post with the requested URL was not found",
		});
		expect(response.headers.has("WWW-Authenticate")).toBe(false);
	});

	test("unauthorized is 401 with a bare Bearer challenge", async () => {
		let response = error("unauthorized");

		expect(response.status).toBe(401);
		expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
		expect(await response.json()).toEqual({ error: "unauthorized" });
	});

	test("forbidden is 403 without a challenge", () => {
		let response = error("forbidden", "Only the owner may post");

		expect(response.status).toBe(403);
		expect(response.headers.has("WWW-Authenticate")).toBe(false);
	});

	test("insufficient_scope is 401 and names the scope in the body and the challenge", async () => {
		let response = error("insufficient_scope", "Token lacks create", { scope: ["create"] });

		expect(response.status).toBe(401);
		expect(response.headers.get("WWW-Authenticate")).toBe(
			'Bearer error="insufficient_scope", error_description="Token lacks create", scope="create"',
		);
		expect(await response.json()).toEqual({
			error: "insufficient_scope",
			error_description: "Token lacks create",
			scope: "create",
		});
	});

	test("escapes quotes and backslashes in the challenge", () => {
		let response = error("insufficient_scope", 'needs "create" \\ now');

		expect(response.headers.get("WWW-Authenticate")).toBe(
			'Bearer error="insufficient_scope", error_description="needs \\"create\\" \\\\ now"',
		);
	});
});

describe(config, () => {
	test("Example 20: writes wire names", async () => {
		let response = config({
			mediaEndpoint: "https://media.example.com/micropub",
			syndicateTo: [
				{
					uid: "https://myfavoritesocialnetwork.example/aaronpk",
					name: "aaronpk on myfavoritesocialnetwork",
					service: {
						name: "My Favorite Social Network",
						url: "https://myfavoritesocialnetwork.example/",
						photo: "https://myfavoritesocialnetwork.example/img/icon.png",
					},
					user: {
						name: "aaronpk",
						url: "https://myfavoritesocialnetwork.example/aaronpk",
						photo: "https://myfavoritesocialnetwork.example/aaronpk/photo.jpg",
					},
				},
			],
			q: ["source", "syndicate-to"],
			postTypes: [{ type: "note", name: "Note" }],
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			"media-endpoint": "https://media.example.com/micropub",
			"syndicate-to": [
				{
					uid: "https://myfavoritesocialnetwork.example/aaronpk",
					name: "aaronpk on myfavoritesocialnetwork",
					service: {
						name: "My Favorite Social Network",
						url: "https://myfavoritesocialnetwork.example/",
						photo: "https://myfavoritesocialnetwork.example/img/icon.png",
					},
					user: {
						name: "aaronpk",
						url: "https://myfavoritesocialnetwork.example/aaronpk",
						photo: "https://myfavoritesocialnetwork.example/aaronpk/photo.jpg",
					},
				},
			],
			q: ["source", "syndicate-to"],
			"post-types": [{ type: "note", name: "Note" }],
		});
	});

	test("an empty config is {}", async () => {
		expect(await config({}).text()).toBe("{}");
	});
});

describe(syndicateTo, () => {
	test("Example 24: lists the targets under syndicate-to", async () => {
		let response = syndicateTo([
			{ uid: "https://archive.org/", name: "archive.org" },
			{ uid: "https://wikimedia.org/", name: "WikiMedia" },
		]);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			"syndicate-to": [
				{ uid: "https://archive.org/", name: "archive.org" },
				{ uid: "https://wikimedia.org/", name: "WikiMedia" },
			],
		});
	});

	test("no targets is an empty array", async () => {
		expect(await syndicateTo([]).json()).toEqual({ "syndicate-to": [] });
	});
});

describe(source, () => {
	test("Example 22: the whole item with its type", async () => {
		expect(await source(POST).json()).toEqual(POST);
	});

	test("Example 21: only the requested properties, without type", async () => {
		expect(await source(POST, ["published", "category"]).json()).toEqual({
			properties: {
				published: ["2016-02-21T12:50:53-08:00"],
				category: ["foo", "bar"],
			},
		});
	});

	test("Example 23: HTML content stays an object with html", async () => {
		let item: MF2.Item = {
			type: ["h-entry"],
			properties: {
				content: [{ html: "<b>Hello</b> <i>World</i>", value: "Hello World" }],
			},
		};

		expect(await source(item, ["content"]).json()).toEqual({
			properties: { content: [{ html: "<b>Hello</b> <i>World</i>", value: "Hello World" }] },
		});
	});

	test("a requested property the post lacks is left out", async () => {
		expect(await source(POST, ["location"]).json()).toEqual({ properties: {} });
	});

	test("an empty list asks for the whole item", async () => {
		expect(await source(POST, []).json()).toEqual(POST);
	});
});

describe(categories, () => {
	test("answers the q=category extension", async () => {
		expect(await categories(["indieweb", "micropub"]).json()).toEqual({
			categories: ["indieweb", "micropub"],
		});
	});
});

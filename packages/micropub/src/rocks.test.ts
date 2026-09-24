/**
 * Replays every server test of micropub.rocks (github.com/aaronpk/micropub.rocks, commit
 * eeac57a, Apache-2.0), each named by its number, through the parsers and response
 * builders, asserting what the suite checks of the endpoint the package serves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { parseUpload, uploaded } from "./media.js";

import type { Micropub } from "./index.js";

import {
	config,
	created,
	error,
	parseOperation,
	parseQuery,
	requiredScopes,
	source,
	syndicateTo,
} from "./index.js";

const ENDPOINT = "https://site.example/micropub";
const TOKEN = "rocks-token";
const POST_URL = "https://site.example/post/1";

/** A request the suite sends, with the token in the header unless `header` is false. */
function send(contentType: string, body: string | FormData, header = true): Request {
	let headers = new Headers();
	if (contentType !== "") headers.set("Content-Type", contentType);
	if (header) headers.set("Authorization", `Bearer ${TOKEN}`);
	return new Request(ENDPOINT, { method: "POST", headers, body });
}

/** A form-encoded request as the suite writes it. */
function form(body: string, header = true): Request {
	return send("application/x-www-form-urlencoded; charset=utf-8", body, header);
}

/** A JSON request as the suite writes it. */
function json(body: unknown): Request {
	return send("application/json", JSON.stringify(body));
}

/** The parsed operation and token, failing the test when parsing fails. */
async function parsed(request: Request): Promise<Micropub.Parsed<Micropub.Operation>> {
	return unwrap(await parseOperation(request));
}

/** The properties of a parsed create. */
async function createFrom(request: Request): Promise<Micropub.Create> {
	let { body } = await parsed(request);
	if (body.action !== "create") return expect.unreachable(`Expected a create, got ${body.action}`);
	return body;
}

/** A small image of the given type, as the suite uploads. */
function image(name: string, type: string): File {
	return new File([new Uint8Array([1, 2, 3, 4])], name, { type });
}

describe("100s: creating posts, form-encoded", () => {
	test("100: a basic h-entry, answered 201 with Location", async () => {
		let create = await createFrom(
			form("h=entry&content=Micropub+test+of+creating+a+basic+h-entry"),
		);

		expect(create.type).toEqual(["h-entry"]);
		expect(create.properties).toEqual({ content: ["Micropub test of creating a basic h-entry"] });
		let response = created(POST_URL);
		expect(response.status).toBe(201);
		expect(response.headers.get("Location")).toBe(POST_URL);
	});

	test("101: two categories with category[]", async () => {
		let create = await createFrom(
			form(
				"h=entry&content=Micropub+test+of+creating+an+h-entry+with+categories.+This+post+should+have+two+categories,+test1+and+test2&category[]=test1&category[]=test2",
			),
		);

		expect(create.properties.category).toEqual(["test1", "test2"]);
	});

	test("104: a photo referenced by URL", async () => {
		let create = await createFrom(
			form(
				"h=entry&content=Micropub+test+of+creating+a+photo+referenced+by+URL&photo=https://micropub.rocks/media/sunset.jpg",
			),
		);

		expect(create.properties.photo).toEqual(["https://micropub.rocks/media/sunset.jpg"]);
	});

	test("107: one category without brackets", async () => {
		let create = await createFrom(
			form(
				"h=entry&content=Micropub+test+of+creating+an+h-entry+with+one+category.+This+post+should+have+one+category,+test1&category=test1",
			),
		);

		expect(create.properties.category).toEqual(["test1"]);
	});
});

describe("200s: creating posts, JSON", () => {
	test("200: a basic h-entry", async () => {
		let create = await createFrom(
			json({
				type: ["h-entry"],
				properties: { content: ["Micropub test of creating an h-entry with a JSON request"] },
			}),
		);

		expect(create.properties).toEqual({
			content: ["Micropub test of creating an h-entry with a JSON request"],
		});
	});

	test("201: multiple categories", async () => {
		let create = await createFrom(
			json({
				type: ["h-entry"],
				properties: { content: ["categories"], category: ["test1", "test2"] },
			}),
		);

		expect(create.properties.category).toEqual(["test1", "test2"]);
	});

	test("202: HTML content", async () => {
		let html = "<p>This post has <b>bold</b> and <i>italic</i> text.</p>";

		let create = await createFrom(json({ type: ["h-entry"], properties: { content: [{ html }] } }));

		expect(create.properties.content).toEqual([
			{ html, value: "This post has bold and italic text." },
		]);
	});

	test("203: a photo referenced by URL", async () => {
		let create = await createFrom(
			json({
				type: ["h-entry"],
				properties: { content: ["photo"], photo: ["https://micropub.rocks/media/sunset.jpg"] },
			}),
		);

		expect(create.properties.photo).toEqual(["https://micropub.rocks/media/sunset.jpg"]);
	});

	test("204: a nested h-card, numeric coordinates read as text", async () => {
		let create = await createFrom(
			json({
				type: ["h-entry"],
				properties: {
					published: ["2017-05-31T12:03:36-07:00"],
					content: ["Lunch meeting"],
					checkin: [
						{
							type: ["h-card"],
							properties: {
								name: ["Los Gorditos"],
								url: ["https://foursquare.com/v/502c4bbde4b06e61e06d1ebf"],
								latitude: [45.524330801154],
								longitude: [-122.68068808051],
								"street-address": ["922 NW Davis St"],
								locality: ["Portland"],
								region: ["OR"],
								"country-name": ["United States"],
								"postal-code": ["97209"],
							},
						},
					],
				},
			}),
		);

		expect(create.properties.checkin).toEqual([
			{
				type: ["h-card"],
				properties: {
					name: ["Los Gorditos"],
					url: ["https://foursquare.com/v/502c4bbde4b06e61e06d1ebf"],
					latitude: ["45.524330801154"],
					longitude: ["-122.68068808051"],
					"street-address": ["922 NW Davis St"],
					locality: ["Portland"],
					region: ["OR"],
					"country-name": ["United States"],
					"postal-code": ["97209"],
				},
				value: "Los Gorditos",
			},
		]);
	});

	test("205: a photo with alt text", async () => {
		let create = await createFrom(
			json({
				type: ["h-entry"],
				properties: {
					content: ["alt"],
					photo: [{ value: "https://micropub.rocks/media/sunset.jpg", alt: "Photo of a sunset" }],
				},
			}),
		);

		expect(create.properties.photo).toEqual([
			{ value: "https://micropub.rocks/media/sunset.jpg", alt: "Photo of a sunset" },
		]);
	});

	test("206: multiple photos referenced by URL", async () => {
		let create = await createFrom(
			json({
				type: ["h-entry"],
				properties: {
					content: ["photos"],
					photo: [
						"https://micropub.rocks/media/sunset.jpg",
						"https://micropub.rocks/media/city-at-night.jpg",
					],
				},
			}),
		);

		expect(create.properties.photo).toHaveLength(2);
	});
});

describe("300s: creating posts, multipart", () => {
	test("300: one photo", async () => {
		let body = new FormData();
		body.append("h", "entry");
		body.append("content", "Nice sunset tonight");
		body.append("photo", image("sunset.jpg", "image/jpeg"));

		let create = await createFrom(send("", body));

		expect(create.properties).toEqual({ content: ["Nice sunset tonight"] });
		expect(create.files.photo?.map((file) => file.name)).toEqual(["sunset.jpg"]);
	});

	test("301: two photos named photo[]", async () => {
		let body = new FormData();
		body.append("h", "entry");
		body.append("content", "This post should have two photos");
		body.append("photo[]", image("sunset.jpg", "image/jpeg"));
		body.append("photo[]", image("city-at-night.jpg", "image/jpeg"));

		let create = await createFrom(send("", body));

		expect(create.files.photo?.map((file) => file.name)).toEqual([
			"sunset.jpg",
			"city-at-night.jpg",
		]);
	});
});

describe("400s: updates", () => {
	test("400: replace a property", async () => {
		let { body } = await parsed(
			json({
				action: "update",
				url: POST_URL,
				replace: {
					content: ["This is the updated text. If you can see this you passed the test!"],
				},
			}),
		);

		expect(body).toMatchObject({
			action: "update",
			replace: { content: ["This is the updated text. If you can see this you passed the test!"] },
		});
	});

	test("401: add a value to an existing property", async () => {
		let { body } = await parsed(
			json({ action: "update", url: POST_URL, add: { category: ["test2"] } }),
		);

		expect(body).toMatchObject({ add: { category: ["test2"] } });
	});

	test("402: add a property the post lacks", async () => {
		let { body } = await parsed(
			json({ action: "update", url: POST_URL, add: { category: ["test1"] } }),
		);

		expect(body).toMatchObject({ add: { category: ["test1"] } });
	});

	test("403: remove one value", async () => {
		let { body } = await parsed(
			json({ action: "update", url: POST_URL, delete: { category: ["test2"] } }),
		);

		expect(body).toMatchObject({ deleteValues: { category: ["test2"] }, deleteProperties: [] });
	});

	test("404: remove a property", async () => {
		let { body } = await parsed(json({ action: "update", url: POST_URL, delete: ["category"] }));

		expect(body).toMatchObject({ deleteProperties: ["category"], deleteValues: {} });
	});

	test("405: a replace that is not a map of arrays is rejected with 400", async () => {
		let result = await parseOperation(
			json({ action: "update", url: POST_URL, replace: "This is not a valid update request." }),
		);

		if (!isFailure(result)) return expect.unreachable("Expected invalid_request");
		expect(error("invalid_request", result.error.message).status).toBe(400);
	});
});

describe("500s: delete and undelete", () => {
	test("500: form delete", async () => {
		expect((await parsed(form(`action=delete&url=${POST_URL}`))).body).toEqual({
			action: "delete",
			url: POST_URL,
		});
	});

	test("501: JSON delete", async () => {
		expect((await parsed(json({ action: "delete", url: POST_URL }))).body).toEqual({
			action: "delete",
			url: POST_URL,
		});
	});

	test("502: form undelete", async () => {
		expect((await parsed(form(`action=undelete&url=${POST_URL}`))).body).toEqual({
			action: "undelete",
			url: POST_URL,
		});
	});

	test("503: JSON undelete", async () => {
		expect((await parsed(json({ action: "undelete", url: POST_URL }))).body).toEqual({
			action: "undelete",
			url: POST_URL,
		});
	});
});

describe("600s: queries", () => {
	/** A query the suite sends, authorized in the header. */
	function query(search: string): Micropub.Query {
		let request = new Request(`${ENDPOINT}?${search}`, {
			headers: { Authorization: `Bearer ${TOKEN}` },
		});
		return unwrap(parseQuery(request)).body;
	}

	test("600: q=config answers 200 with a JSON object", async () => {
		expect(query("q=config")).toEqual({ q: "config" });

		let response = config({});
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({});
	});

	test("601: q=syndicate-to answers an array, empty when there are no targets", async () => {
		expect(query("q=syndicate-to")).toEqual({ q: "syndicate-to" });

		let response = syndicateTo([]);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ "syndicate-to": [] });
	});

	test("602: q=source returns every property", async () => {
		expect(query(`q=source&url=${encodeURIComponent(POST_URL)}`)).toEqual({
			q: "source",
			url: POST_URL,
			properties: [],
		});

		let item = {
			type: ["h-entry"],
			properties: {
				content: ["Test of querying the endpoint for the source content"],
				category: ["micropub", "test"],
			},
		};
		expect(await source(item).json()).toEqual(item);
	});

	test("603: q=source with properties[] returns only those", async () => {
		let parsedQuery = query(
			`q=source&properties%5B%5D=content&properties%5B%5D=category&url=${encodeURIComponent(POST_URL)}`,
		);
		expect(parsedQuery).toEqual({
			q: "source",
			url: POST_URL,
			properties: ["content", "category"],
		});

		let item = {
			type: ["h-entry"],
			properties: {
				content: ["Test of querying the endpoint for the source content"],
				category: ["micropub", "test"],
				published: ["2017-05-31T12:03:36-07:00"],
			},
		};
		expect(await source(item, ["content", "category"]).json()).toEqual({
			properties: {
				content: ["Test of querying the endpoint for the source content"],
				category: ["micropub", "test"],
			},
		});
	});
});

describe("700s: media endpoint", () => {
	test.each([
		["700", "sunset.jpg", "image/jpeg"],
		["701", "micropub-rocks.png", "image/png"],
		["702", "w3c-socialwg.gif", "image/gif"],
	])("%s: uploads %s", (_, name, type) => {
		let data = new FormData();
		data.append("file", image(name, type));
		let request = new Request(`${ENDPOINT}/media`, {
			method: "POST",
			headers: { Authorization: `Bearer ${TOKEN}` },
		});

		let upload = unwrap(parseUpload(request, { formData: data, accept: ["image/*"] }));

		expect(upload.body.name).toBe(name);
		expect(upload.accessToken).toBe(TOKEN);
		let response = uploaded(`https://site.example/media/${name}`);
		expect(response.status).toBe(201);
		expect(response.headers.get("Location")).toBe(`https://site.example/media/${name}`);
	});

	test("the config advertises the media endpoint", async () => {
		expect(await config({ mediaEndpoint: `${ENDPOINT}/media` }).json()).toEqual({
			"media-endpoint": `${ENDPOINT}/media`,
		});
	});
});

describe("800s: authentication", () => {
	test("800: the token in the Authorization header", async () => {
		expect(
			(
				await parsed(
					form("h=entry&content=Testing+accepting+access+token+in+HTTP+Authorization+header"),
				)
			).accessToken,
		).toBe(TOKEN);
	});

	test("801: the token in the form body", async () => {
		expect(
			(
				await parsed(
					form(
						`h=entry&content=Testing+accepting+access+token+in+post+body&access_token=${TOKEN}`,
						false,
					),
				)
			).accessToken,
		).toBe(TOKEN);
	});

	test("802: the body token is never stored as a property", async () => {
		let create = await createFrom(
			form(
				`h=entry&content=Testing+accepting+access+token+in+post+body&access_token=${TOKEN}`,
				false,
			),
		);

		expect(create.properties).toEqual({ content: ["Testing accepting access token in post body"] });
	});

	test("803: no token leaves the endpoint to answer unauthorized, 401", async () => {
		let { accessToken } = await parsed(
			form(
				"h=entry&content=Testing+unauthenticated+request.+This+should+not+create+a+post.",
				false,
			),
		);

		expect(accessToken).toBeNull();
		let response = error("unauthorized");
		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: "unauthorized" });
	});

	test("804: a token without create is answered insufficient_scope, 401", async () => {
		let { body } = await parsed(
			form(
				"h=entry&content=Testing+a+request+with+an+unauthorized+access+token.+This+should+not+create+a+post.",
			),
		);
		let granted = new Set<Micropub.Scope>(["update"]);

		expect(requiredScopes(body).some((scope) => granted.has(scope))).toBe(false);
		let response = error("insufficient_scope");
		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: "insufficient_scope" });
	});

	test("805: a token in both the header and the body is rejected with 400", async () => {
		let result = await parseOperation(
			form(
				`h=entry&content=Testing+accepting+access+token+in+HTTP+Authorization+header+and+POST+body.+This+should+not+create+a+post&access_token=${TOKEN}`,
			),
		);

		if (!isFailure(result)) return expect.unreachable("Expected invalid_request");
		expect(error("invalid_request", result.error.message).status).toBe(400);
	});
});

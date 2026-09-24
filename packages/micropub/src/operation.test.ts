/**
 * Exercises `parseOperation` and `requiredScopes` on the requests of the Micropub W3C
 * Recommendation's examples (numbered as in the specification), and on the commands,
 * token placements and malformed bodies the specification's prose describes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Micropub } from "./index.js";

import { MicropubRequestError, parseOperation, requiredScopes } from "./index.js";

const ENDPOINT = "https://aaronpk.example/micropub";

/** A form-encoded POST, authorized in the header unless `token` is `null`. */
function form(body: string, token: string | null = "XXXXXXX"): Request {
	let headers = new Headers({ "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" });
	if (token !== null) headers.set("Authorization", `Bearer ${token}`);
	return new Request(ENDPOINT, { method: "POST", headers, body });
}

/** A JSON POST, authorized in the header unless `token` is `null`. */
function json(body: unknown, token: string | null = "XXXXXXX"): Request {
	let headers = new Headers({ "Content-Type": "application/json" });
	if (token !== null) headers.set("Authorization", `Bearer ${token}`);
	return new Request(ENDPOINT, { method: "POST", headers, body: JSON.stringify(body) });
}

/** A multipart POST built from `parts`, authorized in the header. */
function multipart(parts: [string, string | File][]): Request {
	let body = new FormData();
	for (let [name, value] of parts) body.append(name, value);
	return new Request(ENDPOINT, {
		method: "POST",
		headers: { Authorization: "Bearer XXXXXXX" },
		body,
	});
}

/** The parsed operation, failing the test when parsing fails. */
async function operation(
	request: Request,
	options?: Micropub.ParseOptions,
): Promise<Micropub.Operation> {
	return unwrap(await parseOperation(request, options)).body;
}

/** The error parsing produced, failing the test when parsing succeeds. */
async function rejection(
	request: Request,
	options?: Micropub.ParseOptions,
): Promise<MicropubRequestError> {
	let result = await parseOperation(request, options);
	if (!isFailure(result)) return expect.unreachable("Expected the request to be rejected");
	return result.error;
}

/** A create's commands with nothing set, for spreading overrides into. */
const NO_COMMANDS: Micropub.Commands = { slug: null, syndicateTo: [], status: null, other: {} };

describe("create, form-encoded", () => {
	test("Example 1: array syntax collects repeated values", async () => {
		let result = await operation(form("h=entry&content=hello+world&category[]=foo&category[]=bar"));

		expect(result).toEqual({
			action: "create",
			type: ["h-entry"],
			properties: { content: ["hello world"], category: ["foo", "bar"] },
			commands: NO_COMMANDS,
			files: {},
		});
	});

	test("Example 3: a photo URL is a property value", async () => {
		let result = await operation(
			form("h=entry&content=hello+world&photo=https://photos.example.com/592829482876343254.jpg"),
		);

		expect(result).toMatchObject({
			properties: {
				content: ["hello world"],
				photo: ["https://photos.example.com/592829482876343254.jpg"],
			},
		});
	});

	test("Example 26: mp-syndicate-to is a command, not a property", async () => {
		let result = await operation(
			form(
				"h=entry&content=My+favorite+of+the+%23quantifiedself+trackers%2C+finally+released+their+official+API&category[]=quantifiedself&category[]=api&mp-syndicate-to=https://myfavoritesocialnetwork.example/aaronpk",
			),
		);

		expect(result).toEqual({
			action: "create",
			type: ["h-entry"],
			properties: {
				content: [
					"My favorite of the #quantifiedself trackers, finally released their official API",
				],
				category: ["quantifiedself", "api"],
			},
			commands: {
				...NO_COMMANDS,
				syndicateTo: ["https://myfavoritesocialnetwork.example/aaronpk"],
			},
			files: {},
		});
	});

	test("Example 27: the minimal note", async () => {
		expect(await operation(form("h=entry&content=Hello+World"))).toMatchObject({
			type: ["h-entry"],
			properties: { content: ["Hello World"] },
		});
	});

	test("Example 29: a reply keeps in-reply-to as spelled", async () => {
		let result = await operation(
			form(
				"h=entry&content=%40BarnabyWalters+My+favorite+for+that+use+case+is+Redis.&in-reply-to=https://waterpigs.example/notes/4S0LMw/&mp-syndicate-to=https://myfavoritesocialnetwork.example/aaronpk",
			),
		);

		expect(result).toMatchObject({
			properties: {
				content: ["@BarnabyWalters My favorite for that use case is Redis."],
				"in-reply-to": ["https://waterpigs.example/notes/4S0LMw/"],
			},
			commands: { syndicateTo: ["https://myfavoritesocialnetwork.example/aaronpk"] },
		});
	});

	test("defaults to h-entry when no h is sent", async () => {
		expect(await operation(form("content=untyped"))).toMatchObject({ type: ["h-entry"] });
	});

	test("prefixes h with h-", async () => {
		expect(await operation(form("h=event&name=IndieWebCamp"))).toMatchObject({
			type: ["h-event"],
			properties: { name: ["IndieWebCamp"] },
		});
	});

	test("merges the bracketed and plain spelling of a name", async () => {
		expect(await operation(form("h=entry&category=a&category[]=b"))).toMatchObject({
			properties: { category: ["a", "b"] },
		});
	});

	test("keeps url as a property of an h-card being created", async () => {
		expect(await operation(form("h=card&name=Ada&url=https://ada.example/"))).toMatchObject({
			type: ["h-card"],
			properties: { name: ["Ada"], url: ["https://ada.example/"] },
		});
	});

	test("splits mp-slug, post-status and unknown mp-* commands out of the properties", async () => {
		let result = await operation(
			form("h=entry&content=draft&mp-slug=first-post&post-status=draft&mp-photo-alt=A+sunset"),
		);

		expect(result).toEqual({
			action: "create",
			type: ["h-entry"],
			properties: { content: ["draft"] },
			commands: {
				slug: "first-post",
				syndicateTo: [],
				status: "draft",
				other: { "mp-photo-alt": ["A sunset"] },
			},
			files: {},
		});
	});

	test("collects every mp-syndicate-to[] value", async () => {
		let result = await operation(
			form(
				"h=entry&content=x&mp-syndicate-to[]=https://a.example/&mp-syndicate-to[]=https://b.example/",
			),
		);

		expect(result).toMatchObject({
			commands: { syndicateTo: ["https://a.example/", "https://b.example/"] },
		});
	});

	test("rejects a post-status outside published and draft", async () => {
		let error = await rejection(form("h=entry&content=x&post-status=secret"));

		expect(error).toBeInstanceOf(MicropubRequestError);
		expect(error.issues.length).toBeGreaterThan(0);
	});

	test("rejects an empty h", async () => {
		expect(await rejection(form("h=&content=x"))).toBeInstanceOf(MicropubRequestError);
	});
});

describe("create, multipart", () => {
	test("Example 2: a file part lands in files under its property name", async () => {
		let photo = new File([new Uint8Array([137, 80, 78, 71])], "aaronpk.png", {
			type: "image/png",
		});

		let result = await operation(
			multipart([
				["h", "entry"],
				["content", "Hello World!"],
				["photo", photo],
			]),
		);

		expect(result).toMatchObject({
			action: "create",
			type: ["h-entry"],
			properties: { content: ["Hello World!"] },
			commands: NO_COMMANDS,
		});
		expect(result.action === "create" && result.files.photo?.map((file) => file.name)).toEqual([
			"aaronpk.png",
		]);
	});

	test("files and URLs of one property are kept apart", async () => {
		let video = new File(["frames"], "clip.mp4", { type: "video/mp4" });

		let result = await operation(
			multipart([
				["video", video],
				["photo", "https://photos.example.com/frame.jpg"],
			]),
		);

		expect(result).toMatchObject({
			properties: { photo: ["https://photos.example.com/frame.jpg"] },
		});
		expect(result.action === "create" && Object.keys(result.files)).toEqual(["video"]);
	});

	test("an empty file input the browser submitted is dropped", async () => {
		let result = await operation(
			multipart([
				["content", "no photo"],
				["photo", new File([], "")],
			]),
		);

		expect(result).toMatchObject({ properties: { content: ["no photo"] }, files: {} });
	});

	test("reads the FormData a middleware already consumed", async () => {
		let body = new FormData();
		body.append("h", "entry");
		body.append("content", "from middleware");
		let request = new Request(ENDPOINT, {
			method: "POST",
			headers: { "Content-Type": "multipart/form-data; boundary=x", Authorization: "Bearer t" },
		});

		expect(await operation(request, { formData: body })).toMatchObject({
			properties: { content: ["from middleware"] },
		});
	});
});

describe("create, JSON", () => {
	test("Example 4: arrays of strings", async () => {
		let result = await operation(
			json({
				type: ["h-entry"],
				properties: {
					content: ["hello world"],
					category: ["foo", "bar"],
					photo: ["https://photos.example.com/592829482876343254.jpg"],
				},
			}),
		);

		expect(result).toEqual({
			action: "create",
			type: ["h-entry"],
			properties: {
				content: ["hello world"],
				category: ["foo", "bar"],
				photo: ["https://photos.example.com/592829482876343254.jpg"],
			},
			commands: NO_COMMANDS,
			files: {},
		});
	});

	test("Example 5: a photo with alt text", async () => {
		let result = await operation(
			json({
				type: ["h-entry"],
				properties: {
					content: ["hello world"],
					category: ["foo", "bar"],
					photo: [
						{ value: "https://photos.example.com/globe.gif", alt: "Spinning globe animation" },
					],
				},
			}),
		);

		expect(result).toMatchObject({
			properties: {
				photo: [{ value: "https://photos.example.com/globe.gif", alt: "Spinning globe animation" }],
			},
		});
	});

	test("Example 6: nested h-measure items gain their implied value", async () => {
		let result = await operation(
			json({
				type: ["h-entry"],
				properties: {
					summary: ["Weighed 70.64 kg"],
					weight: [{ type: ["h-measure"], properties: { num: ["70.64"], unit: ["kg"] } }],
					bodyfat: [{ type: ["h-measure"], properties: { num: ["19.83"], unit: ["%"] } }],
				},
			}),
		);

		expect(result).toMatchObject({
			properties: {
				summary: ["Weighed 70.64 kg"],
				weight: [{ type: ["h-measure"], properties: { num: ["70.64"], unit: ["kg"] }, value: "" }],
				bodyfat: [{ type: ["h-measure"], properties: { num: ["19.83"], unit: ["%"] }, value: "" }],
			},
		});
	});

	test("Example 30: HTML content gains the text its markup reads as", async () => {
		let html =
			'Now that I\'ve been <a href="https://aaronparecki.com/events">creating a list of events</a> on my site';

		let result = await operation(
			json({
				type: ["h-entry"],
				properties: {
					name: ["Itching: h-event to iCal converter"],
					content: [{ html }],
					category: ["indieweb", "p3k"],
				},
			}),
		);

		expect(result).toMatchObject({
			properties: {
				name: ["Itching: h-event to iCal converter"],
				content: [{ html, value: "Now that I've been creating a list of events on my site" }],
				category: ["indieweb", "p3k"],
			},
		});
	});

	test("Example 32: an article with embedded images keeps its markup", async () => {
		let html =
			'<p>Hello World</p><p><img src="https://media.example.com/file/ff176c461dd111e6b6ba3e1d05defe78.jpg"></p>';

		expect(
			await operation(json({ type: ["h-entry"], properties: { content: [{ html }] } })),
		).toMatchObject({ properties: { content: [{ html, value: "Hello World" }] } });
	});

	test("splits JSON commands, keeping unknown ones with their raw values", async () => {
		let result = await operation(
			json({
				type: ["h-entry"],
				properties: {
					content: ["hi"],
					"mp-slug": ["hi"],
					"mp-syndicate-to": ["https://archive.org/"],
					"post-status": ["published"],
					"mp-channel": [{ uid: "notes" }],
				},
			}),
		);

		expect(result).toEqual({
			action: "create",
			type: ["h-entry"],
			properties: { content: ["hi"] },
			commands: {
				slug: "hi",
				syndicateTo: ["https://archive.org/"],
				status: "published",
				other: { "mp-channel": [{ uid: "notes" }] },
			},
			files: {},
		});
	});

	test("defaults a missing type to h-entry", async () => {
		expect(await operation(json({ properties: { content: ["x"] } }))).toMatchObject({
			type: ["h-entry"],
		});
	});

	test("reads a +json media type", async () => {
		let request = new Request(ENDPOINT, {
			method: "POST",
			headers: { "Content-Type": "application/activity+json" },
			body: JSON.stringify({ type: ["h-entry"], properties: { content: ["x"] } }),
		});

		expect(await operation(request)).toMatchObject({ properties: { content: ["x"] } });
	});

	test("ignores access_token in a JSON body, which is not a place a token may travel", async () => {
		let parsed = unwrap(
			await parseOperation(
				json({ type: ["h-entry"], properties: { content: ["x"] }, access_token: "body" }, null),
			),
		);

		expect(parsed.accessToken).toBeNull();
	});

	test.each([
		["an array", [1, 2]],
		["a string", "h=entry"],
		["null", null],
	])("rejects a body that is %s", async (_, body) => {
		expect(await rejection(json(body))).toBeInstanceOf(MicropubRequestError);
	});

	test("rejects text that is not JSON", async () => {
		let request = new Request(ENDPOINT, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "{not json",
		});

		expect((await rejection(request)).message).toMatch(/JSON/);
	});

	test("rejects properties that are not arrays", async () => {
		let error = await rejection(json({ type: ["h-entry"], properties: { content: "x" } }));

		expect(error.issues.length).toBeGreaterThan(0);
	});

	test("rejects a JSON body over maxJsonBytes", async () => {
		let request = json({ type: ["h-entry"], properties: { content: ["x".repeat(100)] } });

		expect((await rejection(request, { maxJsonBytes: 64 })).message).toMatch(/64 bytes/);
	});

	test("stops reading a streamed JSON body once it passes maxJsonBytes", async () => {
		let pulls = 0;
		let body = new ReadableStream<Uint8Array>({
			pull(controller) {
				pulls += 1;
				controller.enqueue(new TextEncoder().encode(`{"padding":"${"x".repeat(32)}`));
			},
		});
		let init = {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body,
			duplex: "half",
		};
		let request = new Request(ENDPOINT, init);

		expect((await rejection(request, { maxJsonBytes: 100 })).message).toMatch(/100 bytes/);
		expect(pulls).toBeLessThan(10);
	});
});

describe("update", () => {
	test("Example 8: replace", async () => {
		expect(
			await operation(
				json({
					action: "update",
					url: "https://aaronpk.example/post/100",
					replace: { content: ["hello moon"] },
				}),
			),
		).toEqual({
			action: "update",
			url: "https://aaronpk.example/post/100",
			replace: { content: ["hello moon"] },
			add: {},
			deleteProperties: [],
			deleteValues: {},
		});
	});

	test("Example 9: add a syndication URL", async () => {
		expect(
			await operation(
				json({
					action: "update",
					url: "https://aaronpk.example/2014/06/01/9/indieweb",
					add: {
						syndication: [
							"http://web.archive.org/web/20040104110725/https://aaronpk.example/2014/06/01/9/indieweb",
						],
					},
				}),
			),
		).toMatchObject({
			add: {
				syndication: [
					"http://web.archive.org/web/20040104110725/https://aaronpk.example/2014/06/01/9/indieweb",
				],
			},
		});
	});

	test("Example 10: add tags", async () => {
		expect(
			await operation(
				json({
					action: "update",
					url: "https://aaronpk.example/2014/06/01/9/indieweb",
					add: { category: ["micropub", "indieweb"] },
				}),
			),
		).toMatchObject({ add: { category: ["micropub", "indieweb"] } });
	});

	test("Example 11: delete a whole property", async () => {
		expect(
			await operation(
				json({
					action: "update",
					url: "https://aaronpk.example/2014/06/01/9/indieweb",
					delete: ["category"],
				}),
			),
		).toMatchObject({ deleteProperties: ["category"], deleteValues: {} });
	});

	test("Example 12: delete individual values", async () => {
		expect(
			await operation(
				json({
					action: "update",
					url: "https://aaronpk.example/2014/06/01/9/indieweb",
					delete: { category: ["indieweb"] },
				}),
			),
		).toMatchObject({ deleteProperties: [], deleteValues: { category: ["indieweb"] } });
	});

	test("combines replace, add and delete, canonicalizing each value", async () => {
		expect(
			await operation(
				json({
					action: "update",
					url: "https://aaronpk.example/post/1",
					replace: { content: [{ html: "<b>bold</b>" }] },
					add: { category: ["new"] },
					delete: ["location"],
				}),
			),
		).toEqual({
			action: "update",
			url: "https://aaronpk.example/post/1",
			replace: { content: [{ html: "<b>bold</b>", value: "bold" }] },
			add: { category: ["new"] },
			deleteProperties: ["location"],
			deleteValues: {},
		});
	});

	test("rejects an update naming no change", async () => {
		let error = await rejection(
			json({ action: "update", url: "https://aaronpk.example/post/1", replace: {} }),
		);

		expect(error.message).toMatch(/change/);
	});

	test("rejects an update over a form body", async () => {
		let error = await rejection(form("action=update&url=https://aaronpk.example/post/1&content=x"));

		expect(error.message).toMatch(/JSON/);
	});

	test("rejects an update whose url is not an absolute URL", async () => {
		expect(
			await rejection(json({ action: "update", url: "/post/1", replace: { content: ["x"] } })),
		).toBeInstanceOf(MicropubRequestError);
	});

	test("rejects delete values that are not arrays", async () => {
		expect(
			await rejection(
				json({ action: "update", url: "https://aaronpk.example/1", delete: { category: "x" } }),
			),
		).toBeInstanceOf(MicropubRequestError);
	});
});

describe("delete and undelete", () => {
	test("Example 13: form delete", async () => {
		expect(
			await operation(form("action=delete&url=https://aaronpk.example/2014/06/01/9/indieweb")),
		).toEqual({ action: "delete", url: "https://aaronpk.example/2014/06/01/9/indieweb" });
	});

	test("Example 14: JSON delete", async () => {
		expect(
			await operation(
				json({ action: "delete", url: "https://aaronpk.example/2014/06/01/9/indieweb" }),
			),
		).toEqual({ action: "delete", url: "https://aaronpk.example/2014/06/01/9/indieweb" });
	});

	test("Example 15: form undelete", async () => {
		expect(
			await operation(form("action=undelete&url=https://aaronpk.example/2014/06/01/9/indieweb")),
		).toEqual({ action: "undelete", url: "https://aaronpk.example/2014/06/01/9/indieweb" });
	});

	test("Example 16: JSON undelete", async () => {
		expect(
			await operation(
				json({ action: "undelete", url: "https://aaronpk.example/2014/06/01/9/indieweb" }),
			),
		).toEqual({ action: "undelete", url: "https://aaronpk.example/2014/06/01/9/indieweb" });
	});

	test("rejects a delete without a url", async () => {
		expect(await rejection(form("action=delete"))).toBeInstanceOf(MicropubRequestError);
		expect(await rejection(json({ action: "delete" }))).toBeInstanceOf(MicropubRequestError);
	});

	test("rejects an action the specification does not define", async () => {
		expect((await rejection(form("action=publish&url=https://a.example/"))).message).toMatch(
			/publish/,
		);
		expect((await rejection(json({ action: "publish" }))).message).toMatch(/publish/);
	});
});

describe("access token", () => {
	test("reads the Authorization header", async () => {
		let parsed = unwrap(await parseOperation(form("h=entry&content=x", "header-token")));

		expect(parsed.accessToken).toBe("header-token");
	});

	test("reads the scheme case-insensitively", async () => {
		let request = new Request(ENDPOINT, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "bearer abc" },
			body: "content=x",
		});

		expect(unwrap(await parseOperation(request)).accessToken).toBe("abc");
	});

	test("reads access_token from a form body and never keeps it as a property", async () => {
		let parsed = unwrap(
			await parseOperation(form("h=entry&content=x&access_token=body-token", null)),
		);

		expect(parsed.accessToken).toBe("body-token");
		expect(parsed.body).toMatchObject({ properties: { content: ["x"] } });
		expect(parsed.body.action === "create" && "access_token" in parsed.body.properties).toBe(false);
	});

	test("reads access_token from a multipart body", async () => {
		let body = new FormData();
		body.append("content", "x");
		body.append("access_token", "multipart-token");

		let parsed = unwrap(await parseOperation(new Request(ENDPOINT, { method: "POST", body })));

		expect(parsed.accessToken).toBe("multipart-token");
	});

	test("is null when no token was sent", async () => {
		expect(unwrap(await parseOperation(form("content=x", null))).accessToken).toBeNull();
	});

	test("ignores another authentication scheme", async () => {
		let request = new Request(ENDPOINT, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Authorization: "Basic dXNlcjpwYXNz",
			},
			body: "content=x",
		});

		expect(unwrap(await parseOperation(request)).accessToken).toBeNull();
	});

	test("rejects a token sent both in the header and in the body", async () => {
		let error = await rejection(form("content=x&access_token=body", "header"));

		expect(error.message).toMatch(/both/);
	});

	test("rejects a Bearer header carrying no token", async () => {
		let request = new Request(ENDPOINT, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Bearer " },
			body: "content=x",
		});

		expect(await rejection(request)).toBeInstanceOf(MicropubRequestError);
	});
});

describe("request encoding", () => {
	test("rejects a media type Micropub does not define", async () => {
		let request = new Request(ENDPOINT, {
			method: "POST",
			headers: { "Content-Type": "text/plain" },
			body: "content=x",
		});

		expect((await rejection(request)).message).toMatch(/text\/plain/);
	});
});

describe(requiredScopes, () => {
	/** A create with the given status and nothing else. */
	function create(status: Micropub.Commands["status"]): Micropub.Create {
		return {
			action: "create",
			type: ["h-entry"],
			properties: {},
			commands: { ...NO_COMMANDS, status },
			files: {},
		};
	}

	test("a create needs create", () => {
		expect(requiredScopes(create(null))).toEqual(["create"]);
		expect(requiredScopes(create("published"))).toEqual(["create"]);
	});

	test("a draft is authorized by draft or create", () => {
		expect(requiredScopes(create("draft"))).toEqual(["draft", "create"]);
	});

	test("update, delete and undelete each name their own scope", () => {
		let url = "https://a.example/1";
		let update: Micropub.Update = {
			action: "update",
			url,
			replace: {},
			add: {},
			deleteProperties: ["x"],
			deleteValues: {},
		};

		expect(requiredScopes(update)).toEqual(["update"]);
		expect(requiredScopes({ action: "delete", url })).toEqual(["delete"]);
		expect(requiredScopes({ action: "undelete", url })).toEqual(["undelete", "delete"]);
	});
});

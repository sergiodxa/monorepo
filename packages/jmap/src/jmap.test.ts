/**
 * Exercises `JMAP` against an MSW server playing the RFC 8620 example host: the session
 * read and its refresh, batches answered with the RFC example responses, request-level
 * problems, blob upload and download, and the event-source stream.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { isFailure, isSuccess } from "@sdxc/result";
import { UriTemplateError } from "@sdxc/uri-template";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { PushEvent } from "./push.js";

import { Batch } from "./batch.js";
import { LIMIT, RESPONSE, SESSION, STATE_CHANGE, UNKNOWN_CAPABILITY } from "./fixtures/rfc8620.js";
import {
	EMAIL_GET_RESPONSE,
	IDENTITY_GET_RESPONSE,
	MAILBOX_SET_RESPONSE,
	SEARCH_SNIPPET_RESPONSE,
	SUBMISSION_RESPONSE,
} from "./fixtures/rfc8621.js";
import { INITIAL_RESPONSE } from "./fixtures/rfc9610.js";
import { JMAP } from "./jmap.js";

const ORIGIN = "https://jmap.example.com";
const SESSION_URL = `${ORIGIN}/.well-known/jmap`;
const TOKEN = "fmu1-test-token";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Serves the RFC session, counting fetches and recording the Authorization header. */
function serveSession(session: object = SESSION): { hits: number; authorization: string | null } {
	let seen = { hits: 0, authorization: null as string | null };
	server.use(
		http.get(SESSION_URL, ({ request }) => {
			seen.hits++;
			seen.authorization = request.headers.get("Authorization");
			return HttpResponse.json(session);
		}),
	);
	return seen;
}

/** Answers every API request with `body`, recording the Request object sent. */
function serveApi(body: object): { requests: unknown[] } {
	let seen = { requests: [] as unknown[] };
	server.use(
		http.post(SESSION.apiUrl, async ({ request }) => {
			seen.requests.push(await request.json());
			return HttpResponse.json(body);
		}),
	);
	return seen;
}

/** A client of the example host. */
function client(): JMAP {
	return new JMAP({ url: ORIGIN, token: TOKEN });
}

/** The success value of `result`, failing the test on a failure. */
function unwrap<T>(result: Result<T, Error>): T {
	if (isFailure(result)) throw result.error;
	return result.data;
}

describe("session", () => {
	test("reads the RFC 8620 session from the well-known URL with the bearer token", async () => {
		let seen = serveSession();

		let session = unwrap(await client().session());

		expect(session.apiUrl).toBe("https://jmap.example.com/api/");
		expect(session.primaryAccounts["urn:ietf:params:jmap:mail"]).toBe("A13824");
		expect(session.accounts.A97813?.isReadOnly).toBe(true);
		expect(session.capabilities["https://example.com/apis/foobar"]).toEqual({
			maxFoosFinangled: 42,
		});
		expect(seen.authorization).toBe(`Bearer ${TOKEN}`);
	});

	test("uses a session URL with a path as given", async () => {
		server.use(http.get("https://api.fastmail.com/jmap/session", () => HttpResponse.json(SESSION)));

		let jmap = new JMAP({ url: new URL("https://api.fastmail.com/jmap/session"), token: TOKEN });

		expect(isSuccess(await jmap.session())).toBe(true);
	});

	test("fetches the session once while its state holds", async () => {
		let seen = serveSession();
		serveApi(RESPONSE);
		let jmap = client();

		await jmap.session();
		await jmap.send(new Batch());

		expect(seen.hits).toBe(1);
	});

	test("fetches the session again after a response reports a new state", async () => {
		let seen = serveSession();
		serveApi({ ...RESPONSE, sessionState: "changed" });
		let jmap = client();

		await jmap.send(new Batch());
		await jmap.session();

		expect(seen.hits).toBe(2);
	});

	test("rejects a session without the core capability", async () => {
		serveSession({ ...SESSION, capabilities: {} });

		let result = await client().session();

		expect(isFailure(result) && result.error.code).toBe("invalid-response");
	});

	test("rejects a session missing its URLs", async () => {
		serveSession({ ...SESSION, apiUrl: undefined });

		let result = await client().session();

		expect(isFailure(result) && result.error.code).toBe("invalid-response");
	});

	test("reads a 401 without a body as an HTTP error", async () => {
		server.use(http.get(SESSION_URL, () => new HttpResponse(null, { status: 401 })));

		let result = await client().session();

		expect(isFailure(result) && [result.error.code, result.error.status]).toEqual(["http", 401]);
	});

	test("reads a transport failure as a network error", async () => {
		server.use(http.get(SESSION_URL, () => HttpResponse.error()));

		let result = await client().session();

		expect(isFailure(result) && result.error.code).toBe("network");
	});
});

describe("send", () => {
	test("posts the Request object and reads the RFC 8620 example response", async () => {
		serveSession();
		let api = serveApi(RESPONSE);
		let batch = new Batch();
		batch.call("Core/echo", { arg1: "arg1data" }, { id: "c1" });
		let unknown = batch.call("Core/echo", {}, { id: "c3" });

		let response = unwrap(await client().send(batch));

		expect(api.requests).toEqual([batch.toJSON()]);
		expect(response.sessionState).toBe("75128aab4b1b");
		expect(response.responses(batch.call("Core/echo", {}, { id: "c2" }))).toHaveLength(2);
		let error = response.get(unknown);
		expect(isFailure(error) && [error.error.type, error.error.callId]).toEqual([
			"unknownMethod",
			"c3",
		]);
	});

	test("types each response by its method", async () => {
		serveSession();
		serveApi(EMAIL_GET_RESPONSE);
		let batch = new Batch();
		let get = batch.call("Email/get", { accountId: "abc", ids: ["f123u456"] }, { id: "#1" });

		let emails = unwrap(unwrap(await client().send(batch)).get(get));

		expect(emails.notFound).toEqual(["f123u456"]);
		expect(emails.list[0]?.bodyValues?.["1"]?.isTruncated).toBe(true);
		expect(emails.list[0]?.["header:List-POST:asURLs"]).toEqual([
			"mailto:partytime@lists.example.com",
		]);
	});

	test("reads a /set's per-record failures", async () => {
		serveSession();
		serveApi(MAILBOX_SET_RESPONSE);
		let batch = new Batch();
		let set = batch.call("Mailbox/set", {
			accountId: "u33084183",
			ifInState: "78542",
			update: { MB674cc24095db49ce: { name: "Maybe important mail" } },
			destroy: ["MB23cfa8094c0f41e6"],
		});

		let result = unwrap(unwrap(await client().send(batch)).get(set));

		expect(result.updated).toEqual({ MB674cc24095db49ce: null });
		expect(result.notDestroyed?.MB23cfa8094c0f41e6?.type).toBe("forbidden");
	});

	test("reads the implicit Email/set an EmailSubmission answers with", async () => {
		serveSession();
		serveApi(SUBMISSION_RESPONSE);
		let batch = new Batch();
		let submit = batch.call("EmailSubmission/set", { accountId: "ue411d190" });

		let response = unwrap(await client().send(batch));

		expect(unwrap(response.get(submit)).created?.k1490?.id).toBe(
			"ES-3bab7f9a-623e-4acf-99a5-2e67facb02a0",
		);
		expect(unwrap(response.get(submit, "Email/set")).updated).toEqual({
			M7f6ed5bcfd7e2604d1753f6c: null,
		});
	});

	test("reads search snippets, identities and contacts", async () => {
		serveSession();
		let jmap = client();

		serveApi(SEARCH_SNIPPET_RESPONSE);
		let snippets = new Batch();
		let snippet = snippets.call("SearchSnippet/get", {
			accountId: "ue150411c",
			filter: { text: "foo" },
			emailIds: ["M44200ec123de277c0c1ce69c", "M7bcbcb0b58d7729686e83d99"],
		});
		let found = unwrap(unwrap(await jmap.send(snippets)).get(snippet));

		serveApi(IDENTITY_GET_RESPONSE);
		let identities = new Batch();
		let identity = identities.call("Identity/get", { accountId: "acme" });
		let list = unwrap(unwrap(await jmap.send(identities)).get(identity)).list;

		serveApi(INITIAL_RESPONSE);
		let contacts = new Batch();
		contacts.call("AddressBook/get", { accountId: "a0x9" });
		let cards = contacts.call("ContactCard/get", { accountId: "a0x9" });
		let card = unwrap(unwrap(await jmap.send(contacts)).get(cards)).list[0];

		expect(found.list[1]?.subject).toBe("The <mark>Foo</mark>sball competition");
		expect(list.map((entry) => entry.email)).toEqual(["joe@example.com", "*@example.com"]);
		expect(card?.addressBookIds).toEqual({ "062adcfa-105d-455c-bc60-6db68b69c3f3": true });
	});

	test("reads a call the response leaves unanswered as serverFail", async () => {
		serveSession();
		serveApi({ methodResponses: [], sessionState: "75128aab4b1b" });
		let batch = new Batch();
		let get = batch.call("Thread/get", { accountId: "acme", ids: ["f123u4"] });

		let result = unwrap(await client().send(batch)).get(get);

		expect(isFailure(result) && result.error.type).toBe("serverFail");
	});

	test("reads an unknownCapability problem", async () => {
		serveSession();
		server.use(
			http.post(SESSION.apiUrl, () =>
				HttpResponse.json(UNKNOWN_CAPABILITY, {
					status: 400,
					headers: { "Content-Type": "application/problem+json" },
				}),
			),
		);

		let result = await client().send(new Batch({ using: ["https://example.com/apis/foobar"] }));

		expect(isFailure(result) && result.error.type).toBe("unknownCapability");
		expect(isFailure(result) && result.error.message).toBe(UNKNOWN_CAPABILITY.detail);
	});

	test("reads a limit problem served as plain JSON, with the limit it names", async () => {
		serveSession();
		server.use(http.post(SESSION.apiUrl, () => HttpResponse.json(LIMIT, { status: 400 })));

		let result = await client().send(new Batch());

		expect(isFailure(result) && [result.error.code, result.error.type, result.error.limit]).toEqual(
			["problem", "limit", "maxSizeRequest"],
		);
	});

	test("rejects a 200 whose body is not a Response object", async () => {
		serveSession();
		serveApi({ methodResponses: [["Core/echo", {}]] });

		let result = await client().send(new Batch());

		expect(isFailure(result) && result.error.code).toBe("invalid-response");
	});
});

describe("blobs", () => {
	test("uploads to the expanded upload URL with the media type", async () => {
		serveSession();
		let seen = { type: null as string | null, body: "" };
		server.use(
			http.post("https://jmap.example.com/upload/A13824/", async ({ request }) => {
				seen.type = request.headers.get("Content-Type");
				seen.body = await request.text();
				return HttpResponse.json(
					{ accountId: "A13824", blobId: "Gc0854fd", type: "text/plain", size: 5 },
					{ status: 201 },
				);
			}),
		);

		let blob = unwrap(await client().upload("A13824", "hello", "text/plain"));

		expect(blob).toEqual({ accountId: "A13824", blobId: "Gc0854fd", type: "text/plain", size: 5 });
		expect(seen).toEqual({ type: "text/plain", body: "hello" });
	});

	test("downloads from the expanded download URL, encoding the type and name", async () => {
		serveSession();
		let seen = { url: "" };
		server.use(
			http.get("https://jmap.example.com/download/:accountId/:blobId/:name", ({ request }) => {
				seen.url = request.url;
				return new HttpResponse("hello", { headers: { "Content-Type": "text/plain" } });
			}),
		);

		let response = unwrap(
			await client().download({
				accountId: "A13824",
				blobId: "Gc0854fd",
				name: "hello world.txt",
				type: "text/plain",
			}),
		);

		expect(await response.text()).toBe("hello");
		expect(seen.url).toBe(
			"https://jmap.example.com/download/A13824/Gc0854fd/hello%20world.txt?accept=text%2Fplain",
		);
	});

	test("reads a missing blob's problem", async () => {
		serveSession();
		server.use(
			http.get("https://jmap.example.com/download/:accountId/:blobId/:name", () =>
				HttpResponse.json({ type: "about:blank", status: 404 }, { status: 404 }),
			),
		);

		let result = await client().download({
			accountId: "A13824",
			blobId: "missing",
			name: "a",
			type: "text/plain",
		});

		expect(isFailure(result) && [result.error.code, result.error.status]).toEqual(["problem", 404]);
	});

	test("fails with invalid-response when the Session's template is malformed", async () => {
		serveSession({ ...SESSION, uploadUrl: "https://jmap.example.com/upload/{accountId/" });

		let result = await client().upload("A13824", "hello", "text/plain");

		expect(isFailure(result) && result.error.code).toBe("invalid-response");
		expect(isFailure(result) && result.error.cause).toBeInstanceOf(UriTemplateError);
	});
});

describe("events", () => {
	test("streams StateChanges and pings from the expanded event-source URL", async () => {
		serveSession();
		let seen = { url: "", lastEventId: null as string | null, accept: null as string | null };
		server.use(
			http.get("https://jmap.example.com/eventsource/", ({ request }) => {
				seen.url = request.url;
				seen.lastEventId = request.headers.get("Last-Event-ID");
				seen.accept = request.headers.get("Accept");
				let body = [
					`event: state\ndata: ${JSON.stringify(STATE_CHANGE)}\nid: 4f2a\n\n`,
					'event: ping\ndata: {"interval":300}\n\n',
				].join("");
				return new HttpResponse(body, { headers: { "Content-Type": "text/event-stream" } });
			}),
		);

		let events = unwrap(
			await client().events({
				types: ["Email", "Mailbox"],
				closeAfter: "state",
				lastEventId: "4f29",
			}),
		);
		let received: PushEvent[] = [];
		for await (let event of events) received.push(event);

		expect(seen).toEqual({
			url: "https://jmap.example.com/eventsource/?types=Email%2CMailbox&closeafter=state&ping=300",
			lastEventId: "4f29",
			accept: "text/event-stream",
		});
		expect(received).toEqual([
			{ type: "state", id: "4f2a", change: STATE_CHANGE },
			{ type: "ping", interval: 300 },
		]);
	});

	test("subscribes to every type by default, with `*` encoded as simple expansion requires", async () => {
		serveSession();
		let seen = { url: "" };
		server.use(
			http.get("https://jmap.example.com/eventsource/", ({ request }) => {
				seen.url = request.url;
				return new HttpResponse("", { headers: { "Content-Type": "text/event-stream" } });
			}),
		);

		unwrap(await client().events({ ping: 0 }));

		expect(seen.url).toBe("https://jmap.example.com/eventsource/?types=%2A&closeafter=no&ping=0");
	});
});

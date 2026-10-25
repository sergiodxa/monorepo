/**
 * Covers RFC 8936 poll delivery: `answerPoll` over `MemorySetStore` answering the RFC's
 * request figures with its response figures, long polling, and the recipient's `pollSets`
 * and `verifyPolledSets` against MSW, ending with a full poll, verify and acknowledge loop.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { JWK, SecurityEventToken } from "@sdxc/jwt";
import { failure, isFailure, unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import type { SecurityEvents } from "../../security-events.js";

import {
	ACKNOWLEDGE_ONLY,
	CREATE_ID,
	DEFAULT_POLL,
	EMPTY_POLL_RESPONSE,
	INITIAL_POLL,
	PASSWORD_RESET_ID,
	POLL_RESPONSE,
	POLL_WITH_ACK,
	POLL_WITH_ERRORS,
} from "../../fixtures/security-events.js";

import { MemorySetStore } from "./memory-store.js";
import { answerPoll, pollSets, verifyPolledSets } from "./poll.js";

const ENDPOINT = "https://notify.idp.example.com/Events";
const STREAM = "rp-1";
const ISSUER = "https://scim.example.com";
const AUDIENCE = "https://scim.example.com/Feeds/98d52461fa5bbc879593b7754";

const server = setupServer();

let keys: JWK.KeyPair[];
let store: MemorySetStore;

beforeAll(async () => {
	server.listen({ onUnhandledRequest: "error" });
	keys = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256))];
});

beforeEach(async () => {
	store = new MemorySetStore();
	for (let [id, set] of Object.entries(POLL_RESPONSE.sets)) await store.add(STREAM, id, set);
});

afterEach(() => server.resetHandlers());

afterAll(() => server.close());

/**
 * A poll request carrying `body` as JSON.
 *
 * @param body - The poll request members
 */
function poll(body: unknown): Request {
	return new Request(ENDPOINT, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

/**
 * Answers `body` for {@link STREAM}, with long polls kept short.
 *
 * @param body - The poll request members
 */
function answer(body: unknown): Promise<Response> {
	return answerPoll(poll(body), { store, stream: STREAM, timeout: "200ms", interval: "10ms" });
}

/**
 * A signed SET for the recipient.
 *
 * @param id - Its `jti`
 */
function signedSet(id: string): Promise<string> {
	return SecurityEventToken.create({
		issuer: ISSUER,
		audience: AUDIENCE,
		id,
		events: { "urn:ietf:params:scim:event:prov:delete": {} },
	}).sign(JWK.Algorithm.ES256, keys);
}

describe("answerPoll", () => {
	test("answers RFC 8936 Figure 2, a default poll, with Figure 6", async () => {
		let response = await answer(DEFAULT_POLL);

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toContain("application/json");
		expect(await response.json()).toEqual(POLL_RESPONSE);
	});

	test("answers Figure 1 on an empty stream with Figure 7 at once", async () => {
		let started = Date.now();
		let response = await answerPoll(poll(INITIAL_POLL), {
			store: new MemorySetStore(),
			stream: STREAM,
			timeout: "10 seconds",
		});

		expect(await response.json()).toEqual(EMPTY_POLL_RESPONSE);
		expect(Date.now() - started).toBeLessThan(1000);
	});

	test("applies Figure 3's acknowledgements and returns no SETs", async () => {
		await store.add(STREAM, "later", "x.y.");

		let response = await answer(ACKNOWLEDGE_ONLY);

		expect(await response.json()).toEqual({ sets: {}, moreAvailable: true });
		expect(Object.keys(unwrap(await store.pending(STREAM)).sets)).toEqual(["later"]);
	});

	test("applies Figure 4's acknowledgements, then waits for the next SET", async () => {
		setTimeout(() => void store.add(STREAM, "next", "next.set."), 30);

		let response = await answer(POLL_WITH_ACK);

		expect(await response.json()).toEqual({ sets: { next: "next.set." } });
	});

	test("records Figure 5's errors and releases both SETs", async () => {
		let response = await answer(POLL_WITH_ERRORS);

		expect(await response.json()).toEqual(EMPTY_POLL_RESPONSE);
		expect(store.errors(STREAM)).toEqual(POLL_WITH_ERRORS.setErrs);
	});

	test("delivers an unacknowledged SET again", async () => {
		await answer(INITIAL_POLL);

		expect(await (await answer(INITIAL_POLL)).json()).toEqual(POLL_RESPONSE);
	});

	test("returns at most maxEvents SETs, oldest first, and says more are available", async () => {
		let response = await answer({ maxEvents: 1, returnImmediately: true });

		expect(await response.json()).toEqual({
			sets: { [CREATE_ID]: POLL_RESPONSE.sets[CREATE_ID] },
			moreAvailable: true,
		});
	});

	test("answers an empty long poll once the timeout passes", async () => {
		let started = Date.now();
		let response = await answer(POLL_WITH_ACK);

		expect(await response.json()).toEqual(EMPTY_POLL_RESPONSE);
		expect(Date.now() - started).toBeGreaterThanOrEqual(150);
	});

	test("ends a long poll when the recipient goes away", async () => {
		let controller = new AbortController();
		let request = new Request(poll({ ack: [CREATE_ID, PASSWORD_RESET_ID] }), {
			signal: controller.signal,
		});
		setTimeout(() => controller.abort(), 20);

		let response = await answerPoll(request, { store, stream: STREAM, timeout: "10 seconds" });

		expect(await response.json()).toEqual(EMPTY_POLL_RESPONSE);
	});

	test.each([
		["a negative maxEvents", { maxEvents: -1 }],
		["a fractional maxEvents", { maxEvents: 1.5 }],
		["an ack that is not a list", { ack: CREATE_ID }],
		["an error without err", { setErrs: { [CREATE_ID]: { description: "x" } } }],
		["a returnImmediately that is not a boolean", { returnImmediately: "true" }],
	])("answers 400 to %s", async (_, body) => {
		let response = await answer(body);

		expect(response.status).toBe(400);
		expect(Object.keys(unwrap(await store.pending(STREAM)).sets)).toHaveLength(2);
	});

	test("answers 400 to a body that is not JSON", async () => {
		let request = new Request(ENDPOINT, { method: "POST", body: "ack=1" });

		expect((await answerPoll(request, { store, stream: STREAM })).status).toBe(400);
	});

	test("answers 503 when the store fails", async () => {
		/** A store whose reads fail, as a database outage would. */
		class FailingStore extends MemorySetStore {
			override async pending(): Promise<Result<SecurityEvents.Batch, Error>> {
				return failure(new Error("database unavailable"));
			}
		}

		let response = await answerPoll(poll(INITIAL_POLL), {
			store: new FailingStore(),
			stream: STREAM,
		});

		expect(response.status).toBe(503);
	});

	test("keeps each stream's SETs apart", async () => {
		let response = await answerPoll(poll(INITIAL_POLL), { store, stream: "rp-2" });

		expect(await response.json()).toEqual(EMPTY_POLL_RESPONSE);
	});
});

describe("pollSets", () => {
	test("sends Figure 5 with Content-Language and reads Figure 6", async () => {
		let seen: Request | undefined;
		server.use(
			http.post(ENDPOINT, ({ request }) => {
				seen = request.clone();
				return HttpResponse.json(POLL_RESPONSE);
			}),
		);

		let batch = await pollSets(ENDPOINT, POLL_WITH_ERRORS, {
			headers: { Authorization: "Bearer t" },
		});

		expect(unwrap(batch)).toEqual({ ...POLL_RESPONSE, moreAvailable: false });
		expect(seen?.headers.get("Content-Type")).toBe("application/json");
		expect(seen?.headers.get("Content-Language")).toBe("en");
		expect(seen?.headers.get("Authorization")).toBe("Bearer t");
		expect(await seen?.json()).toEqual(POLL_WITH_ERRORS);
	});

	test("sends no Content-Language when it reports no errors", async () => {
		let seen: Request | undefined;
		server.use(
			http.post(ENDPOINT, ({ request }) => {
				seen = request.clone();
				return HttpResponse.json(EMPTY_POLL_RESPONSE);
			}),
		);

		await pollSets(ENDPOINT, INITIAL_POLL);

		expect(seen?.headers.get("Content-Language")).toBeNull();
	});

	test("reads RFC 8936 Figure 8, a bare 400, as a failed poll", async () => {
		server.use(http.post(ENDPOINT, () => new HttpResponse(null, { status: 400 })));

		let batch = await pollSets(ENDPOINT, { maxEvents: -1 });

		expect(isFailure(batch) && batch.error).toMatchObject({
			name: "TransmissionError",
			status: 400,
		});
	});

	test("reads a response without sets as malformed", async () => {
		server.use(http.post(ENDPOINT, () => HttpResponse.json({ moreAvailable: false })));

		let batch = await pollSets(ENDPOINT);

		expect(isFailure(batch) && batch.error).toMatchObject({
			name: "TransmissionError",
			status: 200,
		});
	});

	test("reads a network failure as no status", async () => {
		server.use(http.post(ENDPOINT, () => HttpResponse.error()));

		let batch = await pollSets(ENDPOINT);

		expect(isFailure(batch) && batch.error).toMatchObject({ status: null });
	});
});

describe("verifyPolledSets", () => {
	let options: SecurityEvents.VerifyOptions;
	beforeAll(() => {
		options = { issuers: { [ISSUER]: keys }, audience: AUDIENCE };
	});

	test("acknowledges the SETs it verifies", async () => {
		let polled = await verifyPolledSets({ "a-1": await signedSet("a-1") }, options);

		expect(polled.ack).toEqual(["a-1"]);
		expect(polled.events.map((event) => event.id)).toEqual(["a-1"]);
		expect(polled.setErrs).toEqual({});
	});

	test("reports Figure 6's unsigned SETs as invalid_key", async () => {
		let polled = await verifyPolledSets(POLL_RESPONSE.sets, {
			issuers: { [ISSUER]: keys },
			audience: AUDIENCE,
		});

		expect(polled.ack).toEqual([]);
		expect(Object.keys(polled.setErrs)).toEqual([CREATE_ID, PASSWORD_RESET_ID]);
		expect(polled.setErrs[CREATE_ID]?.err).toBe("invalid_key");
	});

	test("reports a SET filed under another jti as invalid_request", async () => {
		let polled = await verifyPolledSets({ "b-1": await signedSet("a-1") }, options);

		expect(polled.setErrs["b-1"]?.err).toBe("invalid_request");
		expect(polled.events).toEqual([]);
	});

	test("neither acknowledges nor refuses a SET whose keys cannot be read", async () => {
		let polled = await verifyPolledSets(
			{ "a-1": await signedSet("a-1") },
			{
				issuers: () => {
					throw new Error("JWKS fetch failed");
				},
				audience: AUDIENCE,
			},
		);

		expect(polled).toEqual({ events: [], ack: [], setErrs: {} });
	});
});

describe("a poll loop between both sides", () => {
	test("delivers, verifies and acknowledges until the stream is drained", async () => {
		let transmitter = new MemorySetStore();
		await transmitter.add(STREAM, "a-1", await signedSet("a-1"));
		await transmitter.add(STREAM, "a-2", await signedSet("a-2"));
		server.use(
			http.post(ENDPOINT, ({ request }) =>
				answerPoll(request, { store: transmitter, stream: STREAM, timeout: "50ms" }),
			),
		);

		let options = { issuers: { [ISSUER]: keys }, audience: AUDIENCE };
		let first = unwrap(await pollSets(ENDPOINT, { returnImmediately: true }));
		let { events, ack, setErrs } = await verifyPolledSets(first.sets, options);
		let second = unwrap(await pollSets(ENDPOINT, { ack, setErrs, returnImmediately: true }));

		expect(events.map((event) => event.id)).toEqual(["a-1", "a-2"]);
		expect(second).toEqual({ sets: {}, moreAvailable: false });
		expect(unwrap(await transmitter.pending(STREAM)).sets).toEqual({});
	});
});

/**
 * Runs the shared conformance suite against the Buttondown provider, backed by
 * MSW handlers that model Buttondown's documented subscriber API as state, so
 * each contract rule is checked against the behavior the platform describes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Hex, hmac } from "@sdxc/crypto";
import { unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";

import type { Newsletter } from "../contract.js";
import type { ConfirmationPolicy } from "../memory.js";
import type { Subscriber } from "../types.js";

import { conformance } from "../conformance.js";

import { API_VERSION, ButtondownNewsletter } from "./index.js";

/** Buttondown's API root as the handlers match it. */
const API = "https://api.buttondown.com/v1";

/** API key the modeled account accepts. */
const API_KEY = "conformance-key";

/** Signing key configured on the modeled webhook. */
const WEBHOOK_SECRET = "conformance-webhook-secret";

/** Page size Buttondown serves when a request names none. */
const DEFAULT_PAGE_SIZE = 100;

/** Types Buttondown refuses to move a subscriber out of through the API. */
const TERMINAL_TYPES: ReadonlySet<string> = new Set(["blocked", "complained", "undeliverable"]);

/** A subscriber as the modeled account stores it. */
interface StoredRecord {
	id: string;
	email_address: string;
	type: string;
	creation_date: string;
	tags: string[];
	metadata: Record<string, unknown>;
}

/** The modeled account's subscribers, emptied by every `create()`. */
const RECORDS: StoredRecord[] = [];

/** Issues a TypeID-shaped subscriber id. */
function nextId(): string {
	return `sub_${crypto.randomUUID().replaceAll("-", "").slice(0, 26)}`;
}

/** Finds a record the way Buttondown resolves `{id_or_email}`: by id, or by address ignoring case. */
function lookup(idOrEmail: string): StoredRecord | undefined {
	let key = idOrEmail.toLowerCase();
	return RECORDS.find(
		(record) => record.id === idOrEmail || record.email_address.toLowerCase() === key,
	);
}

/** Buttondown's 404 body. */
function notFound(): Response {
	return HttpResponse.json({ code: "not_found", detail: "Not found." }, { status: 404 });
}

/** Refuses a request lacking the key or the pinned version, as a misconfigured client would be. */
function refuse(request: Request): Response | null {
	if (request.headers.get("authorization") !== `Token ${API_KEY}`) {
		return HttpResponse.json({ detail: "Invalid token." }, { status: 401 });
	}

	if (request.headers.get("x-api-version") !== API_VERSION) {
		return HttpResponse.json({ detail: "Unexpected API version." }, { status: 400 });
	}

	return null;
}

/** The handlers modeling Buttondown's subscriber endpoints over {@link RECORDS}. */
const HANDLERS = [
	http.post(`${API}/subscribers`, async ({ request }) => {
		let refused = refuse(request);
		if (refused) return refused;

		if (request.headers.has("x-buttondown-collision-behavior")) {
			return HttpResponse.json({ detail: "collision header sent" }, { status: 500 });
		}

		let body = (await request.json()) as Record<string, unknown>;
		let address = typeof body["email_address"] === "string" ? body["email_address"] : "";

		if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(address)) {
			return HttpResponse.json(
				{ code: "email_invalid", detail: "That email address is invalid." },
				{ status: 400 },
			);
		}

		if (lookup(address) !== undefined) {
			return HttpResponse.json(
				{ code: "email_already_exists", detail: "That email address is already subscribed." },
				{ status: 400 },
			);
		}

		let record: StoredRecord = {
			id: nextId(),
			email_address: address,
			type: typeof body["type"] === "string" ? body["type"] : "regular",
			creation_date: new Date().toISOString(),
			tags: Array.isArray(body["tags"]) ? body["tags"].map(String) : [],
			metadata: (body["metadata"] as Record<string, unknown> | undefined) ?? {},
		};

		RECORDS.push(record);
		return HttpResponse.json(record, { status: 201 });
	}),

	http.get(`${API}/subscribers`, ({ request }) => {
		let refused = refuse(request);
		if (refused) return refused;

		let url = new URL(request.url);
		let page = Number(url.searchParams.get("page") ?? "1");
		let size = Number(url.searchParams.get("page_size") ?? DEFAULT_PAGE_SIZE);
		let types = url.searchParams.getAll("type");
		let tags = url.searchParams.getAll("tag");

		let matching = RECORDS.filter(
			(record) =>
				(types.length === 0 || types.includes(record.type)) &&
				tags.every((tag) => record.tags.includes(tag)),
		);

		let start = (page - 1) * size;
		let hasNext = start + size < matching.length;

		if (start > 0 && start >= matching.length) return notFound();

		return HttpResponse.json({
			results: matching.slice(start, start + size),
			next: hasNext ? `${API}/subscribers?page=${page + 1}` : null,
			previous: page > 1 ? `${API}/subscribers?page=${page - 1}` : null,
			count: matching.length,
		});
	}),

	http.get(`${API}/subscribers/:idOrEmail`, ({ request, params }) => {
		let refused = refuse(request);
		if (refused) return refused;

		let record = lookup(String(params["idOrEmail"]));
		return record === undefined ? notFound() : HttpResponse.json(record);
	}),

	http.patch(`${API}/subscribers/:idOrEmail`, async ({ request, params }) => {
		let refused = refuse(request);
		if (refused) return refused;

		let record = lookup(String(params["idOrEmail"]));
		if (record === undefined) return notFound();

		let body = (await request.json()) as Record<string, unknown>;

		if (typeof body["type"] === "string" && body["type"] !== record.type) {
			if (TERMINAL_TYPES.has(record.type)) {
				return HttpResponse.json(
					{ code: "subscriber_type_invalid", detail: "That type cannot be changed." },
					{ status: 400 },
				);
			}
			record.type = body["type"];
		}

		if (Array.isArray(body["tags"])) record.tags = body["tags"].map(String);
		if (body["metadata"] !== undefined) {
			record.metadata = body["metadata"] as Record<string, unknown>;
		}

		return HttpResponse.json(record);
	}),
];

let server = setupServer(...HANDLERS);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Signs a delivery about `subscriber` exactly as Buttondown would. */
async function deliver(_provider: Newsletter, subscriber: Subscriber) {
	let body = JSON.stringify({
		id: `ext_evt_${crypto.randomUUID().replaceAll("-", "")}`,
		event_type: "subscriber.confirmed",
		data: { subscriber: subscriber.id },
	});
	let signature = Hex.encode(unwrap(await hmac.sign(WEBHOOK_SECRET, body)));

	return {
		body,
		request: new Request("https://books.sergiodxa.com/webhooks/buttondown", {
			method: "POST",
			headers: { "X-Buttondown-Signature": `sha256=${signature}` },
			body,
		}),
	};
}

/** Registers the suite for one confirmation policy, each test starting from an empty account. */
function run(confirmation: ConfirmationPolicy): void {
	conformance({
		name: `ButtondownNewsletter (${confirmation} opt-in)`,
		confirmation,
		create: () => {
			RECORDS.length = 0;
			return new ButtondownNewsletter({
				apiKey: API_KEY,
				webhookSecret: WEBHOOK_SECRET,
				confirmation,
			});
		},
		createWithoutSecret: () => new ButtondownNewsletter({ apiKey: API_KEY, confirmation }),
		deliver,
	});
}

run("double");
run("single");

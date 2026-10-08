/**
 * The suite that says what a newsletter provider is: every rule of the
 * contract, registered as Vitest tests against whatever the caller constructs,
 * so the memory provider and each network provider are held to one behavior.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EmailAddress } from "@sdxc/email-address";

import { parseEmailAddress } from "@sdxc/email-address";
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Newsletter } from "./contract.js";
import type { ConfirmationPolicy } from "./memory.js";
import type { Subscriber } from "./types.js";

/** Readers the paging assertion creates, one more than a page holds. */
const PAGED_READERS = 3;

/** Page size the paging assertion asks for, small enough to force a second page. */
const SMALL_PAGE = 2;

/** Pages a walk follows before it gives up, so a populated list cannot hang a run. */
const MAX_WALKED_PAGES = 50;

/** A delivery the platform would send, as the endpoint receives it. */
export interface ConformanceDelivery {
	request: Request;
	/** Exact body text the signature covers. */
	body: string;
}

/** What the suite needs to exercise a provider. */
export interface ConformanceOptions {
	/** Provider name, which labels the registered suite. */
	name: string;

	/**
	 * Builds the provider under test. It is called for every test, so a provider
	 * backed by mutable state starts each one clean.
	 */
	create(): Newsletter | Promise<Newsletter>;

	/** Builds the same provider with no webhook secret configured. */
	createWithoutSecret(): Newsletter | Promise<Newsletter>;

	/** The policy `create()` configures, which decides a new reader's status. */
	confirmation: ConfirmationPolicy;

	/**
	 * Signs a delivery about `subscriber` exactly as the platform would, with the
	 * secret `create()` configured.
	 */
	deliver(provider: Newsletter, subscriber: Subscriber): Promise<ConformanceDelivery>;

	/**
	 * Two metadata keys the platform accepts. A platform whose keys must exist
	 * before a value is written names two that do.
	 *
	 * @default ["first_source", "last_source"]
	 */
	metadataKeys?: readonly [string, string];

	/** An id well-formed for the platform that names no reader on it. */
	missingId?: string;

	/** Builds an unused address; the default is unique per call. */
	email?(): string;
}

/** Unique enough that two runs against one list stay distinct. */
function uniqueSuffix(): string {
	return crypto.randomUUID().replaceAll("-", "").slice(0, 12);
}

/** Parses the next unused address, which the suite's own factory guarantees is valid. */
function nextEmail(options: ConformanceOptions): EmailAddress {
	return unwrap(
		parseEmailAddress(options.email?.() ?? `conformance-${uniqueSuffix()}@example.com`),
	);
}

/**
 * Registers the contract's rules as one `describe` block named after the provider.
 *
 * @param options - How to build the provider and sign its deliveries.
 * @example
 * conformance({ name: "MemoryNewsletter", create, createWithoutSecret, confirmation: "double", deliver });
 */
export function conformance(options: ConformanceOptions): void {
	let [firstKey, secondKey] = options.metadataKeys ?? ["first_source", "last_source"];

	describe(`${options.name} conformance`, () => {
		test("a second subscribe of an address answers it unchanged with created false", async () => {
			let newsletter = await options.create();
			let email = nextEmail(options);

			let first = await unwrap(
				newsletter.subscribers.subscribe({
					email,
					tags: ["original"],
					metadata: { [firstKey]: "first" },
				}),
			);

			let second = await unwrap(
				newsletter.subscribers.subscribe({
					email,
					tags: ["later"],
					metadata: { [firstKey]: "second" },
				}),
			);

			expect(first.created).toBe(true);
			expect(second.created).toBe(false);
			expect(second.subscriber.id).toBe(first.subscriber.id);
			expect(second.subscriber.metadata[firstKey]).toBe("first");
			expect(await unwrap(newsletter.subscribers.tags({ id: first.subscriber.id }))).toEqual([
				"original",
			]);
		});

		test("a new subscriber's status follows the configured confirmation", async () => {
			let newsletter = await options.create();
			let outcome = await unwrap(newsletter.subscribers.subscribe({ email: nextEmail(options) }));

			expect(outcome.subscriber.status).toBe(
				options.confirmation === "double" ? "pending" : "active",
			);
		});

		test("find by id and by email agree", async () => {
			let newsletter = await options.create();
			let email = nextEmail(options);
			let { subscriber } = await unwrap(newsletter.subscribers.subscribe({ email }));

			let byId = await unwrap(newsletter.subscribers.find({ id: subscriber.id }));
			let byEmail = await unwrap(newsletter.subscribers.find({ email }));

			expect(byId).toEqual(byEmail);
			expect(byId.email.toLowerCase()).toBe(email.canonical);
		});

		test("a reader the list does not hold is not_found", async () => {
			let newsletter = await options.create();

			let byEmail = await newsletter.subscribers.find({ email: nextEmail(options) });
			let byId = await newsletter.subscribers.find({ id: options.missingId ?? "sub_missing" });

			expect(isFailure(byEmail) && byEmail.error.code).toBe("not_found");
			expect(isFailure(byId) && byId.error.code).toBe("not_found");
		});

		test("tags added and removed by name read back through tags", async () => {
			let newsletter = await options.create();
			let { subscriber } = await unwrap(
				newsletter.subscribers.subscribe({ email: nextEmail(options) }),
			);
			let ref = { id: subscriber.id };

			await unwrap(newsletter.subscribers.update(ref, { tags: { add: ["buyer", "early"] } }));
			await unwrap(newsletter.subscribers.update(ref, { tags: { remove: ["early"] } }));
			await unwrap(newsletter.subscribers.update(ref, { tags: { add: ["buyer"] } }));

			expect(await unwrap(newsletter.subscribers.tags(ref))).toEqual(["buyer"]);
		});

		test("list by tag answers only the readers carrying it", async () => {
			let newsletter = await options.create();
			let tag = `tag-${uniqueSuffix()}`;
			let tagged = await unwrap(newsletter.subscribers.subscribe({ email: nextEmail(options) }));
			await unwrap(newsletter.subscribers.subscribe({ email: nextEmail(options) }));

			await unwrap(
				newsletter.subscribers.update({ id: tagged.subscriber.id }, { tags: { add: [tag] } }),
			);

			let page = await unwrap(newsletter.subscribers.list({ tag }));

			expect(page.items.map((item) => item.id)).toEqual([tagged.subscriber.id]);
		});

		test("metadata merges and a null value removes its key", async () => {
			let newsletter = await options.create();
			let { subscriber } = await unwrap(
				newsletter.subscribers.subscribe({ email: nextEmail(options) }),
			);
			let ref = { id: subscriber.id };

			await unwrap(
				newsletter.subscribers.update(ref, { metadata: { [firstKey]: "a", [secondKey]: "b" } }),
			);
			let updated = await unwrap(
				newsletter.subscribers.update(ref, { metadata: { [firstKey]: null } }),
			);

			expect(updated.metadata[firstKey]).toBeUndefined();
			expect(updated.metadata[secondKey]).toBe("b");
			expect((await unwrap(newsletter.subscribers.find(ref))).metadata[secondKey]).toBe("b");
		});

		test("unsubscribe is idempotent and a later subscribe leaves the reader unsubscribed", async () => {
			let newsletter = await options.create();
			let email = nextEmail(options);
			let { subscriber } = await unwrap(newsletter.subscribers.subscribe({ email }));

			let first = await unwrap(newsletter.subscribers.unsubscribe({ email }));
			let second = await unwrap(newsletter.subscribers.unsubscribe({ id: subscriber.id }));
			let again = await unwrap(newsletter.subscribers.subscribe({ email }));

			expect(first.status).toBe("unsubscribed");
			expect(second.status).toBe("unsubscribed");
			expect(again.created).toBe(false);
			expect(again.subscriber.status).toBe("unsubscribed");
		});

		test("a cursor walk reaches every subscriber", async () => {
			let newsletter = await options.create();
			let created = new Set<string>();

			for (let index = 0; index < PAGED_READERS; index += 1) {
				let outcome = await unwrap(newsletter.subscribers.subscribe({ email: nextEmail(options) }));
				created.add(outcome.subscriber.id);
			}

			let seen = new Set<string>();
			let cursor: string | undefined;

			for (let pages = 0; pages < MAX_WALKED_PAGES; pages += 1) {
				let page = await unwrap(newsletter.subscribers.list({ limit: SMALL_PAGE, cursor }));
				for (let item of page.items) seen.add(item.id);
				if (page.cursor === null) break;
				cursor = page.cursor;
			}

			for (let id of created) expect(seen.has(id)).toBe(true);
		});

		test("an authentic delivery verifies and normalizes to events", async () => {
			let newsletter = await options.create();
			let { subscriber } = await unwrap(
				newsletter.subscribers.subscribe({ email: nextEmail(options) }),
			);
			let delivery = await options.deliver(newsletter, subscriber);

			expect(await newsletter.webhooks.verify(delivery.request, delivery.body)).toBe(true);

			let events = unwrap(newsletter.webhooks.events(delivery.request, delivery.body));

			expect(events.length).toBeGreaterThan(0);
			for (let event of events) {
				expect(event.id).not.toBe("");
				expect(event.subscriberId).toBe(subscriber.id);
			}
		});

		test("a tampered delivery is unproven", async () => {
			let newsletter = await options.create();
			let { subscriber } = await unwrap(
				newsletter.subscribers.subscribe({ email: nextEmail(options) }),
			);
			let delivery = await options.deliver(newsletter, subscriber);

			expect(await newsletter.webhooks.verify(delivery.request, `${delivery.body} `)).toBe(false);
		});

		test("with no secret configured every delivery is unproven", async () => {
			let newsletter = await options.create();
			let { subscriber } = await unwrap(
				newsletter.subscribers.subscribe({ email: nextEmail(options) }),
			);
			let delivery = await options.deliver(newsletter, subscriber);
			let unsigned = await options.createWithoutSecret();

			expect(await unsigned.webhooks.verify(delivery.request, delivery.body)).toBe(false);
		});
	});
}

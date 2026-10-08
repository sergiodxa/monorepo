/**
 * Runs the conformance suite against the memory provider and tests what it adds
 * beyond the contract: seeding, confirmation, scripted faults, recorded
 * attribution, and lookups that compare addresses canonically.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parseEmailAddress } from "@sdxc/email-address";
import { IP } from "@sdxc/ip";
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Newsletter } from "./contract.js";
import type { Subscriber } from "./types.js";

import { conformance } from "./conformance.js";
import { MemoryNewsletter } from "./memory.js";

/** Signs a delivery through the provider's own emitter, which is how the platform would. */
async function deliver(provider: Newsletter, subscriber: Subscriber) {
	let memory = provider as MemoryNewsletter;
	return unwrap(
		await memory.webhooks.emit({ type: "subscriber.confirmed", subscriberId: subscriber.id }),
	);
}

conformance({
	name: "MemoryNewsletter (double opt-in)",
	create: () => new MemoryNewsletter(),
	createWithoutSecret: () => new MemoryNewsletter({ webhookSecret: "" }),
	confirmation: "double",
	deliver,
});

conformance({
	name: "MemoryNewsletter (single opt-in)",
	create: () => new MemoryNewsletter({ confirmation: "single" }),
	createWithoutSecret: () => new MemoryNewsletter({ confirmation: "single", webhookSecret: "" }),
	confirmation: "single",
	deliver,
});

describe("MemoryNewsletter", () => {
	test("finds a reader by an address differing only in local-part case", async () => {
		let newsletter = new MemoryNewsletter();
		newsletter.seed([{ email: "Reader@example.com" }]);

		let found = await unwrap(
			newsletter.subscribers.find({ email: unwrap(parseEmailAddress("reader@EXAMPLE.com")) }),
		);

		expect(found.email).toBe("Reader@example.com");
		expect(found.status).toBe("active");
	});

	test("confirm moves a pending reader to active", async () => {
		let newsletter = new MemoryNewsletter();
		let email = unwrap(parseEmailAddress("reader@example.com"));
		await unwrap(newsletter.subscribers.subscribe({ email }));

		expect(unwrap(newsletter.confirm("reader@example.com")).status).toBe("active");
		expect((await unwrap(newsletter.subscribers.find({ email }))).status).toBe("active");
	});

	test("records the attribution and visitor address of a reader it created", async () => {
		let newsletter = new MemoryNewsletter();

		await unwrap(
			newsletter.subscribers.subscribe({
				email: unwrap(parseEmailAddress("reader@example.com")),
				attribution: { source: "twitter", campaign: "launch" },
				ip: unwrap(IP.parse("203.0.113.9")),
			}),
		);

		expect(newsletter.attribution("reader@example.com")).toEqual({
			source: "twitter",
			campaign: "launch",
		});
		expect(newsletter.ip("reader@example.com")?.toString()).toBe("203.0.113.9");
	});

	test("an armed fault fails its method until healed", async () => {
		let newsletter = new MemoryNewsletter({ faults: { "subscribers.subscribe": "suppressed" } });
		let email = unwrap(parseEmailAddress("reader@example.com"));

		let refused = await newsletter.subscribers.subscribe({ email });
		expect(isFailure(refused) && refused.error.code).toBe("suppressed");

		newsletter.fail("subscribers", "rate_limited");
		let limited = await newsletter.subscribers.find({ email });
		expect(isFailure(limited) && limited.error.retryable).toBe(true);

		newsletter.heal();
		expect((await unwrap(newsletter.subscribers.subscribe({ email }))).created).toBe(true);
	});

	test("an emitted delivery carries the subscriber's current record", async () => {
		let newsletter = new MemoryNewsletter();
		let [reader] = newsletter.seed([{ email: "reader@example.com", metadata: { tier: "pro" } }]);

		let delivery = await unwrap(
			newsletter.webhooks.emit({ type: "subscriber.updated", subscriberId: reader?.id ?? "" }),
		);

		expect(delivery.events[0]?.subscriber?.metadata).toEqual({ tier: "pro" });
	});

	test("an event type outside the contract arrives as unrecognized", async () => {
		let newsletter = new MemoryNewsletter();

		let delivery = await unwrap(
			newsletter.webhooks.emit({
				type: "unrecognized",
				providerType: "subscriber.reactivated",
				subscriberId: "sub_9",
			}),
		);

		expect(delivery.events[0]).toMatchObject({
			type: "unrecognized",
			providerType: "subscriber.reactivated",
			subscriberId: "sub_9",
			subscriber: null,
		});
	});
});

/**
 * The contract half of every provider's tests, registered as Vitest tests against
 * whatever the caller constructs: the capabilities it declares work, a foreign ref
 * fails before any request, and a rate limit is retryable with the delay it named.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Destination, OptionalCapability, SentRef } from "./destination.js";
import type { Message } from "./message.js";

import { supports } from "./destination.js";

/** The capabilities the suite checks, in a stable order. */
const CAPABILITIES: readonly OptionalCapability[] = ["update", "reply"];

/** A message every provider accepts, incident providers included. */
const DEFAULT_MESSAGE: Message = {
	title: "Conformance check",
	text: "A **conformance** message with a [link](https://example.com/).",
	severity: "warning",
	fields: [{ label: "Field", value: "Value", inline: true }],
	links: [{ label: "Open", url: "https://example.com/" }],
	timestamp: new Date("2026-10-06T12:00:00.000Z"),
	key: "conformance",
	state: "open",
	data: { check: true },
};

/** What the suite needs to exercise a destination. */
export interface ConformanceOptions {
	/** Labels the registered suite. */
	name: string;
	/** Builds the destination under test, once per test. */
	create(): Destination | Promise<Destination>;
	/** The optional methods the destination must declare, and no others. */
	capabilities: readonly OptionalCapability[];
	/**
	 * Arranges for the next request to answer a rate limit asking for `delayMs`, the way
	 * the platform does: an MSW handler for an HTTP provider, `failNext` for memory.
	 */
	rateLimitNext(delayMs: number): void;
	/** A message the destination accepts. @default a warning with every field set */
	message?: Message;
}

/**
 * Registers the contract suite for one destination.
 *
 * @param options - How to build the destination and script its platform.
 * @example describeDestination({ name: "memory", create: () => new MemoryDestination(), capabilities: [], rateLimitNext: … });
 */
export function describeDestination(options: ConformanceOptions): void {
	let message = options.message ?? DEFAULT_MESSAGE;

	describe(`${options.name} conformance`, () => {
		test("names its provider", async () => {
			let destination = await options.create();
			expect(destination.provider).toMatch(/\S/u);
		});

		test("sends a message and answers its own ref, or none", async () => {
			let destination = await options.create();
			let sent = await destination.send(message);
			expect(sent).toMatchObject({ status: "success" });
			if (!isSuccess(sent) || sent.data.ref === null) return;
			expect(sent.data.ref.provider).toBe(destination.provider);
		});

		test("declares exactly its capabilities", async () => {
			let destination = await options.create();
			let declared = CAPABILITIES.filter((capability) => supports(destination, capability));
			expect(declared).toEqual(CAPABILITIES.filter((c) => options.capabilities.includes(c)));
		});

		for (let capability of options.capabilities) {
			test(`${capability} works on a ref it answered`, async () => {
				let destination = await options.create();
				let sent = await destination.send(message);
				if (!isSuccess(sent)) throw sent.error;
				expect(sent.data.ref).not.toBeNull();
				if (sent.data.ref === null) return;

				let followed = await call(destination, capability, sent.data.ref, message);
				expect(followed).toMatchObject({ status: "success" });
			});

			test(`${capability} fails invalid-ref for another provider's ref`, async () => {
				let destination = await options.create();
				let foreign: SentRef = { provider: `not-${destination.provider}`, id: "1" };
				let followed = await call(destination, capability, foreign, message);
				expect(isFailure(followed) && followed.error.code).toBe("invalid-ref");
			});
		}

		test("answers a rate limit as retryable, with the delay the platform asked", async () => {
			let destination = await options.create();
			options.rateLimitNext(30_000);
			let sent = await destination.send(message);
			expect(isFailure(sent)).toBe(true);
			if (!isFailure(sent)) return;
			expect(sent.error.code).toBe("rate-limited");
			expect(sent.error.retryable).toBe(true);
			expect(sent.error.retryAfter).toBe(30_000);
			expect(sent.error.provider).toBe(destination.provider);
		});
	});
}

/** Calls an optional method the destination declares. */
async function call(
	destination: Destination,
	capability: OptionalCapability,
	ref: SentRef,
	message: Message,
) {
	if (!supports(destination, capability)) throw new Error(`${capability} is not declared`);
	return await destination[capability](ref, message);
}

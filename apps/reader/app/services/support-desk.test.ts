/**
 * Tests the support desk: a deployment without an email binding refuses rather than
 * pretending to send, and a limiter that cannot answer admits the sender.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { createSpamFilter } from "@sdxc/spam";
import { describe, expect, test } from "vitest";

import { SupportDesk } from "~/app/services/support-desk";

/** A message a person would send. */
const INPUT = {
	name: "Ada",
	email: "ada@example.com",
	topic: "question" as const,
	page: "",
	message: "How do I import my feeds?",
};

describe("SupportDesk", () => {
	test("refuses to deliver on a deployment with no email binding", async () => {
		let desk = new SupportDesk({
			transport: undefined,
			from: undefined,
			limiter: undefined,
			spamFilter: createSpamFilter({ checks: [] }),
		});

		let delivered = await desk.deliver(INPUT, { signedIn: false });

		expect(isFailure(delivered) && delivered.error.reason).toBe("unconfigured");
	});

	test("admits every sender when no limiter is bound", async () => {
		let desk = new SupportDesk({
			transport: undefined,
			from: undefined,
			limiter: undefined,
			spamFilter: createSpamFilter({ checks: [] }),
		});

		expect(await desk.admit("203.0.113.7")).toBe(true);
	});
});

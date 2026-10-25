/**
 * The `cloudflare:workers` stand-in Vitest resolves: a Durable Object class extends its
 * `DurableObject` and runs against a mock state, as the Worker runtime would construct it.
 */

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { DurableObject, env } from "cloudflare:workers";
import { describe, expect, test } from "vitest";

/** A counter in the shape `sdxc make do` writes, with storage of its own. */
class CounterDO extends DurableObject<Cloudflare.Env> {
	/** Counts one more and answers the total. */
	async increment(): Promise<number> {
		let count = ((await this.ctx.storage.get<number>("count")) ?? 0) + 1;
		await this.ctx.storage.put("count", count);
		return count;
	}
}

describe("DurableObject", () => {
	test("lets a class extending it run against a mock state", async () => {
		let counter = new CounterDO(createDurableObjectState(), env);

		expect(await counter.increment()).toBe(1);
		expect(await counter.increment()).toBe(2);
	});
});

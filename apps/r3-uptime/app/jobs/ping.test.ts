/**
 * Unit tests for `PingJob.perform`: invalid input is rejected non-retriably, a team
 * owner without an active subscription is skipped without starting a check, and an
 * active subscription starts the `PING` workflow via `Monitor.ping`. The `PING`
 * workflow binding is stubbed via `mock.module("cloudflare:workers", ...)`, and
 * `Customer.hasActiveSubscription` is exercised through a fake `PolarClient` registered
 * in the service container rather than a real Polar API call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";

/** One recorded `PING.create` call. */
let pingCreateCalls: Array<{ id: string; params: unknown }> = [];
let pingCreateMock = mock(async (options: { id: string; params: unknown }) => {
	pingCreateCalls.push(options);
	return { id: options.id };
});

mock.module("cloudflare:workers", () => ({
	env: { PING: { create: pingCreateMock } },
}));

let { Job } = await import("@pkg/jobs");
let { BatchedLogger } = await import("@pkg/logger");
let { PolarClient } = await import("@pkg/polar");
let { ServiceContainer } = await import("@pkg/service-container");
let { PingJob } = await import("./ping");

/** Builds a container with a fake `PolarClient` whose `hasActiveSubscription` is stubbed. */
function makeContainer(hasActiveSubscription: boolean) {
	let container = new ServiceContainer();
	container.singleton(PolarClient, () => {
		let client = new PolarClient({ accessToken: "t" });
		(
			client as unknown as {
				hasActiveSubscription: InstanceType<typeof PolarClient>["hasActiveSubscription"];
			}
		).hasActiveSubscription = async () => hasActiveSubscription;
		return client;
	});
	return container;
}

describe("PingJob.perform", () => {
	beforeEach(() => {
		pingCreateCalls = [];
		pingCreateMock.mockClear();
	});

	test("throws Job.NonRetriableError on invalid input", async () => {
		let job = new PingJob({ logger: new BatchedLogger("test") }, { monitorId: "monitor-1" });

		await expect(job.perform()).rejects.toThrow(Job.NonRetriableError);
		expect(pingCreateMock).not.toHaveBeenCalled();
	});

	test("skips without pinging when the owner has no active subscription", async () => {
		let logger = new BatchedLogger("test");
		let job = new PingJob({ logger }, { monitorId: "monitor-1", ownerId: "owner-1" });

		await makeContainer(false).scope(() => job.perform());

		expect(pingCreateMock).not.toHaveBeenCalled();
		let event = logger.events.find((entry) => entry.event === "job.ping.skipped");
		expect(event).toBeDefined();
		expect(event?.reason).toBe("no_subscription");
	});

	test("starts the PING workflow when the owner has an active subscription", async () => {
		let logger = new BatchedLogger("test");
		let job = new PingJob({ logger }, { monitorId: "monitor-1", ownerId: "owner-1" });

		await makeContainer(true).scope(() => job.perform());

		expect(pingCreateMock).toHaveBeenCalledTimes(1);
		let call = pingCreateCalls[0]!;
		expect(call.id).toMatch(/^monitor-1-\d+$/);
		expect(call.params).toEqual({ monitorId: "monitor-1" });

		let event = logger.events.find((entry) => entry.event === "job.ping.triggering");
		expect(event?.monitorId).toBe("monitor-1");
	});
});

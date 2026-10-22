/**
 * Unit tests for `ingestFlowRuns`, the path a browser flow takes to the flow-run meter.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Billing, UsageEvent } from "@sdxc/billing";

import { describe, expect, test, vi } from "vite-plus/test";

import type { BillableFlowRun } from "~/app/services/flow-run-meter";

import { FLOW_RUN_METER } from "~/app/initializers/billing";
import { ingestFlowRuns } from "~/app/services/flow-run-meter";
import { createTestBilling } from "~/app/test/billing";

vi.spyOn(console, "error").mockImplementation(() => {});

function createRecordingBilling(accepted = true) {
	let billing = createTestBilling();
	let calls: UsageEvent[][] = [];

	let recording: Billing = billing.with({
		usage: {
			async ingest(events: readonly UsageEvent[]) {
				calls.push([...events]);
				if (!accepted) return await billing.usage.ingest([{ name: "", customer: { id: "x" } }]);

				return await billing.usage.ingest(events);
			},
			list: (query) => billing.usage.list(query),
		},
	});

	return { billing: recording, calls };
}

function run(overrides: Partial<BillableFlowRun> = {}): BillableFlowRun {
	return {
		externalId: "flow_run:result-1",
		ownerId: "owner-1",
		teamId: "team-1",
		monitorId: "monitor-1",
		durationSeconds: 15,
		...overrides,
	};
}

describe("ingestFlowRuns", () => {
	test("builds one event per run in the shape the meter reads", async () => {
		let { billing, calls } = createRecordingBilling();

		let accepted = await ingestFlowRuns(billing, [run()]);

		expect(accepted).toBe(true);
		expect(calls).toHaveLength(1);
		expect(calls[0]).toEqual([
			{
				name: "flow_run",
				customer: { externalId: "owner-1" },
				externalId: "flow_run:result-1",
				metadata: {
					teamId: "team-1",
					monitorId: "monitor-1",
					type: "flow",
					durationSeconds: 15,
				},
			},
		]);
	});

	test("names the event the meter matches on", async () => {
		let { billing, calls } = createRecordingBilling();

		await ingestFlowRuns(billing, [run()]);

		expect(FLOW_RUN_METER).toBe("flow_run");
		expect(calls[0]?.[0]?.name).toBe(FLOW_RUN_METER);
	});

	test("an empty batch is a no-op", async () => {
		let { billing, calls } = createRecordingBilling();

		expect(await ingestFlowRuns(billing, [])).toBe(true);
		expect(calls).toHaveLength(0);
	});
});

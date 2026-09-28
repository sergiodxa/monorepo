/**
 * Tests the Worker's `scheduled` handler: a worker deployed without `GITHUB_TOKEN`
 * records the skip and leaves the cached sponsor list alone, and a worker with a
 * token refreshes the list with it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createLogger } from "@sdxc/logger";
import { beforeEach, describe, expect, test, vi } from "vitest";

/** The records the cron's logger wrote during the current test. */
let records: Record<string, unknown>[] = [];

/** Stands in for the GitHub read so the test observes which token it receives. */
let refreshSponsors = vi.fn(async (_cache: unknown, _token: string) => []);

vi.doMock("./logger", () => ({
	logger: createLogger({ service: "sdxc", sink: (record) => void records.push(record) }),
}));
vi.doMock("~/app/services/sponsors", () => ({ refreshSponsors }));

let { default: worker } = await import("./worker");

beforeEach(() => {
	records = [];
	refreshSponsors.mockClear();
});

describe("scheduled", () => {
	test("skips the sponsor refresh when the worker has no GitHub token", async () => {
		let env = {} as Cloudflare.Env;

		await worker.scheduled({} as ScheduledController, env);

		expect(refreshSponsors).not.toHaveBeenCalled();
		expect(records).toHaveLength(1);
		expect(records[0]).toMatchObject({ kind: "cron", skipped: "missing_token" });
	});

	test("refreshes the sponsors with the worker's GitHub token", async () => {
		let env = { GITHUB_TOKEN: "token" } as Cloudflare.Env;

		await worker.scheduled({} as ScheduledController, env);

		expect(refreshSponsors).toHaveBeenCalledWith(expect.anything(), "token");
		expect(records[0]).toMatchObject({ kind: "cron", count: 0 });
	});
});

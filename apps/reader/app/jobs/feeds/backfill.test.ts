/**
 * The history backfill job: it walks the feed named in its payload from the document
 * named there, acks a walk that ended, and retries one that hit a fault. The walk itself
 * is covered against real documents beside the history service.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test, vi } from "vitest";

import type { HistoryOutcome } from "~/app/services/history";

/** What the walk answers in the current test, and the arguments it was called with. */
let walk = vi.hoisted(() => ({
	outcome: undefined as HistoryOutcome | undefined,
	calls: [] as unknown[][],
}));

vi.doMock("~/app/models/feed-store", () => ({
	feedStore: (feedId: string) => ({ feedId }),
}));

vi.doMock("~/app/services/history", () => ({
	walkHistory: async (...args: unknown[]) => {
		walk.calls.push(args);
		return walk.outcome;
	},
}));

let { createJobContext, Job } = await import("@sdxc/jobs");
let jobs = (await import("~/app/jobs")).default;
let backfill = (await import("~/app/jobs/feeds/backfill")).default;

const INPUT = {
	feedId: "feed_123",
	url: "http://example.org/2003/11/index.atom",
	rel: "prev-archive" as const,
};

/** The context one delivery of the job receives. */
function context() {
	return createJobContext(jobs.feeds.backfill, { id: "message-1", attempts: 1, input: INPUT });
}

beforeEach(() => {
	walk.calls = [];
});

describe("feeds.backfill", () => {
	test("walks the named feed from the named document, along the named relation", async () => {
		walk.outcome = { status: "done", reason: "end", pages: 2, inserted: 2 };

		await backfill(context());

		expect(walk.calls).toEqual([
			[{ feedId: INPUT.feedId }, { url: INPUT.url, rel: INPUT.rel }, expect.any(Object)],
		]);
	});

	test("acks a walk the publisher ended", async () => {
		walk.outcome = { status: "done", reason: "refused", pages: 1, inserted: 0 };

		await expect(backfill(context())).resolves.toBeUndefined();
	});

	test("retries a walk that hit a fault", async () => {
		walk.outcome = { status: "retry", message: "Failed to fetch feed: 503", pages: 1, inserted: 0 };

		await expect(backfill(context())).rejects.toBeInstanceOf(Job.Retry);
	});
});

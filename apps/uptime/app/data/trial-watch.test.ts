/**
 * Unit tests for the `TrialWatch` data-access model: the hourly `next_due_at` claim, the
 * `recordCheck` write path that folds a check into both the history table and the row's
 * counters, the change-email bound that stops a flapping target emailing 168 times in a
 * week, the two independent deadlines (checking ends at 7 days, the conversion offer at 30),
 * and the cleanup sweeps.
 *
 * The predicates are tested as pure functions against literal rows rather than through the
 * database, because that is how the sweep calls them — on the row the claim just handed it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { beforeEach, describe, expect, test } from "vitest";

import type { NewTrialWatch } from "~/app/data/trial-watch";

import TrialWatch, {
	TRIAL_WATCH_CONVERSION_WINDOW_DAYS,
	TRIAL_WATCH_DURATION_DAYS,
	TRIAL_WATCH_INTERVAL_SECONDS,
	isHealthyTrialStatus,
	shouldNotifyChange,
	shouldSendSummary,
} from "~/app/data/trial-watch";
import { createTestDatabase } from "~/app/lib/test/db";
import { trialWatchResults, trialWatches } from "~/database/schema";

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

let db: Database;

beforeEach(() => {
	db = createTestDatabase().db;
});

/** A valid `TrialWatch.create` input for `lead-1`, with any field overridable per test. */
async function createWatch(overrides: Partial<NewTrialWatch> = {}) {
	return await TrialWatch.create(db, "lead-1", {
		url: "https://example.com",
		...overrides,
	});
}

/** The `next_due_at` currently stored for a watch, which is what a claim moves. */
async function nextDueAt(watchId: string) {
	let watch = await db.findOne(trialWatches, { where: { id: watchId } });
	return watch?.next_due_at ?? null;
}

describe("TrialWatch.create", () => {
	test("stamps both deadlines, seven days apart from thirty", async () => {
		let before = Date.now();
		let watch = await createWatch();

		expect(watch.expires_at).toBeGreaterThanOrEqual(
			before + TRIAL_WATCH_DURATION_DAYS * MS_PER_DAY,
		);
		expect(watch.converts_until).toBeGreaterThanOrEqual(
			before + TRIAL_WATCH_CONVERSION_WINDOW_DAYS * MS_PER_DAY,
		);
		expect(watch.converts_until).toBeGreaterThan(watch.expires_at);
	});

	test("is first due in an hour, not immediately", async () => {
		let before = Date.now();
		let watch = await createWatch();

		expect(watch.next_due_at).toBeGreaterThanOrEqual(before + TRIAL_WATCH_INTERVAL_SECONDS * 1000);
	});

	test("applies the column defaults a fresh watch has no history for", async () => {
		let watch = await createWatch();

		expect(watch.lead_id).toBe("lead-1");
		expect(watch.interval_seconds).toBe(TRIAL_WATCH_INTERVAL_SECONDS);
		expect(watch.checks_run).toBe(0);
		expect(watch.checks_ok).toBe(0);
		expect(watch.max_response_time_ms).toBe(0);
		expect(watch.last_status).toBeNull();
		expect(watch.change_notified_at).toBeNull();
		expect(watch.summary_sent_at).toBeNull();
		expect(watch.converted_monitor_id).toBeNull();
		expect(watch.converted_at).toBeNull();
	});

	test("carries the trial page's own result over as the change-detection baseline", async () => {
		expect((await createWatch({ last_status: "up" })).last_status).toBe("up");
	});

	test("issues a report token, so every watch has a page it can be read at", async () => {
		let watch = await createWatch();

		expect(watch.report_token).toBeTypeOf("string");
		// Long enough that guessing one is not a strategy; the UUID form is 36 characters.
		expect(watch.report_token.length).toBeGreaterThanOrEqual(32);
		// Never the id: the id is a key other tables carry, and a report URL derived from it
		// would be reachable from anywhere an id is exposed.
		expect(watch.report_token).not.toBe(watch.id);
	});

	test("issues a different report token per attempt", async () => {
		let first = await createWatch({ url: "https://a.example" });
		let second = await createWatch({ url: "https://b.example" });

		expect(second.report_token).not.toBe(first.report_token);
	});

	test("gives each attempt its own deadlines rather than inheriting the first one's", async () => {
		let first = await createWatch({ url: "https://a.example" });
		await db.update(trialWatches, first.id, { converts_until: Date.now() - 1 });
		let second = await createWatch({ url: "https://b.example" });

		expect(second.converts_until).toBeGreaterThan(Date.now());
	});
});

/**
 * The report page's only read, and its whole authorization: a token in a URL, with no lead and
 * no session to narrow it. The unknown-token case is the one that must stay a `null` rather
 * than a wrong watch, since that is what makes the page a 404 instead of somebody else's data.
 */
describe("TrialWatch.findByReportToken", () => {
	test("finds the watch its token was issued for", async () => {
		let watch = await createWatch();

		expect((await TrialWatch.findByReportToken(db, watch.report_token))?.id).toBe(watch.id);
	});

	test("finds a watch whose week is over, which is what a report describes", async () => {
		let watch = await createWatch();
		await db.update(trialWatches, watch.id, { next_due_at: null, summary_sent_at: Date.now() });

		expect(await TrialWatch.findByReportToken(db, watch.report_token)).not.toBeNull();
	});

	test("answers null for a token nothing issued", async () => {
		await createWatch();

		expect(await TrialWatch.findByReportToken(db, "not-a-real-token")).toBeNull();
	});

	test("never answers with another watch's row", async () => {
		let mine = await createWatch({ url: "https://mine.example" });
		let theirs = await TrialWatch.create(db, "lead-2", { url: "https://theirs.example" });

		expect((await TrialWatch.findByReportToken(db, mine.report_token))?.id).toBe(mine.id);
		expect((await TrialWatch.findByReportToken(db, theirs.report_token))?.id).toBe(theirs.id);
	});
});

/**
 * `claimDue` is a claim, not a query: it takes the watches whose next check has arrived and
 * advances that column in the same call, so what matters is the state it leaves behind.
 */
describe("TrialWatch.claimDue", () => {
	test("claims nothing before the first check is due", async () => {
		await createWatch();

		expect(await TrialWatch.claimDue(db, Date.now())).toHaveLength(0);
	});

	test("claims every watch that has come due, across leads", async () => {
		let first = await createWatch();
		let second = await TrialWatch.create(db, "lead-2", {
			url: "https://other.example",
		});

		let claimed = await TrialWatch.claimDue(db, Date.now() + MS_PER_HOUR);

		expect(new Set(claimed.map((watch) => watch.id))).toEqual(new Set([first.id, second.id]));
	});

	test("never claims the same watch twice within one interval", async () => {
		await createWatch();
		let scheduledAt = Date.now() + MS_PER_HOUR;

		expect(await TrialWatch.claimDue(db, scheduledAt)).toHaveLength(1);
		expect(await TrialWatch.claimDue(db, scheduledAt)).toHaveLength(0);
	});

	test("advances by one whole hour rather than catching up on every missed check", async () => {
		let watch = await createWatch();

		// Six hours of downtime: the watch is due once when the sweep comes back, not six
		// times, and the next due time lands on the following hour boundary.
		let scheduledAt = Date.now() + 6 * MS_PER_HOUR;
		let claimed = await TrialWatch.claimDue(db, scheduledAt);

		expect(claimed).toHaveLength(1);
		let advanced = await nextDueAt(watch.id);
		expect(advanced).toBeGreaterThan(scheduledAt);
		expect(advanced).toBeLessThanOrEqual(scheduledAt + MS_PER_HOUR);
	});

	test("never claims a finished watch", async () => {
		let watch = await createWatch();
		await TrialWatch.finish(db, watch.id);

		expect(await TrialWatch.claimDue(db, Date.now() + 8 * MS_PER_DAY)).toHaveLength(0);
	});

	test("still claims an expired watch, which is how the wrap-up gets sent", async () => {
		let watch = await createWatch();

		let claimed = await TrialWatch.claimDue(db, Date.now() + 8 * MS_PER_DAY);

		expect(claimed.map((each) => each.id)).toEqual([watch.id]);
	});

	test("projects the columns the sweep decides with, so it needs no follow-up read", async () => {
		await createWatch({ last_status: "up" });

		let [claimed] = await TrialWatch.claimDue(db, Date.now() + MS_PER_HOUR);

		expect(claimed?.url).toBe("https://example.com");
		expect(claimed?.lead_id).toBe("lead-1");
		expect(claimed?.last_status).toBe("up");
		expect(claimed?.expires_at).toBeTypeOf("number");
		expect(claimed?.created_at).toBeTypeOf("number");
	});
});

describe("TrialWatch.recordCheck", () => {
	test("appends a history row and returns its id", async () => {
		let watch = await createWatch();

		let id = await TrialWatch.recordCheck(db, watch, { status: "up", responseTimeMs: 120 });
		let [result] = await TrialWatch.listResults(db, watch.id);

		expect(result?.id).toBe(id);
		expect(result?.status).toBe("up");
		expect(result?.response_time_ms).toBe(120);
	});

	test("bumps the counters a digest reads without re-reading the history", async () => {
		let watch = await createWatch();

		await TrialWatch.recordCheck(db, watch, { status: "up", responseTimeMs: 120 });
		await TrialWatch.recordCheck(db, watch, { status: "down", responseTimeMs: null });
		await TrialWatch.recordCheck(db, watch, { status: "up", responseTimeMs: 340 });

		let stored = await TrialWatch.findById(db, watch.id);

		expect(stored?.checks_run).toBe(3);
		expect(stored?.checks_ok).toBe(2);
		expect(stored?.max_response_time_ms).toBe(340);
		expect(stored?.last_status).toBe("up");
	});

	test("does not count a degraded check as ok, and does not count it as down either", async () => {
		let watch = await createWatch();

		await TrialWatch.recordCheck(db, watch, { status: "degraded", responseTimeMs: 8000 });
		let stored = await TrialWatch.findById(db, watch.id);

		expect(stored?.checks_run).toBe(1);
		expect(stored?.checks_ok).toBe(0);
		expect(stored?.max_response_time_ms).toBe(8000);
	});

	test("keeps the slowest response, not the latest one", async () => {
		let watch = await createWatch();

		await TrialWatch.recordCheck(db, watch, { status: "up", responseTimeMs: 900 });
		await TrialWatch.recordCheck(db, watch, { status: "up", responseTimeMs: 100 });

		expect((await TrialWatch.findById(db, watch.id))?.max_response_time_ms).toBe(900);
	});

	test("leaves the scheduling the claim did alone rather than advancing it twice", async () => {
		let watch = await createWatch();
		await TrialWatch.claimDue(db, Date.now() + MS_PER_HOUR);
		let afterClaim = await nextDueAt(watch.id);

		await TrialWatch.recordCheck(db, watch, { status: "up", responseTimeMs: 120 });

		expect(await nextDueAt(watch.id)).toBe(afterClaim);
	});

	test("ends the watch on the check that lands after it expired", async () => {
		let watch = await createWatch();
		await db.update(trialWatches, watch.id, { expires_at: Date.now() - 1 });

		await TrialWatch.recordCheck(db, watch, { status: "up", responseTimeMs: 120 });

		expect(await nextDueAt(watch.id)).toBeNull();
	});

	test("ending the checking leaves the conversion offer open", async () => {
		let watch = await createWatch();
		await db.update(trialWatches, watch.id, { expires_at: Date.now() - 1 });

		await TrialWatch.recordCheck(db, watch, { status: "up", responseTimeMs: 120 });
		let stored = await TrialWatch.findById(db, watch.id);

		expect(stored?.next_due_at).toBeNull();
		expect(stored ? TrialWatch.isConvertible(stored, Date.now()) : false).toBe(true);
	});
});

describe("TrialWatch.finish", () => {
	test("ends a watch without recording a check", async () => {
		let watch = await createWatch();

		await TrialWatch.finish(db, watch.id);
		let stored = await TrialWatch.findById(db, watch.id);

		expect(stored?.next_due_at).toBeNull();
		expect(stored?.checks_run).toBe(0);
	});
});

describe("TrialWatch result history", () => {
	test("lists a watch's results newest first, and only that watch's", async () => {
		let watch = await createWatch();
		let other = await createWatch({ url: "https://other.example" });

		await TrialWatch.recordCheck(db, watch, { status: "up", responseTimeMs: 100 });
		await TrialWatch.recordCheck(db, other, { status: "down", responseTimeMs: null });
		await TrialWatch.recordCheck(db, watch, { status: "degraded", responseTimeMs: 700 });

		let results = await TrialWatch.listResults(db, watch.id);

		expect(results).toHaveLength(2);
		expect(results.map((result) => result.status)).toContain("degraded");
		expect(results.every((result) => result.trial_watch_id === watch.id)).toBe(true);
	});

	test("reads a time range oldest first, which is the order a bar is drawn in", async () => {
		let watch = await createWatch();
		let now = Date.now();

		for (let [index, status] of (["up", "down", "up"] as const).entries()) {
			await db.create(trialWatchResults, {
				id: `result-${index}`,
				trial_watch_id: watch.id,
				status,
				response_time_ms: 100,
				checked_at: now + index * MS_PER_HOUR,
			});
		}

		let inRange = await TrialWatch.listResultsBetween(db, watch.id, now, now + 2 * MS_PER_HOUR);

		expect(inRange.map((result) => result.id)).toEqual(["result-0", "result-1"]);
		expect(inRange.map((result) => result.status)).toEqual(["up", "down"]);
	});
});

describe("TrialWatch.listDigestForLead", () => {
	test("returns every active target with its own results, oldest first", async () => {
		let first = await createWatch({ url: "https://a.example" });
		let second = await createWatch({ url: "https://b.example" });

		await TrialWatch.recordCheck(db, first, { status: "up", responseTimeMs: 100 });
		await TrialWatch.recordCheck(db, first, { status: "down", responseTimeMs: null });
		await TrialWatch.recordCheck(db, second, { status: "up", responseTimeMs: 200 });

		let digest = await TrialWatch.listDigestForLead(db, "lead-1", 0);

		expect(digest.map((entry) => entry.watch.id)).toEqual([first.id, second.id]);
		expect(digest[0]?.results.map((result) => result.status)).toEqual(["up", "down"]);
		expect(digest[1]?.results.map((result) => result.status)).toEqual(["up"]);
	});

	test("carries the row's own totals, so a digest needs no aggregate query", async () => {
		let watch = await createWatch();
		await TrialWatch.recordCheck(db, watch, { status: "up", responseTimeMs: 100 });
		await TrialWatch.recordCheck(db, watch, { status: "down", responseTimeMs: null });

		let [entry] = await TrialWatch.listDigestForLead(db, "lead-1", 0);

		expect(entry?.watch.checks_run).toBe(2);
		expect(entry?.watch.checks_ok).toBe(1);
	});

	test("leaves out results from before the window it covers", async () => {
		let watch = await createWatch();
		let now = Date.now();

		await db.create(trialWatchResults, {
			id: "old",
			trial_watch_id: watch.id,
			status: "up",
			response_time_ms: 100,
			checked_at: now - 2 * MS_PER_DAY,
		});
		await db.create(trialWatchResults, {
			id: "recent",
			trial_watch_id: watch.id,
			status: "down",
			response_time_ms: null,
			checked_at: now,
		});

		let [entry] = await TrialWatch.listDigestForLead(db, "lead-1", now - MS_PER_DAY);

		expect(entry?.results.map((result) => result.id)).toEqual(["recent"]);
	});

	test("leaves out a target whose week has ended, since it had its own wrap-up", async () => {
		let active = await createWatch({ url: "https://a.example" });
		let finished = await createWatch({ url: "https://b.example" });
		await TrialWatch.markSummarySent(db, finished.id);

		let digest = await TrialWatch.listDigestForLead(db, "lead-1", 0);

		expect(digest.map((entry) => entry.watch.id)).toEqual([active.id]);
	});

	test("returns nothing for a lead with no active targets", async () => {
		let watch = await createWatch();
		await TrialWatch.finish(db, watch.id);

		expect(await TrialWatch.listDigestForLead(db, "lead-1", 0)).toHaveLength(0);
	});

	test("never mixes in another lead's targets", async () => {
		await createWatch();
		await TrialWatch.create(db, "lead-2", { url: "https://other.example" });

		let digest = await TrialWatch.listDigestForLead(db, "lead-1", 0);

		expect(digest).toHaveLength(1);
		expect(digest[0]?.watch.lead_id).toBe("lead-1");
	});
});

describe("isHealthyTrialStatus", () => {
	test("counts only a fully healthy check, so the ratio is not flattered by a slow one", () => {
		expect(isHealthyTrialStatus("up")).toBe(true);
		expect(isHealthyTrialStatus("degraded")).toBe(false);
		expect(isHealthyTrialStatus("down")).toBe(false);
	});
});

describe("shouldNotifyChange", () => {
	let now = Date.parse("2026-08-02T12:00:00Z");

	test("says nothing on the first check, which has nothing to differ from", () => {
		expect(shouldNotifyChange({ last_status: null, change_notified_at: null }, "up", now)).toBe(
			false,
		);
	});

	test("says nothing when the status is unchanged", () => {
		expect(shouldNotifyChange({ last_status: "up", change_notified_at: null }, "up", now)).toBe(
			false,
		);
	});

	test("notifies the first change of the day", () => {
		expect(shouldNotifyChange({ last_status: "up", change_notified_at: null }, "down", now)).toBe(
			true,
		);
	});

	test("notifies a recovery, not only a failure", () => {
		expect(shouldNotifyChange({ last_status: "down", change_notified_at: null }, "up", now)).toBe(
			true,
		);
	});

	test("bounds a flapping target to one change email per day", () => {
		let earlier = Date.parse("2026-08-02T01:00:00Z");

		expect(
			shouldNotifyChange({ last_status: "down", change_notified_at: earlier }, "up", now),
		).toBe(false);
	});

	test("notifies again the next day, so a genuine later outage is not lost", () => {
		let yesterday = Date.parse("2026-08-01T23:00:00Z");

		expect(
			shouldNotifyChange({ last_status: "up", change_notified_at: yesterday }, "down", now),
		).toBe(true);
	});

	test("treats a slide into degraded as a change worth one email", () => {
		expect(
			shouldNotifyChange({ last_status: "up", change_notified_at: null }, "degraded", now),
		).toBe(true);
		expect(
			shouldNotifyChange({ last_status: "up", change_notified_at: now - 1000 }, "degraded", now),
		).toBe(false);
	});
});

describe("shouldSendSummary", () => {
	let expires = Date.parse("2026-08-09T09:00:00Z");

	test("waits until the watch has expired", () => {
		expect(shouldSendSummary({ expires_at: expires, summary_sent_at: null }, expires - 1)).toBe(
			false,
		);
	});

	test("is owed once the seven days are up", () => {
		expect(shouldSendSummary({ expires_at: expires, summary_sent_at: null }, expires)).toBe(true);
	});

	test("is sent only once, however many times the sweep sees the watch", () => {
		expect(
			shouldSendSummary(
				{ expires_at: expires, summary_sent_at: expires + 60_000 },
				expires + MS_PER_DAY,
			),
		).toBe(false);
	});

	test("targets started on different days are wrapped up on different days", async () => {
		let first = await createWatch({ url: "https://a.example" });
		let second = await createWatch({ url: "https://b.example" });
		await db.update(trialWatches, second.id, { expires_at: second.expires_at + 3 * MS_PER_DAY });

		let atDaySeven = first.expires_at + 1;
		let stored = await TrialWatch.listByLead(db, "lead-1");
		let firstStored = stored.find((watch) => watch.id === first.id);
		let secondStored = stored.find((watch) => watch.id === second.id);

		expect(firstStored ? shouldSendSummary(firstStored, atDaySeven) : false).toBe(true);
		expect(secondStored ? shouldSendSummary(secondStored, atDaySeven) : true).toBe(false);
	});
});

describe("TrialWatch.markChangeNotified", () => {
	test("stamping the change email is what closes the day's bound", async () => {
		let watch = await createWatch({ last_status: "up" });
		let now = Date.now();

		expect(shouldNotifyChange(watch, "down", now)).toBe(true);
		await TrialWatch.markChangeNotified(db, watch.id, now);
		let stored = await TrialWatch.findById(db, watch.id);

		expect(stored?.change_notified_at).toBe(now);
		expect(stored ? shouldNotifyChange(stored, "down", now) : true).toBe(false);
	});
});

describe("TrialWatch.markSummarySent", () => {
	test("the wrap-up and the end of the watch are one write", async () => {
		let watch = await createWatch();
		let sentAt = Date.now();

		await TrialWatch.markSummarySent(db, watch.id, sentAt);
		let stored = await TrialWatch.findById(db, watch.id);

		expect(stored?.summary_sent_at).toBe(sentAt);
		expect(stored?.next_due_at).toBeNull();
	});
});

describe("TrialWatch conversion", () => {
	test("a watch is convertible inside its own window and never converted", async () => {
		let watch = await createWatch();

		expect(TrialWatch.isConvertible(watch, Date.now() + 29 * MS_PER_DAY)).toBe(true);
		expect(TrialWatch.isConvertible(watch, Date.now() + 31 * MS_PER_DAY)).toBe(false);
	});

	test("offers every unexpired unconverted watch a lead started, oldest first", async () => {
		let first = await createWatch({ url: "https://one.example" });
		let second = await createWatch({ url: "https://two.example" });
		await TrialWatch.create(db, "lead-2", { url: "https://other.example" });

		let convertible = await TrialWatch.listConvertibleByLead(db, "lead-1", Date.now());

		expect(convertible.map((watch) => watch.id)).toEqual([first.id, second.id]);
	});

	test("still offers a watch whose seven days ran out, since the offer outlives the checking", async () => {
		let watch = await createWatch();
		await TrialWatch.markSummarySent(db, watch.id);

		let convertible = await TrialWatch.listConvertibleByLead(db, "lead-1", Date.now());

		expect(convertible.map((each) => each.id)).toEqual([watch.id]);
	});

	/**
	 * The product's own example: attempts on days 0, 3 and 6, signing up on day 32. Two of
	 * the three are still inside their own thirty-day windows and the first is not.
	 */
	test("converts only the attempts still inside their own windows", async () => {
		let day0 = await createWatch({ url: "https://a.example" });
		let day3 = await createWatch({ url: "https://b.example" });
		let day6 = await createWatch({ url: "https://c.example" });

		let signUp = Date.now() + 32 * MS_PER_DAY;
		await db.update(trialWatches, day3.id, {
			converts_until: day3.converts_until + 3 * MS_PER_DAY,
		});
		await db.update(trialWatches, day6.id, {
			converts_until: day6.converts_until + 6 * MS_PER_DAY,
		});

		let convertible = await TrialWatch.listConvertibleByLead(db, "lead-1", signUp);

		expect(convertible.map((watch) => watch.id)).toEqual([day3.id, day6.id]);
		expect(convertible.map((watch) => watch.id)).not.toContain(day0.id);
	});

	test("stops offering a watch once it names its monitor, so a second sign-in creates nothing", async () => {
		let watch = await createWatch();
		await TrialWatch.markConverted(db, watch.id, "monitor-1");

		let stored = await TrialWatch.findById(db, watch.id);

		expect(await TrialWatch.listConvertibleByLead(db, "lead-1", Date.now())).toHaveLength(0);
		expect(stored?.converted_monitor_id).toBe("monitor-1");
		expect(stored?.converted_at).not.toBeNull();
	});

	test("offers a watch started after an earlier conversion", async () => {
		let converted = await createWatch({ url: "https://one.example" });
		await TrialWatch.markConverted(db, converted.id, "monitor-1");
		let later = await createWatch({ url: "https://two.example" });

		let convertible = await TrialWatch.listConvertibleByLead(db, "lead-1", Date.now());

		expect(convertible.map((watch) => watch.id)).toEqual([later.id]);
	});
});

describe("TrialWatch.listByLead", () => {
	test("lists every watch a lead started", async () => {
		let first = await createWatch({ url: "https://one.example" });
		let second = await createWatch({ url: "https://two.example" });

		let watches = await TrialWatch.listByLead(db, "lead-1");

		expect(new Set(watches.map((watch) => watch.id))).toEqual(new Set([first.id, second.id]));
	});
});

/**
 * The free-watch cap, which is the whole of "one free week per person per URL per thirty
 * days": a row exists for the pair, or it does not. The spellings that used to walk past it
 * are the point of every case here.
 */
describe("TrialWatch.findByNormalizedUrl", () => {
	test("stores the key beside the URL, derived and not supplied", async () => {
		let watch = await createWatch({ url: "https://Example.com/a/?b=2&a=1#top" });

		expect(watch.url).toBe("https://Example.com/a/?b=2&a=1#top");
		expect(watch.normalized_url).toBe("https://example.com/a?a=1&b=2");
	});

	test("finds nothing for a lead who has never submitted this URL", async () => {
		await createWatch({ url: "https://example.com" });

		expect(await TrialWatch.findByNormalizedUrl(db, "lead-1", "https://other.example")).toBeNull();
	});

	test("finds the existing watch for the same URL", async () => {
		let watch = await createWatch({ url: "https://example.com" });

		let found = await TrialWatch.findByNormalizedUrl(db, "lead-1", "https://example.com");
		expect(found?.id).toBe(watch.id);
	});

	test.each([
		["a trailing slash", "https://example.com/"],
		["a fragment", "https://example.com/#pricing"],
		["a fragment and a slash", "https://example.com/#"],
		["an uppercase host", "https://EXAMPLE.com"],
	])("caps %s against the same target", async (_label, spelling) => {
		let watch = await createWatch({ url: "https://example.com" });

		let found = await TrialWatch.findByNormalizedUrl(db, "lead-1", spelling);
		expect(found?.id).toBe(watch.id);
	});

	test("caps reordered query parameters against the same target", async () => {
		let watch = await createWatch({ url: "https://example.com/api?b=2&a=1" });

		let found = await TrialWatch.findByNormalizedUrl(
			db,
			"lead-1",
			"https://example.com/api?a=1&b=2",
		);
		expect(found?.id).toBe(watch.id);
	});

	test("caps a trailing slash in front of a query string too", async () => {
		let watch = await createWatch({ url: "https://example.com/health/?deep=1" });

		let found = await TrialWatch.findByNormalizedUrl(
			db,
			"lead-1",
			"https://example.com/health?deep=1",
		);
		expect(found?.id).toBe(watch.id);
	});

	/**
	 * The one exception, and it is deliberate. A plaintext origin and a TLS one are two
	 * different endpoints that can behave differently, so each is worth its own free week.
	 */
	test("does not collide http with https on the same host", async () => {
		await createWatch({ url: "https://example.com" });

		expect(await TrialWatch.findByNormalizedUrl(db, "lead-1", "http://example.com")).toBeNull();
	});

	test("does not collide two paths that differ only in case", async () => {
		await createWatch({ url: "https://example.com/Status" });

		expect(
			await TrialWatch.findByNormalizedUrl(db, "lead-1", "https://example.com/status"),
		).toBeNull();
	});

	test("is scoped to the lead, so two people may each watch the same URL", async () => {
		await createWatch({ url: "https://example.com" });
		await TrialWatch.create(db, "lead-2", { url: "https://example.com" });

		let first = await TrialWatch.findByNormalizedUrl(db, "lead-1", "https://example.com");
		let second = await TrialWatch.findByNormalizedUrl(db, "lead-2", "https://example.com");

		expect(first?.id).not.toBe(second?.id);
	});
});

describe("TrialWatch.deleteExpiredResults", () => {
	/** Writes a result at an arbitrary instant, which `recordCheck` always stamps as now. */
	async function resultAt(watchId: string, id: string, checkedAt: number) {
		return await db.create(trialWatchResults, {
			id,
			trial_watch_id: watchId,
			status: "up",
			response_time_ms: 100,
			checked_at: checkedAt,
		});
	}

	test("deletes the history of a watch whose conversion window has closed", async () => {
		let watch = await createWatch();
		let now = Date.now();
		await db.update(trialWatches, watch.id, { converts_until: now - 1 });
		await resultAt(watch.id, "old", now - 8 * MS_PER_DAY);

		let swept = await TrialWatch.deleteExpiredResults(db, now);

		expect(swept.rowsAffected).toBe(1);
		expect(await db.count(trialWatchResults)).toBe(0);
	});

	/**
	 * The whole reason the condition follows the watch instead of aging `checked_at`. A watch
	 * three weeks past its week of checking is still convertible and is still what a repeat
	 * submission is answered with, so its results are exactly what a report would draw on —
	 * and an age of seven days would have taken every one of them.
	 */
	test("keeps history older than the week, while the watch it belongs to lives", async () => {
		let watch = await createWatch();
		let now = Date.now();
		await resultAt(watch.id, "day-one", now - 20 * MS_PER_DAY);
		await resultAt(watch.id, "an-hour-ago", now - MS_PER_HOUR);

		await TrialWatch.deleteExpiredResults(db, now);

		expect(await db.count(trialWatchResults)).toBe(2);
	});

	test("leaves the watch itself alone, which is the row a conversion needs", async () => {
		let watch = await createWatch();
		let now = Date.now();
		await db.update(trialWatches, watch.id, { converts_until: now - 1 });
		await resultAt(watch.id, "old", now - 8 * MS_PER_DAY);

		await TrialWatch.deleteExpiredResults(db, now);

		expect(await TrialWatch.findById(db, watch.id)).not.toBeNull();
	});

	/** One lapsed watch's history goes; another lead's live watch keeps all of its own. */
	test("sweeps by watch and not across the table", async () => {
		let lapsed = await createWatch();
		let live = await createWatch({ url: "https://other.example" });
		let now = Date.now();

		await db.update(trialWatches, lapsed.id, { converts_until: now - 1 });
		await resultAt(lapsed.id, "lapsed-result", now - 20 * MS_PER_DAY);
		await resultAt(live.id, "live-result", now - 20 * MS_PER_DAY);

		await TrialWatch.deleteExpiredResults(db, now);

		let remaining = await db.findMany(trialWatchResults, {});
		expect(remaining.map((row) => row.id)).toEqual(["live-result"]);
	});
});

describe("TrialWatch.deleteExpired", () => {
	test("deletes a watch whose conversion window has closed", async () => {
		let watch = await createWatch();
		let now = Date.now();
		await db.update(trialWatches, watch.id, { converts_until: now - 1 });

		let swept = await TrialWatch.deleteExpired(db, now);

		expect(swept.rowsAffected).toBe(1);
		expect(await TrialWatch.findById(db, watch.id)).toBeNull();
	});

	test("keeps a watch whose checking is over but whose offer is not", async () => {
		let watch = await createWatch();
		let now = Date.now();
		await db.update(trialWatches, watch.id, { expires_at: now - MS_PER_DAY });

		await TrialWatch.deleteExpired(db, now);

		expect(await TrialWatch.findById(db, watch.id)).not.toBeNull();
	});

	test("deletes an already-converted watch once its window closes", async () => {
		let watch = await createWatch();
		let now = Date.now();
		await TrialWatch.markConverted(db, watch.id, "monitor-1");
		await db.update(trialWatches, watch.id, { converts_until: now - 1 });

		await TrialWatch.deleteExpired(db, now);

		expect(await TrialWatch.findById(db, watch.id)).toBeNull();
	});

	test("orphans nothing, because a 30-day-old watch's history is already 7 days gone", async () => {
		let watch = await createWatch();
		let now = Date.now();
		await db.create(trialWatchResults, {
			id: "old",
			trial_watch_id: watch.id,
			status: "up",
			response_time_ms: 100,
			checked_at: now - 25 * MS_PER_DAY,
		});
		await db.update(trialWatches, watch.id, { converts_until: now - 1 });

		await TrialWatch.deleteExpiredResults(db, now);
		await TrialWatch.deleteExpired(db, now);

		expect(await db.count(trialWatchResults)).toBe(0);
		expect(await db.count(trialWatches)).toBe(0);
	});
});

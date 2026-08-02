/**
 * Tests `convertTrialWatches`, the sign-in-time claim that turns trial targets into real
 * monitors.
 *
 * The centrepiece is the worked example the rule exists for: one person, three attempts made
 * on days 0, 3 and 6, converted against two different sign-in dates. Signing in on day 30
 * claims all three and on day 32 claims two, which is the only pair of assertions that can
 * distinguish a per-attempt window from a per-lead one — a per-lead rule keyed on the first
 * or last attempt gives three-and-three or three-and-none.
 *
 * The rest is the safety net. Conversion sits on the one path a user cannot route around, so
 * what is pinned here is that it creates nothing twice, that a failure anywhere in it is
 * swallowed rather than raised, and that a failure on one target still leaves the others
 * claimed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";

import type { Database } from "remix/data-table";

import type { SelectMonitor } from "~/database/schema";

import Lead from "~/app/data/lead";
import Monitor from "~/app/data/monitor";
import TrialConversion, { trialConversionUrls } from "~/app/data/trial-conversion";
import TrialWatch, {
	TRIAL_WATCH_CONVERSION_WINDOW_DAYS,
	TRIAL_WATCH_DURATION_DAYS,
} from "~/app/data/trial-watch";
import { createTestDatabase } from "~/app/lib/test/db";
import { convertTrialWatches } from "~/app/services/trial-conversion";
import { monitors, trialWatches } from "~/database/schema";

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

const EMAIL = "ada@example.com";
const TEAM_ID = "team-1";
const AUTHOR_ID = "user-1";

let db: Database;

beforeEach(() => {
	db = createTestDatabase().db;
});

/** The lead a sign-in with {@link EMAIL} finds. */
async function createLead(email: string = EMAIL) {
	return await Lead.upsertByEmail(db, {
		email,
		locale: "en",
		consented: false,
	});
}

/**
 * An attempt made `daysAgo` days ago, carrying the deadlines that attempt would have been
 * given at the time. Backdated after the fact because the deadlines are stamped from the
 * clock, and the whole rule under test is about how far in the past an attempt was made.
 */
async function attempt(leadId: string, url: string, daysAgo: number) {
	let startedAt = Date.now() - daysAgo * MS_PER_DAY;
	let watch = await TrialWatch.create(db, leadId, { url });

	await db.update(trialWatches, watch.id, {
		created_at: startedAt,
		expires_at: startedAt + TRIAL_WATCH_DURATION_DAYS * MS_PER_DAY,
		converts_until: startedAt + TRIAL_WATCH_CONVERSION_WINDOW_DAYS * MS_PER_DAY,
	});

	return watch.id;
}

/**
 * The worked example: attempts on URLs A, B and C made on days 0, 3 and 6, seeded as they
 * would look to someone signing in on `signInDay`.
 *
 * An hour is shaved off the elapsed time so that "day 30" lands unambiguously inside the
 * first attempt's thirty-day window instead of exactly on its edge, where `converts_until`
 * is exclusive and the answer would be about the boundary rather than about the rule.
 */
async function threeAttempts(leadId: string, signInDay: number) {
	let first = signInDay - 1 / 24;

	return {
		a: await attempt(leadId, "https://a.example", first),
		b: await attempt(leadId, "https://b.example", first - 3),
		c: await attempt(leadId, "https://c.example", first - 6),
	};
}

/** Every monitor the conversion created, oldest first. */
async function created(): Promise<SelectMonitor[]> {
	return await db.findMany(monitors, { where: { team_id: TEAM_ID }, orderBy: ["url", "asc"] });
}

/** Converts for {@link EMAIL} into {@link TEAM_ID}, the way the sign-in path does. */
async function convert() {
	await convertTrialWatches(db, { email: EMAIL, teamId: TEAM_ID, authorId: AUTHOR_ID });
}

describe("the conversion window, per attempt", () => {
	test("signing in on day 30 claims all three attempts", async () => {
		let lead = await createLead();
		await threeAttempts(lead.id, 30);

		await convert();

		expect((await created()).map((monitor) => monitor.url)).toEqual([
			"https://a.example",
			"https://b.example",
			"https://c.example",
		]);
	});

	test("signing in on day 32 claims only the two attempts still inside their own window", async () => {
		let lead = await createLead();
		let { a } = await threeAttempts(lead.id, 32);

		await convert();

		expect((await created()).map((monitor) => monitor.url)).toEqual([
			"https://b.example",
			"https://c.example",
		]);

		let lapsed = await TrialWatch.findById(db, a);
		expect(lapsed?.converted_at).toBeNull();
		expect(lapsed?.converted_monitor_id).toBeNull();
	});

	test("claims nothing once every window has closed", async () => {
		let lead = await createLead();
		await threeAttempts(lead.id, 40);

		await convert();

		expect(await created()).toBeEmpty();
	});

	test("claims nothing for an address that never left a lead", async () => {
		let other = await createLead("grace@example.com");
		await attempt(other.id, "https://grace.example", 1);

		await convert();

		expect(await created()).toBeEmpty();
	});
});

/**
 * A lead is the person, not the string they typed, and sign-in has to find them by the same
 * rule. Matching the stored address exactly used to fail for exactly the people careful
 * enough to tag: they tried as `hello+test@`, signed up as `hello@`, and their targets
 * lapsed unclaimed with nothing able to say why.
 */
describe("matching a subject to a lead", () => {
	async function convertAs(email: string) {
		await convertTrialWatches(db, { email, teamId: TEAM_ID, authorId: AUTHOR_ID });
	}

	test("claims the targets of an address that was tried with a tag", async () => {
		let lead = await createLead("hello+test@sergiodxa.com");
		await attempt(lead.id, "https://tagged.example", 1);

		await convertAs("hello@sergiodxa.com");

		expect((await created()).map((monitor) => monitor.url)).toEqual(["https://tagged.example"]);
	});

	test("claims them whatever case the subject's address arrives in", async () => {
		let lead = await createLead("hello@sergiodxa.com");
		await attempt(lead.id, "https://cased.example", 1);

		await convertAs("HELLO@SERGIODXA.COM");

		expect((await created()).map((monitor) => monitor.url)).toEqual(["https://cased.example"]);
	});

	/** The reduction not made: a dotted local part is somebody else, and gets nothing. */
	test("does not hand one person's targets to a dotted variant of their address", async () => {
		let lead = await createLead("hello@gmail.com");
		await attempt(lead.id, "https://dotted.example", 1);

		await convertAs("he.llo@gmail.com");

		expect(await created()).toBeEmpty();
	});
});

describe("what a claimed target becomes", () => {
	test("records which monitor the target became, which is what stops a second claim", async () => {
		let lead = await createLead();
		let watchId = await attempt(lead.id, "https://example.com", 1);

		await convert();

		let [monitor] = await created();
		let watch = await TrialWatch.findById(db, watchId);
		expect(watch?.converted_monitor_id).toBe(monitor?.id ?? null);
		expect(watch?.converted_at).not.toBeNull();
	});

	test("names the monitor after the host, without the www a person would not have typed", async () => {
		let lead = await createLead();
		await attempt(lead.id, "https://www.example.com/health", 1);

		await convert();

		expect((await created()).at(0)?.name).toBe("example.com");
	});

	test("arrives enabled and due, so the sweep checks it without anyone touching a toggle", async () => {
		let lead = await createLead();
		await attempt(lead.id, "https://example.com", 1);

		await convert();

		let [monitor] = await created();
		expect(monitor?.enabled_at).not.toBeNull();
		expect(monitor?.next_due_at).not.toBeNull();
	});

	test("looks like one made in the create form, not one made from the table defaults", async () => {
		let lead = await createLead();
		await attempt(lead.id, "https://example.com", 1);

		await convert();

		let [monitor] = await created();
		expect(monitor?.interval_seconds).toBe(600);
		expect(monitor?.expected_status).toBe(200);
		expect(monitor?.method).toBe("HEAD");
		expect(monitor?.location_hint).toBe("wnam");
		expect(monitor?.author_id).toBe(AUTHOR_ID);
	});
});

describe("idempotency", () => {
	test("signing in twice creates the monitors once", async () => {
		let lead = await createLead();
		await threeAttempts(lead.id, 30);

		await convert();
		await convert();

		expect(await created()).toHaveLength(3);
	});

	test("an attempt made after the first sign-in is claimed by the second", async () => {
		let lead = await createLead();
		await attempt(lead.id, "https://first.example", 1);

		await convert();
		await attempt(lead.id, "https://second.example", 0);
		await convert();

		expect((await created()).map((monitor) => monitor.url)).toEqual([
			"https://first.example",
			"https://second.example",
		]);
	});
});

describe("the funnel record", () => {
	test("writes the snapshot the report is drawn from", async () => {
		let lead = await createLead();
		await threeAttempts(lead.id, 30);
		await Lead.recordEmailSent(db, lead.id);
		await Lead.recordEmailSent(db, lead.id);

		await convert();

		let record = await TrialConversion.findByOwner(db, AUTHOR_ID);
		expect(record?.lead_created_at).toBe(lead.created_at);
		expect(record?.emails_sent).toBe(2);
		expect(record?.watch_count).toBe(3);
		expect(record?.paid_at).toBeNull();
		expect(trialConversionUrls(record ?? { urls: "[]" })).toEqual([
			"https://a.example",
			"https://b.example",
			"https://c.example",
		]);
	});

	/**
	 * Someone whose attempts all lapsed before they got around to signing up is still an
	 * account the free page produced, and leaving them out understates the one thing the
	 * report measures.
	 */
	test("records a signup even when there was nothing left to claim", async () => {
		let lead = await createLead();
		await threeAttempts(lead.id, 40);

		await convert();

		expect(await created()).toBeEmpty();
		expect(await TrialConversion.findByOwner(db, AUTHOR_ID)).not.toBeNull();
	});

	test("records nothing for an address that never left a lead", async () => {
		await convert();

		expect(await TrialConversion.findByOwner(db, AUTHOR_ID)).toBeNull();
	});

	/**
	 * Conversion runs on every sign-in, and a converted lead keeps receiving digests for the
	 * rest of their seven days — so a second sign-in arrives carrying a higher email count and
	 * must not be allowed to rewrite the measurement taken at the first.
	 */
	test("a later sign-in does not move the signup date or the counts taken at the first", async () => {
		let lead = await createLead();
		await attempt(lead.id, "https://example.com", 1);
		await Lead.recordEmailSent(db, lead.id);

		await convert();
		let first = await TrialConversion.findByOwner(db, AUTHOR_ID);

		await Lead.recordEmailSent(db, lead.id);
		await attempt(lead.id, "https://second.example", 0);
		await convert();

		let second = await TrialConversion.findByOwner(db, AUTHOR_ID);
		expect(second?.id).toBe(first?.id ?? "");
		expect(second?.signed_up_at).toBe(first?.signed_up_at ?? 0);
		expect(second?.emails_sent).toBe(1);
		expect(second?.watch_count).toBe(1);
	});

	test("a payment already recorded survives every later sign-in", async () => {
		let lead = await createLead();
		await attempt(lead.id, "https://example.com", 1);
		await convert();

		let paidAt = Date.now() - MS_PER_DAY;
		await TrialConversion.markPaid(db, AUTHOR_ID, paidAt);
		await convert();

		expect((await TrialConversion.findByOwner(db, AUTHOR_ID))?.paid_at).toBe(paidAt);
	});

	test("a failure recording it costs nobody their monitors", async () => {
		let lead = await createLead();
		await attempt(lead.id, "https://example.com", 1);
		spyOn(TrialConversion, "recordSignup").mockRejectedValue(new Error("insert failed"));

		await convert();

		expect(await created()).toHaveLength(1);
		spyOn(TrialConversion, "recordSignup").mockRestore();
	});
});

describe("never blocking sign-in", () => {
	afterEach(() => {
		spyOn(Lead, "findByEmail").mockRestore();
		spyOn(Monitor, "create").mockRestore();
	});

	test("swallows a failure in the lookup that decides whether there is anything to claim", async () => {
		let lead = await createLead();
		await attempt(lead.id, "https://example.com", 1);
		spyOn(Lead, "findByEmail").mockRejectedValue(new Error("d1 unavailable"));

		await expect(convert()).resolves.toBeUndefined();
	});

	test("swallows a failure while creating a monitor, leaving the attempt unclaimed", async () => {
		let lead = await createLead();
		let watchId = await attempt(lead.id, "https://example.com", 1);
		spyOn(Monitor, "create").mockRejectedValue(new Error("insert failed"));

		await convert();

		expect((await TrialWatch.findById(db, watchId))?.converted_at).toBeNull();
	});

	test("one failing target does not cost the others their conversion", async () => {
		let lead = await createLead();
		await threeAttempts(lead.id, 30);
		let create = Monitor.create.bind(Monitor);
		spyOn(Monitor, "create")
			.mockImplementationOnce(async () => {
				throw new Error("insert failed");
			})
			.mockImplementation(create);

		await convert();

		expect((await created()).map((monitor) => monitor.url)).toEqual([
			"https://b.example",
			"https://c.example",
		]);
	});
});

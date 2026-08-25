/**
 * Unit tests for the `Lead` data-access model: the create-or-update the trial form runs, the
 * per-lead daily digest schedule, and the cleanup sweep that removes a lead once its watches
 * are gone. Most cover {@link Lead.upsertByEmail}, where every field a repeat submission
 * touches follows its own rule; the rest cover ordering, since the orphan sweep is correct
 * only because the watch sweep has already run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { beforeEach, describe, expect, test } from "vitest";

import type { LeadInput } from "~/app/data/lead";

import Lead, { ORPHANED_LEAD_GRACE_MS, shouldSendDigest } from "~/app/data/lead";
import TrialWatch from "~/app/data/trial-watch";
import { createTestDatabase } from "~/app/lib/test/db";
import { leads, trialWatchResults, trialWatches } from "~/database/schema";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

let db: Database;

beforeEach(() => {
	db = createTestDatabase().db;
});

/** A valid trial-form submission, with any field overridable per test. */
async function upsert(overrides: Partial<LeadInput> = {}) {
	return await Lead.upsertByEmail(db, {
		email: "visitor@example.com",
		locale: "en",
		consented: false,
		...overrides,
	});
}

describe("Lead.upsertByEmail", () => {
	test("records a new lead with no digest history", async () => {
		let lead = await upsert();

		expect(lead.id).toBeTruthy();
		expect(lead.email).toBe("visitor@example.com");
		expect(lead.locale).toBe("en");
		expect(lead.consented_at).toBeNull();
		expect(lead.last_digest_at).toBeNull();
	});

	test("mints an unsubscribe token that is not derived from the address", async () => {
		let one = await upsert({ email: "one@example.com" });
		let two = await upsert({ email: "two@example.com" });

		expect(one.unsubscribe_token).toBeTruthy();
		expect(one.unsubscribe_token).not.toBe(one.email);
		expect(one.unsubscribe_token).not.toBe(two.unsubscribe_token);
	});

	test("never rotates the token, so links already in an inbox keep working", async () => {
		let first = await upsert();

		expect((await upsert({ locale: "ja" })).unsubscribe_token).toBe(first.unsubscribe_token);
	});

	test("stamps consent when the marketing box was ticked", async () => {
		expect((await upsert({ consented: true })).consented_at).not.toBeNull();
	});

	test("updates the existing lead instead of inserting a second row", async () => {
		let first = await upsert();
		let second = await upsert({ locale: "es" });

		expect(second.id).toBe(first.id);
		expect(second.locale).toBe("es");
		expect(await db.count(leads)).toBe(1);
	});

	test("never revokes a consent already given, even when the box is unticked", async () => {
		let consented = await upsert({ consented: true });

		expect((await upsert({ consented: false })).consented_at).toBe(consented.consented_at);
	});

	test("stamps consent on a later submission when the first had none", async () => {
		await upsert({ consented: false });

		expect((await upsert({ consented: true })).consented_at).not.toBeNull();
	});

	test("does not hand out a second digest by resetting the stamp", async () => {
		let lead = await upsert();
		let sentAt = Date.now();
		await Lead.markDigestSent(db, lead.id, sentAt);

		expect((await upsert({ locale: "fr" })).last_digest_at).toBe(sentAt);
	});

	test("keeps two different addresses as two leads", async () => {
		await upsert({ email: "one@example.com" });
		await upsert({ email: "two@example.com" });

		expect(await db.count(leads)).toBe(2);
	});
});

/**
 * The identity half of the free-watch cap. Tagging is a legitimate privacy practice and must
 * keep working as an address, so the row is keyed on the person while the mail still goes to
 * the spelling they used.
 */
describe("Lead.upsertByEmail identity", () => {
	test("resolves every tagged and cased spelling to one lead", async () => {
		let first = await upsert({ email: "hello+a@sergiodxa.com" });
		let second = await upsert({ email: "hello+b@sergiodxa.com" });
		let third = await upsert({ email: "HELLO@sergiodxa.com" });

		expect(second.id).toBe(first.id);
		expect(third.id).toBe(first.id);
		expect(await db.count(leads)).toBe(1);
	});

	test("keeps a dotted Gmail variant as its own lead", async () => {
		await upsert({ email: "he.llo@gmail.com" });
		await upsert({ email: "hello@gmail.com" });

		expect(await db.count(leads)).toBe(2);
	});

	test("delivers to the address as typed, not to the key", async () => {
		let lead = await upsert({ email: "Hello+Sale@Sergiodxa.com" });

		expect(lead.email).toBe("Hello+Sale@Sergiodxa.com");
		expect(lead.normalized_email).toBe("hello@sergiodxa.com");
	});

	/** The same rule `locale` follows: the newest spelling is the inbox they are watching. */
	test("takes the newest spelling as the address to write to", async () => {
		await upsert({ email: "hello+old@sergiodxa.com" });
		let lead = await upsert({ email: "hello+new@sergiodxa.com" });

		expect(lead.email).toBe("hello+new@sergiodxa.com");
		expect(await db.count(leads)).toBe(1);
	});

	test("does not revoke a consent given under a different spelling", async () => {
		await upsert({ email: "hello+a@sergiodxa.com", consented: true });
		let lead = await upsert({ email: "hello+b@sergiodxa.com", consented: false });

		expect(lead.consented_at).not.toBeNull();
	});
});

describe("Lead.findByEmail", () => {
	test("finds the lead behind an address", async () => {
		let created = await upsert();

		expect((await Lead.findByEmail(db, "visitor@example.com"))?.id).toBe(created.id);
	});

	test("returns null for an address that never tried the tool", async () => {
		expect(await Lead.findByEmail(db, "stranger@example.com")).toBeNull();
	});

	/** What makes signing up as `hello@` claim the targets tried as `hello+test@`. */
	test("finds a lead created under a tagged spelling from the untagged one", async () => {
		let created = await upsert({ email: "hello+test@sergiodxa.com" });

		expect((await Lead.findByEmail(db, "hello@sergiodxa.com"))?.id).toBe(created.id);
		expect((await Lead.findByEmail(db, "HELLO@SERGIODXA.COM"))?.id).toBe(created.id);
	});
});

describe("Lead.findById", () => {
	test("finds the lead a watch belongs to", async () => {
		let created = await upsert();

		expect((await Lead.findById(db, created.id))?.email).toBe("visitor@example.com");
	});
});

describe("Lead.findByUnsubscribeToken", () => {
	test("resolves the lead an unsubscribe link identifies", async () => {
		let lead = await upsert();

		expect((await Lead.findByUnsubscribeToken(db, lead.unsubscribe_token))?.id).toBe(lead.id);
	});

	test("returns null for an unknown token rather than guessing", async () => {
		await upsert();

		expect(await Lead.findByUnsubscribeToken(db, "not-a-token")).toBeNull();
	});

	test("a second click on the same link is a no-op, not an error", async () => {
		let lead = await upsert();
		await Lead.forget(db, lead.id);

		expect(await Lead.findByUnsubscribeToken(db, lead.unsubscribe_token)).toBeNull();
	});
});

describe("Lead.forget", () => {
	test("removes the lead, its watches and every result behind them", async () => {
		let lead = await upsert();
		let first = await TrialWatch.create(db, lead.id, { url: "https://a.example" });
		let second = await TrialWatch.create(db, lead.id, { url: "https://b.example" });
		await TrialWatch.recordCheck(db, first, { status: "up", responseTimeMs: 100 });
		await TrialWatch.recordCheck(db, second, { status: "down", responseTimeMs: null });

		await Lead.forget(db, lead.id);

		expect(await db.count(leads)).toBe(0);
		expect(await db.count(trialWatches)).toBe(0);
		expect(await db.count(trialWatchResults)).toBe(0);
	});

	test("takes convertible watches too, so unsubscribing forfeits the offer", async () => {
		let lead = await upsert();
		let watch = await TrialWatch.create(db, lead.id, { url: "https://a.example" });

		expect(TrialWatch.isConvertible(watch, Date.now())).toBe(true);
		await Lead.forget(db, lead.id);

		expect(await TrialWatch.listConvertibleByLead(db, lead.id, Date.now())).toHaveLength(0);
	});

	/** The distinction the two names carry: the sweep honours windows, `forget` removes. */
	test("removes a lead the scheduled sweep would have refused to touch", async () => {
		let lead = await upsert();
		await TrialWatch.create(db, lead.id, { url: "https://a.example" });

		await Lead.deleteOrphaned(db, Date.now());
		expect(await Lead.findById(db, lead.id)).not.toBeNull();

		await Lead.forget(db, lead.id);
		expect(await Lead.findById(db, lead.id)).toBeNull();
	});

	test("never touches another lead's data", async () => {
		let gone = await upsert({ email: "gone@example.com" });
		let kept = await upsert({ email: "kept@example.com" });
		await TrialWatch.create(db, gone.id, { url: "https://a.example" });
		let keptWatch = await TrialWatch.create(db, kept.id, {
			url: "https://b.example",
		});
		await TrialWatch.recordCheck(db, keptWatch, { status: "up", responseTimeMs: 100 });

		await Lead.forget(db, gone.id);

		expect(await Lead.findById(db, kept.id)).not.toBeNull();
		expect(await TrialWatch.listByLead(db, kept.id)).toHaveLength(1);
		expect(await db.count(trialWatchResults)).toBe(1);
	});

	test("handing the address over again starts a fresh lead with a fresh token", async () => {
		let first = await upsert();
		await Lead.forget(db, first.id);

		let second = await upsert();

		expect(second.id).not.toBe(first.id);
		expect(second.unsubscribe_token).not.toBe(first.unsubscribe_token);
	});
});

describe("shouldSendDigest", () => {
	let created = Date.parse("2026-08-02T09:00:00Z");

	test("sends no digest on the day the lead signed up", () => {
		let sameDay = Date.parse("2026-08-02T23:00:00Z");

		expect(shouldSendDigest({ created_at: created, last_digest_at: null }, sameDay)).toBe(false);
	});

	test("sends the first digest the next day, covering a full day of checks", () => {
		let nextDay = Date.parse("2026-08-03T00:30:00Z");

		expect(shouldSendDigest({ created_at: created, last_digest_at: null }, nextDay)).toBe(true);
	});

	test("sends exactly one per day however often the job runs", () => {
		let sentAt = Date.parse("2026-08-03T00:30:00Z");
		let laterSameDay = Date.parse("2026-08-03T22:00:00Z");

		expect(shouldSendDigest({ created_at: created, last_digest_at: sentAt }, laterSameDay)).toBe(
			false,
		);
	});

	test("sends the next one on the following day", () => {
		let sentAt = Date.parse("2026-08-03T00:30:00Z");
		let nextDay = Date.parse("2026-08-04T00:30:00Z");

		expect(shouldSendDigest({ created_at: created, last_digest_at: sentAt }, nextDay)).toBe(true);
	});
});

describe("Lead.listDueForDigest", () => {
	/** A lead with one active watch, created far enough back to be due a digest. */
	async function leadWithActiveWatch(email: string) {
		let lead = await upsert({ email });
		await TrialWatch.create(db, lead.id, { url: `https://${email}` });
		await db.update(leads, lead.id, { created_at: Date.now() - 2 * MS_PER_DAY });
		return lead;
	}

	test("returns a lead with an active watch that has had no digest today", async () => {
		let lead = await leadWithActiveWatch("one@example.com");

		let due = await Lead.listDueForDigest(db, Date.now());

		expect(due.map((each) => each.id)).toEqual([lead.id]);
	});

	test("returns a lead once, however many targets they are watching", async () => {
		let lead = await leadWithActiveWatch("one@example.com");
		await TrialWatch.create(db, lead.id, { url: "https://two.example" });
		await TrialWatch.create(db, lead.id, { url: "three.example" });

		let due = await Lead.listDueForDigest(db, Date.now());

		expect(due).toHaveLength(1);
	});

	test("skips a lead with no watches at all", async () => {
		await upsert({ email: "empty@example.com" });
		await db.update(leads, (await upsert({ email: "empty@example.com" })).id, {
			created_at: Date.now() - 2 * MS_PER_DAY,
		});

		expect(await Lead.listDueForDigest(db, Date.now())).toHaveLength(0);
	});

	test("skips a lead whose every watch has finished", async () => {
		let lead = await leadWithActiveWatch("done@example.com");
		let [watch] = await TrialWatch.listByLead(db, lead.id);
		if (watch) await TrialWatch.finish(db, watch.id);

		expect(await Lead.listDueForDigest(db, Date.now())).toHaveLength(0);
	});

	test("skips a lead on the day they signed up", async () => {
		let lead = await upsert({ email: "fresh@example.com" });
		await TrialWatch.create(db, lead.id, { url: "https://fresh.example" });

		expect(await Lead.listDueForDigest(db, Date.now())).toHaveLength(0);
	});

	test("skips a lead already sent a digest today, and returns them again tomorrow", async () => {
		let lead = await leadWithActiveWatch("one@example.com");
		let now = Date.now();
		await Lead.markDigestSent(db, lead.id, now);

		expect(await Lead.listDueForDigest(db, now)).toHaveLength(0);
		expect((await Lead.listDueForDigest(db, now + MS_PER_DAY)).map((each) => each.id)).toEqual([
			lead.id,
		]);
	});

	test("agrees with the predicate it is the SQL form of", async () => {
		let lead = await leadWithActiveWatch("one@example.com");
		let now = Date.now();
		let [due] = await Lead.listDueForDigest(db, now);

		expect(due?.id).toBe(lead.id);
		expect(due ? shouldSendDigest(due, now) : false).toBe(true);
	});
});

describe("Lead.markDigestSent", () => {
	test("stamping the digest is what closes the day's bound", async () => {
		let lead = await upsert();
		let now = Date.now();

		await Lead.markDigestSent(db, lead.id, now);
		let stored = await Lead.findById(db, lead.id);

		expect(stored?.last_digest_at).toBe(now);
		expect(stored ? shouldSendDigest(stored, now) : true).toBe(false);
	});
});

describe("Lead.recordEmailSent", () => {
	test("a new lead has received nothing", async () => {
		expect((await upsert()).emails_sent).toBe(0);
	});

	test("counts one email at a time", async () => {
		let lead = await upsert();

		await Lead.recordEmailSent(db, lead.id);
		await Lead.recordEmailSent(db, lead.id);

		expect((await Lead.findById(db, lead.id))?.emails_sent).toBe(2);
	});

	/**
	 * The reason the increment is one SQL statement. Two of the four sends run concurrently
	 * over a batch of leads, where a read-modify-write would drop increments for exactly the
	 * busiest lead.
	 */
	test("loses no count when several sends land at once", async () => {
		let lead = await upsert();

		await Promise.all(Array.from({ length: 10 }, () => Lead.recordEmailSent(db, lead.id)));

		expect((await Lead.findById(db, lead.id))?.emails_sent).toBe(10);
	});

	test("counts against one lead and not another", async () => {
		let one = await upsert({ email: "one@example.com" });
		let two = await upsert({ email: "two@example.com" });

		await Lead.recordEmailSent(db, one.id);

		expect((await Lead.findById(db, one.id))?.emails_sent).toBe(1);
		expect((await Lead.findById(db, two.id))?.emails_sent).toBe(0);
	});
});

describe("Lead.countFunnelActivity", () => {
	test("counts creations and digests inside the window and nothing outside it", async () => {
		let day = 24 * 60 * 60 * 1000;
		let start = Date.UTC(2026, 6, 1);

		let inside = await upsert({ email: "inside@example.com" });
		let outside = await upsert({ email: "outside@example.com" });
		await db.update(leads, inside.id, { created_at: start + 1000 }, { touch: false });
		await db.update(leads, outside.id, { created_at: start - 1000 }, { touch: false });
		await Lead.markDigestSent(db, outside.id, start + 2000);

		let counts = await Lead.countFunnelActivity(db, start, start + day);

		expect(counts.created).toBe(1);
		expect(counts.digestsSent).toBe(1);
	});

	test("answers with zeroes when there are no leads at all", async () => {
		expect(await Lead.countFunnelActivity(db, 0, Date.now())).toEqual({
			created: 0,
			digestsSent: 0,
		});
	});
});

describe("Lead.hasMarketingConsent", () => {
	test("separates an email given for the watch from consent to be marketed to", async () => {
		let withoutConsent = await upsert({ email: "quiet@example.com", consented: false });
		let withConsent = await upsert({ email: "loud@example.com", consented: true });

		expect(Lead.hasMarketingConsent(withoutConsent)).toBe(false);
		expect(Lead.hasMarketingConsent(withConsent)).toBe(true);
	});
});

describe("Lead.deleteOrphaned", () => {
	/** A lead old enough to be past the anti-race grace period. */
	async function agedLead(email: string, overrides: Partial<LeadInput> = {}) {
		let lead = await upsert({ email, ...overrides });
		await db.update(leads, lead.id, { created_at: Date.now() - 2 * MS_PER_DAY });
		return lead;
	}

	test("deletes a lead that has no watches left", async () => {
		await agedLead("gone@example.com");

		let swept = await Lead.deleteOrphaned(db, Date.now());

		expect(swept.rowsAffected).toBe(1);
		expect(swept.reachedCeiling).toBe(false);
		expect(await db.count(leads)).toBe(0);
	});

	test("keeps a lead that still has a watch, however old the watch is", async () => {
		let lead = await agedLead("kept@example.com");
		await TrialWatch.create(db, lead.id, { url: "https://kept.example" });

		await Lead.deleteOrphaned(db, Date.now());

		expect(await Lead.findById(db, lead.id)).not.toBeNull();
	});

	/**
	 * The ordering the whole cleanup rests on: at day 32 the first attempt is past its own
	 * conversion window while the two later ones are still open, so the watch sweep takes one
	 * row and the lead survives with the offers that remain.
	 */
	test("keeps a lead whose later attempts are still claimable after the watch sweep", async () => {
		let lead = await agedLead("partial@example.com");
		let now = Date.now();

		let first = await TrialWatch.create(db, lead.id, { url: "https://a.example" });
		let second = await TrialWatch.create(db, lead.id, { url: "https://b.example" });
		let third = await TrialWatch.create(db, lead.id, { url: "https://c.example" });

		await db.update(trialWatches, first.id, { converts_until: now - 2 * MS_PER_DAY });
		await db.update(trialWatches, second.id, { converts_until: now + 1 * MS_PER_DAY });
		await db.update(trialWatches, third.id, { converts_until: now + 4 * MS_PER_DAY });

		await TrialWatch.deleteExpired(db, now);
		await Lead.deleteOrphaned(db, now);

		expect(await Lead.findById(db, lead.id)).not.toBeNull();
		expect((await TrialWatch.listByLead(db, lead.id)).map((watch) => watch.id).sort()).toEqual(
			[second.id, third.id].sort(),
		);
	});

	test("deletes the lead only once its last attempt has expired too", async () => {
		let lead = await agedLead("finally@example.com");
		let now = Date.now();
		let watch = await TrialWatch.create(db, lead.id, { url: "https://a.example" });
		await db.update(trialWatches, watch.id, { converts_until: now - 1 });

		await TrialWatch.deleteExpired(db, now);
		await Lead.deleteOrphaned(db, now);

		expect(await Lead.findById(db, lead.id)).toBeNull();
	});

	/**
	 * The sweep applies to consented leads too. Every email this feature sends is driven by a
	 * watch, so once the last one is gone the consent has nothing left to authorise, and an
	 * exemption would make the sweep a no-op for the people most likely to have consented.
	 */
	test("deletes a lead who gave marketing consent, once no watch is left to email about", async () => {
		let lead = await agedLead("consented@example.com", { consented: true });

		await Lead.deleteOrphaned(db, Date.now());

		expect(await Lead.findById(db, lead.id)).toBeNull();
	});

	test("still keeps a consented lead while a watch of theirs survives", async () => {
		let lead = await agedLead("consented@example.com", { consented: true });
		await TrialWatch.create(db, lead.id, { url: "https://a.example" });

		await Lead.deleteOrphaned(db, Date.now());

		expect(await Lead.findById(db, lead.id)).not.toBeNull();
	});

	test("never deletes a lead whose first watch is still being written", async () => {
		let lead = await upsert({ email: "racing@example.com" });

		await Lead.deleteOrphaned(db, Date.now());

		expect(await Lead.findById(db, lead.id)).not.toBeNull();
		await Lead.deleteOrphaned(db, Date.now() + ORPHANED_LEAD_GRACE_MS + 1);
		expect(await Lead.findById(db, lead.id)).toBeNull();
	});
});

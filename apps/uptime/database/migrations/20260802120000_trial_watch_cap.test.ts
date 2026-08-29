/**
 * Tests the one migration in this app that converts existing data: `leads.email`'s unique
 * index moves to `normalized_email`, so rows that collide under the new key — like
 * `hello@x.com` and `hello+news@x.com` — must be merged first, deciding what happens to
 * each one's watches, counters, consent, and token. Getting a merge decision wrong would be
 * silent and unrecoverable, so every case here runs against a real database and seed data.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SqliteDatabase } from "@pkg/cloudflare-mocks/sqlite";

import { openDatabase } from "@pkg/cloudflare-mocks/sqlite";
import { beforeEach, describe, expect, test } from "vitest";

import { applyMigration, applyMigrations } from "~/app/lib/test/db";

/** The migration under test, and the point every seed is written before. */
const MIGRATION = "20260802120000_trial_watch_cap.sql";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

let sqlite: SqliteDatabase;

beforeEach(() => {
	sqlite = openDatabase(":memory:");
	applyMigrations(sqlite, MIGRATION);
});

/** One lead as the schema held it before this migration: no `normalized_email` column. */
function seedLead(lead: {
	id: string;
	email: string;
	createdAt: number;
	updatedAt?: number;
	locale?: string;
	consentedAt?: number | null;
	lastDigestAt?: number | null;
	emailsSent?: number;
}) {
	sqlite.exec(
		`INSERT INTO leads (id, created_at, updated_at, email, unsubscribe_token, locale,
		                    consented_at, last_digest_at, emails_sent)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			lead.id,
			lead.createdAt,
			lead.updatedAt ?? lead.createdAt,
			lead.email,
			`token-${lead.id}`,
			lead.locale ?? "en",
			lead.consentedAt ?? null,
			lead.lastDigestAt ?? null,
			lead.emailsSent ?? 0,
		],
	);
}

/** One watch as the schema held it before this migration: no `normalized_url` column. */
function seedWatch(watch: { id: string; leadId: string; url: string; createdAt?: number }) {
	let createdAt = watch.createdAt ?? Date.UTC(2026, 6, 1);

	sqlite.exec(
		`INSERT INTO trial_watches (id, created_at, updated_at, lead_id, url, expires_at,
		                            converts_until)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		[
			watch.id,
			createdAt,
			createdAt,
			watch.leadId,
			watch.url,
			createdAt + 7 * MS_PER_DAY,
			createdAt + 30 * MS_PER_DAY,
		],
	);
}

/** Every lead left after the migration, in a shape a test can read directly. */
function readLeads() {
	return sqlite
		.query(
			`SELECT id, email, normalized_email, unsubscribe_token, locale, consented_at,
			        last_digest_at, emails_sent, updated_at
			   FROM leads ORDER BY created_at ASC, id ASC`,
		)
		.all() as {
		id: string;
		email: string;
		normalized_email: string;
		unsubscribe_token: string;
		locale: string;
		consented_at: number | null;
		last_digest_at: number | null;
		emails_sent: number;
		updated_at: number;
	}[];
}

describe("trial watch cap migration: normalized_email backfill", () => {
	test("keys an ordinary address as its lowercased self", () => {
		seedLead({ id: "lead-1", email: "Visitor@Example.com", createdAt: 1 });

		applyMigration(sqlite, MIGRATION);

		expect(readLeads()[0]?.normalized_email).toBe("visitor@example.com");
	});

	test("cuts the tag out of the local part", () => {
		seedLead({ id: "lead-1", email: "hello+news@sergiodxa.com", createdAt: 1 });

		applyMigration(sqlite, MIGRATION);

		expect(readLeads()[0]?.normalized_email).toBe("hello@sergiodxa.com");
	});

	test("keeps dots, so two spellings stay two leads", () => {
		seedLead({ id: "lead-1", email: "he.llo@gmail.com", createdAt: 1 });
		seedLead({ id: "lead-2", email: "hello@gmail.com", createdAt: 2 });

		applyMigration(sqlite, MIGRATION);

		expect(readLeads()).toHaveLength(2);
	});

	test("leaves a local part that is nothing but a tag alone", () => {
		seedLead({ id: "lead-1", email: "+tag@sergiodxa.com", createdAt: 1 });

		applyMigration(sqlite, MIGRATION);

		expect(readLeads()[0]?.normalized_email).toBe("+tag@sergiodxa.com");
	});
});

describe("trial watch cap migration: collision merge", () => {
	/**
	 * The case that would otherwise abort the migration: the unique index cannot be created
	 * over two rows that now share a key, so they have to become one row first.
	 */
	test("merges two leads that normalize onto one key", () => {
		seedLead({ id: "older", email: "hello@sergiodxa.com", createdAt: 1_000 });
		seedLead({ id: "newer", email: "Hello+News@Sergiodxa.com", createdAt: 2_000 });

		applyMigration(sqlite, MIGRATION);

		let rows = readLeads();
		expect(rows).toHaveLength(1);
		expect(rows[0]?.normalized_email).toBe("hello@sergiodxa.com");
	});

	/**
	 * The oldest row survives, because `created_at` is copied onto `trial_conversions` as when
	 * this person first arrived and `unsubscribe_token` is the link already sitting in their
	 * inbox from the first email we ever sent them.
	 */
	test("keeps the oldest row's identity and its unsubscribe token", () => {
		seedLead({ id: "older", email: "hello@sergiodxa.com", createdAt: 1_000 });
		seedLead({ id: "newer", email: "hello+news@sergiodxa.com", createdAt: 2_000 });

		applyMigration(sqlite, MIGRATION);

		let [survivor] = readLeads();
		expect(survivor?.id).toBe("older");
		expect(survivor?.unsubscribe_token).toBe("token-older");
	});

	/** The deliverable address and the language follow the same rule a repeat submission does. */
	test("takes the address and locale from the most recently updated row", () => {
		seedLead({
			id: "older",
			email: "hello@sergiodxa.com",
			createdAt: 1_000,
			updatedAt: 1_000,
			locale: "en",
		});
		seedLead({
			id: "newer",
			email: "hello+news@sergiodxa.com",
			createdAt: 2_000,
			updatedAt: 5_000,
			locale: "es",
		});

		applyMigration(sqlite, MIGRATION);

		let [survivor] = readLeads();
		expect(survivor?.email).toBe("hello+news@sergiodxa.com");
		expect(survivor?.locale).toBe("es");
		expect(survivor?.updated_at).toBe(5_000);
	});

	test("sums the emails both rows were sent, since one person received all of them", () => {
		seedLead({ id: "older", email: "hello@sergiodxa.com", createdAt: 1_000, emailsSent: 4 });
		seedLead({ id: "newer", email: "hello+news@sergiodxa.com", createdAt: 2_000, emailsSent: 3 });

		applyMigration(sqlite, MIGRATION);

		expect(readLeads()[0]?.emails_sent).toBe(7);
	});

	/** Consent given once survives every later row, even one that never ticked the box. */
	test("keeps the earliest consent and never loses one to a null", () => {
		seedLead({
			id: "older",
			email: "hello@sergiodxa.com",
			createdAt: 1_000,
			consentedAt: null,
		});
		seedLead({
			id: "newer",
			email: "hello+news@sergiodxa.com",
			createdAt: 2_000,
			consentedAt: 7_777,
		});

		applyMigration(sqlite, MIGRATION);

		expect(readLeads()[0]?.consented_at).toBe(7_777);
	});

	/** Merging keeps the later of the two digest stamps, capping the merged person at one digest per day. */
	test("keeps the latest digest stamp", () => {
		seedLead({
			id: "older",
			email: "hello@sergiodxa.com",
			createdAt: 1_000,
			lastDigestAt: 3_000,
		});
		seedLead({
			id: "newer",
			email: "hello+news@sergiodxa.com",
			createdAt: 2_000,
			lastDigestAt: 9_000,
		});

		applyMigration(sqlite, MIGRATION);

		expect(readLeads()[0]?.last_digest_at).toBe(9_000);
	});

	/**
	 * The half that would be worst to get wrong. A watch left pointing at a deleted lead is a
	 * URL somebody is still owed a monitor for, with nothing left that can find it.
	 */
	test("re-points every watch of a merged-away lead at the survivor", () => {
		seedLead({ id: "older", email: "hello@sergiodxa.com", createdAt: 1_000 });
		seedLead({ id: "newer", email: "hello+news@sergiodxa.com", createdAt: 2_000 });
		seedWatch({ id: "watch-a", leadId: "older", url: "https://a.example" });
		seedWatch({ id: "watch-b", leadId: "newer", url: "https://b.example" });

		applyMigration(sqlite, MIGRATION);

		let watches = sqlite.query("SELECT id, lead_id FROM trial_watches ORDER BY id ASC").all() as {
			id: string;
			lead_id: string;
		}[];

		expect(watches.map((row) => row.lead_id)).toEqual(["older", "older"]);
	});

	test("merges three spellings of one address down to one lead", () => {
		seedLead({ id: "a", email: "hello+a@sergiodxa.com", createdAt: 1_000 });
		seedLead({ id: "b", email: "hello+b@sergiodxa.com", createdAt: 2_000 });
		seedLead({ id: "c", email: "HELLO@SERGIODXA.COM", createdAt: 3_000 });
		seedWatch({ id: "watch-a", leadId: "a", url: "https://a.example" });
		seedWatch({ id: "watch-b", leadId: "b", url: "https://b.example" });
		seedWatch({ id: "watch-c", leadId: "c", url: "https://c.example" });

		applyMigration(sqlite, MIGRATION);

		expect(readLeads()).toHaveLength(1);

		let watches = sqlite.query("SELECT lead_id FROM trial_watches").all() as {
			lead_id: string;
		}[];
		expect(new Set(watches.map((row) => row.lead_id))).toEqual(new Set(["a"]));
	});

	test("leaves two genuinely different people as two leads", () => {
		seedLead({ id: "one", email: "one@sergiodxa.com", createdAt: 1_000 });
		seedLead({ id: "two", email: "two@sergiodxa.com", createdAt: 2_000 });

		applyMigration(sqlite, MIGRATION);

		expect(readLeads().map((row) => row.id)).toEqual(["one", "two"]);
	});

	test("creates the unique index the merge exists to make possible", () => {
		seedLead({ id: "older", email: "hello@sergiodxa.com", createdAt: 1_000 });
		seedLead({ id: "newer", email: "hello+news@sergiodxa.com", createdAt: 2_000 });

		applyMigration(sqlite, MIGRATION);

		expect(() =>
			sqlite.exec(
				`INSERT INTO leads (id, created_at, updated_at, email, normalized_email,
				                    unsubscribe_token, locale, emails_sent)
				 VALUES ('dupe', 1, 1, 'x@y.com', 'hello@sergiodxa.com', 'token-dupe', 'en', 0)`,
			),
		).toThrow();
	});

	/** The address itself is no longer unique, which is what lets two tags coexist as one lead. */
	test("drops the unique index on the raw address", () => {
		applyMigration(sqlite, MIGRATION);

		let indexes = sqlite
			.query("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'leads'")
			.all() as { name: string }[];

		expect(indexes.map((row) => row.name)).not.toContain("leads_email_unique");
		expect(indexes.map((row) => row.name)).toContain("leads_normalized_email_unique");
	});
});

describe("trial watch cap migration: normalized_url backfill", () => {
	function readWatch(id: string) {
		return sqlite.query("SELECT url, normalized_url FROM trial_watches WHERE id = ?").get(id) as {
			url: string;
			normalized_url: string;
		} | null;
	}

	beforeEach(() => {
		seedLead({ id: "lead-1", email: "visitor@example.com", createdAt: 1 });
	});

	test("leaves the URL as typed, which is the one that gets fetched", () => {
		seedWatch({ id: "watch-1", leadId: "lead-1", url: "https://example.com/health/" });

		applyMigration(sqlite, MIGRATION);

		expect(readWatch("watch-1")?.url).toBe("https://example.com/health/");
	});

	test("strips the trailing slash", () => {
		seedWatch({ id: "watch-1", leadId: "lead-1", url: "https://example.com/" });

		applyMigration(sqlite, MIGRATION);

		expect(readWatch("watch-1")?.normalized_url).toBe("https://example.com");
	});

	test("drops the fragment", () => {
		seedWatch({ id: "watch-1", leadId: "lead-1", url: "https://example.com/a#top" });

		applyMigration(sqlite, MIGRATION);

		expect(readWatch("watch-1")?.normalized_url).toBe("https://example.com/a");
	});

	test("drops a fragment that was the only thing after the slash", () => {
		seedWatch({ id: "watch-1", leadId: "lead-1", url: "https://example.com/#pricing" });

		applyMigration(sqlite, MIGRATION);

		expect(readWatch("watch-1")?.normalized_url).toBe("https://example.com");
	});

	test("keeps http and https apart", () => {
		seedWatch({ id: "plain", leadId: "lead-1", url: "http://example.com/" });
		seedWatch({ id: "secure", leadId: "lead-1", url: "https://example.com/" });

		applyMigration(sqlite, MIGRATION);

		expect(readWatch("plain")?.normalized_url).toBe("http://example.com");
		expect(readWatch("secure")?.normalized_url).toBe("https://example.com");
	});
});

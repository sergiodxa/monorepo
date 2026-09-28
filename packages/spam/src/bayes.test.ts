/**
 * Tests the classifier end to end: how submissions become tokens, the cold-start gate, learning
 * from reports until new submissions draw spam and ham signals, and the data-table store running
 * its upserts on a real SQLite engine, including that two databases never share counts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { DatabaseSync as SqliteDatabase } from "node:sqlite";

import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { createSqliteDatabase } from "remix/data-table/sqlite";
import { describe, expect, test } from "vitest";

import type { TokenStore } from "./bayes.js";
import type { Label, SpamCheck, Submission } from "./check.js";

import {
	bayes,
	DataTableTokenStore,
	MemoryTokenStore,
	SPAM_TOKENS_SCHEMA_SQL,
	spamTokens,
	tokenize,
} from "./bayes.js";
import { DOCUMENTS_TOKEN } from "./bayes/data-table.js";
import { createSpamFilter } from "./filter.js";

/** Spam in the shape a comment form receives it: pills, casinos and links to cash in. */
const SPAM_DOCS: Submission[] = [
	{ content: "Cheap pills online, buy viagra now at https://pills.example" },
	{ content: "Casino bonus! Free spins and cheap credits https://casino.example" },
	{ content: "Buy cheap replica watches, discount prices https://watches.example" },
	{ content: "Earn money fast from home, casino jackpot https://casino.example/win" },
	{ content: "Viagra pills discount, order now https://pills.example/order" },
	{ content: "Free bonus credits, cheap loans approved instantly https://loans.example" },
];

/** Ham from the same site: people talking about the article and the release. */
const HAM_DOCS: Submission[] = [
	{ content: "Great article about the release schedule, thanks for writing it" },
	{ content: "The migration guide helped me upgrade our project this morning" },
	{ content: "I think the release notes miss the breaking change in the router" },
	{ content: "Thanks, the example about the router finally made it click for me" },
	{ content: "Could you write a follow-up article about testing the migration?" },
	{ content: "Our team upgraded the project after reading the release notes" },
];

/** What the filter passes every call; the classifier reads none of it. */
const OPTIONS: SpamCheck.Options = { signal: new AbortController().signal, score: 0, signals: [] };

/** Builds an in-memory database with the package's own schema applied. */
function createTestDatabase() {
	let sqlite = new SqliteDatabase(":memory:");
	sqlite.exec(SPAM_TOKENS_SCHEMA_SQL);
	return createSqliteDatabase(sqlite);
}

/** Reports every document in `docs` under `label` through the check's own `report`. */
async function train(check: ReturnType<typeof bayes>, docs: Submission[], label: Label) {
	for (let doc of docs) expect(isSuccess(await check.report!(doc, label))).toBe(true);
}

/** Runs the check and unwraps its answer, which is always a `Result` for this check. */
async function signalsOf(check: ReturnType<typeof bayes>, submission: Submission) {
	let answer = await check.check(submission, OPTIONS);
	if (Array.isArray(answer)) throw new TypeError("bayes answers a Result");
	return unwrap(answer);
}

describe("tokenize", () => {
	test("lowercases words, keeps the length window and drops duplicates", () => {
		expect(
			tokenize({ content: "Go BUY buy it’s a Supercalifragilisticexpialidocious deal" }),
		).toEqual(["buy", "it’s", "deal"]);
	});

	test("puts link hosts first without www, including the author's website", () => {
		let tokens = tokenize({
			content: "see https://www.Shop.example/a and www.other.example",
			author: { url: "https://author.example/me" },
		});
		expect(tokens.slice(0, 3)).toEqual([
			"host:shop.example",
			"host:other.example",
			"host:author.example",
		]);
		expect(tokens).toContain("see");
		expect(tokens).not.toContain("shop");
	});

	test("adds the author's email domain unless disabled", () => {
		let submission = { content: "hello there", author: { email: "Someone@Mail.Example" } };
		expect(tokenize(submission)).toContain("email-domain:mail.example");
		expect(tokenize(submission, { emailDomain: false })).not.toContain("email-domain:mail.example");
	});

	test("caps the token count", () => {
		let content = Array.from({ length: 50 }, (_, index) => `word${index}`).join(" ");
		expect(tokenize({ content }, { maxTokens: 10 })).toHaveLength(10);
	});

	test("honors a custom length window", () => {
		expect(tokenize({ content: "ab abcd abcdefgh" }, { minLength: 2, maxLength: 4 })).toEqual([
			"ab",
			"abcd",
		]);
	});
});

describe("bayes", () => {
	test("runs in the local stage and learns from reports", () => {
		let check = bayes({ store: new MemoryTokenStore() });
		expect(check.stage).toBe("local");
		expect("report" in check).toBe(true);
	});

	test("emits nothing until each label reaches minDocuments", async () => {
		let check = bayes({ store: new MemoryTokenStore(), minDocuments: 6 });
		await train(check, SPAM_DOCS, "spam");
		await train(check, HAM_DOCS.slice(0, 5), "ham");
		let spammy = { content: "cheap casino pills https://casino.example" };

		expect(await signalsOf(check, spammy)).toEqual([]);

		await train(check, HAM_DOCS.slice(5), "ham");
		expect(await signalsOf(check, spammy)).toMatchObject([{ check: "bayes.spam" }]);
	});

	test("defaults to twenty reports of each label before speaking", async () => {
		let check = bayes({ store: new MemoryTokenStore() });
		for (let round = 0; round < 3; round++) {
			await train(check, SPAM_DOCS, "spam");
			await train(check, HAM_DOCS, "ham");
		}
		expect(await signalsOf(check, SPAM_DOCS[0]!)).toEqual([]);

		await train(check, SPAM_DOCS.slice(0, 2), "spam");
		await train(check, HAM_DOCS.slice(0, 2), "ham");
		expect(await signalsOf(check, SPAM_DOCS[0]!)).toMatchObject([{ check: "bayes.spam" }]);
	});

	test("scores unseen spam positively, naming its telling tokens", async () => {
		let check = bayes({ store: new MemoryTokenStore(), minDocuments: 5 });
		await train(check, SPAM_DOCS, "spam");
		await train(check, HAM_DOCS, "ham");

		let [signal, ...rest] = await signalsOf(check, {
			content: "Cheap casino bonus and discount pills https://pills.example",
		});

		expect(rest).toEqual([]);
		expect(signal).toMatchObject({ check: "bayes.spam", score: 6 });
		expect(signal!.detail).toMatch(/^spam probability 0\.9\d\d; tokens: /);
		expect(signal!.detail).toContain("cheap");
	});

	test("scores unseen ham negatively", async () => {
		let check = bayes({ store: new MemoryTokenStore(), minDocuments: 5, hamScore: -7 });
		await train(check, SPAM_DOCS, "spam");
		await train(check, HAM_DOCS, "ham");

		let signals = await signalsOf(check, {
			content: "The article about the router migration made the release easy",
		});

		expect(signals).toMatchObject([{ check: "bayes.ham", score: -7 }]);
		expect(signals[0]!.detail).toContain("router");
	});

	test("stays silent on text it has never seen", async () => {
		let check = bayes({ store: new MemoryTokenStore(), minDocuments: 5 });
		await train(check, SPAM_DOCS, "spam");
		await train(check, HAM_DOCS, "ham");

		expect(await signalsOf(check, { content: "zebra quantum lighthouse" })).toEqual([]);
	});

	test("learns an author's email domain", async () => {
		let check = bayes({ store: new MemoryTokenStore(), minDocuments: 5 });
		for (let doc of SPAM_DOCS) {
			await check.report!({ content: "hello", author: { email: `x@spam.example` } }, "spam");
			await check.report!(doc, "spam");
		}
		await train(check, HAM_DOCS, "ham");

		expect(
			await signalsOf(check, { content: "hello", author: { email: "y@spam.example" } }),
		).toMatchObject([{ check: "bayes.spam" }]);
	});

	test("pulls a filter's total below zero for ham it learned", async () => {
		let check = bayes({ store: new MemoryTokenStore(), minDocuments: 5 });
		let filter = createSpamFilter({ checks: [check] });
		for (let doc of SPAM_DOCS) expect(await filter.report(doc, "spam")).toEqual([]);
		for (let doc of HAM_DOCS) expect(await filter.report(doc, "ham")).toEqual([]);

		let assessment = await filter.check({ content: "Thanks for the release notes article" });

		expect(assessment).toMatchObject({ verdict: "ham", score: -4, failures: [] });
	});

	test("fails with unavailable when the store cannot be read", async () => {
		let check = bayes({
			store: new DataTableTokenStore(createSqliteDatabase(new SqliteDatabase(":memory:"))),
		});
		let answer = await check.check({ content: "anything" }, OPTIONS);
		if (Array.isArray(answer)) throw new TypeError("bayes answers a Result");

		expect(isFailure(answer) && answer.error.code).toBe("unavailable");
	});
});

describe("MemoryTokenStore", () => {
	test("counts a repeated token once per document", async () => {
		let store = new MemoryTokenStore();
		unwrap(await store.increment(["cheap", "cheap"], "spam"));

		let counts = unwrap(await store.read(["cheap", "absent"]));

		expect(counts.documents).toEqual({ spam: 1, ham: 0 });
		expect([...counts.tokens]).toEqual([["cheap", { spam: 1, ham: 0 }]]);
	});
});

describe("DataTableTokenStore", () => {
	test("upserts counts, adding to rows that already exist", async () => {
		let db = createTestDatabase();
		let store = new DataTableTokenStore(db);

		unwrap(await store.increment(["cheap", "pills"], "spam"));
		unwrap(await store.increment(["cheap", "article"], "spam"));
		unwrap(await store.increment(["cheap", "article"], "ham"));

		let counts = unwrap(await store.read(["cheap", "pills", "article", "absent"]));
		expect(counts.documents).toEqual({ spam: 2, ham: 1 });
		expect(Object.fromEntries(counts.tokens)).toEqual({
			cheap: { spam: 2, ham: 1 },
			pills: { spam: 1, ham: 0 },
			article: { spam: 1, ham: 1 },
		});
		expect(await db.count(spamTokens)).toBe(4);
		expect(await db.find(spamTokens, { token: DOCUMENTS_TOKEN })).toMatchObject({
			spam: 2,
			ham: 1,
		});
	});

	test("counts a document with no tokens", async () => {
		let store = new DataTableTokenStore(createTestDatabase());
		unwrap(await store.increment([], "ham"));

		expect(unwrap(await store.read([])).documents).toEqual({ spam: 0, ham: 1 });
	});

	test("writes and reads more tokens than one statement binds", async () => {
		let store = new DataTableTokenStore(createTestDatabase());
		let tokens = Array.from({ length: 250 }, (_, index) => `token${index}`);

		unwrap(await store.increment(tokens, "spam"));
		unwrap(await store.increment(tokens.slice(100), "spam"));

		let counts = unwrap(await store.read(tokens));
		expect(counts.documents).toEqual({ spam: 2, ham: 0 });
		expect(counts.tokens.size).toBe(250);
		expect(counts.tokens.get("token0")).toEqual({ spam: 1, ham: 0 });
		expect(counts.tokens.get("token249")).toEqual({ spam: 2, ham: 0 });
	});

	test("keeps each database's counts to itself", async () => {
		let tenantA = new DataTableTokenStore(createTestDatabase());
		let tenantB = new DataTableTokenStore(createTestDatabase());

		unwrap(await tenantA.increment(["cheap"], "spam"));

		let counts = unwrap(await tenantB.read(["cheap"]));
		expect(counts.documents).toEqual({ spam: 0, ham: 0 });
		expect(counts.tokens.size).toBe(0);
	});

	test("trains the classifier to the same verdicts as the memory store", async () => {
		let stores: TokenStore[] = [
			new MemoryTokenStore(),
			new DataTableTokenStore(createTestDatabase()),
		];
		let verdicts = [];
		for (let store of stores) {
			let check = bayes({ store, minDocuments: 5 });
			await train(check, SPAM_DOCS, "spam");
			await train(check, HAM_DOCS, "ham");
			verdicts.push(await signalsOf(check, { content: "cheap casino pills" }));
		}

		expect(verdicts[0]).toMatchObject([{ check: "bayes.spam" }]);
		expect(verdicts[1]).toEqual(verdicts[0]);
	});

	test("fails with unavailable when the table is missing", async () => {
		let store = new DataTableTokenStore(createSqliteDatabase(new SqliteDatabase(":memory:")));
		let written = await store.increment(["cheap"], "spam");

		expect(isFailure(written) && written.error.code).toBe("unavailable");
	});
});

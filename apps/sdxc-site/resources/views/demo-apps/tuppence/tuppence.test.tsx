/**
 * Holds Tuppence's server side to what a visitor relies on: money adds up to the cent, the
 * visitor's changes survive in cookies and a tampered one only loses them, every post returns
 * to Tuppence's own screens, and a transfer or pot move never takes more than there is.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { allocate, parseAmount } from "@sdxc/money";
import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";

import { ACCOUNTS, findAccount, statement, toHome } from "./data";
import { budgetStatuses, monthToDate, spendingByCategory } from "./figures";
import { balanceOf, entries, readWallet } from "./state";

/** Posts a form to a Tuppence action path with the given cookie. */
async function post(page: string, fields: Record<string, string>, cookie = "") {
	return await fetchApp(`/demo/apps/tuppence/${page}`, {
		method: "POST",
		body: new URLSearchParams(fields),
		headers: cookie === "" ? {} : { Cookie: cookie },
		redirect: "manual",
	});
}

/** The `name=value` parts of a response's `Set-Cookie` headers, joined as a `Cookie` header. */
function cookiesOf(response: Response): string {
	return response.headers
		.getSetCookie()
		.map((cookie) => cookie.split(";")[0])
		.join("; ");
}

/** A page's HTML for a cookie. */
async function page(path: string, cookie = ""): Promise<string> {
	let response = await fetchApp(`/demo/apps/tuppence${path}`, {
		headers: cookie === "" ? {} : { Cookie: cookie },
	});
	return await response.text();
}

describe("Tuppence's money", () => {
	test("reads amounts typed in the app's locale and converts at its rates", () => {
		expect(parseAmount("1,204.50", "EUR", { locale: "en-IE" })).toBe(120450);
		expect(toHome(10000, "GBP")).toBe(11712);
		expect(toHome(84500, "JPY")).toBe(51579);
	});
});

describe("Tuppence's statement", () => {
	test("is the same on every build, newest first, with today's last card payments pending", () => {
		let all = statement();
		expect(all.length).toBeGreaterThan(150);
		expect(all.map((entry) => entry.id)).toEqual(statement().map((entry) => entry.id));
		let dates = all.map((entry) => `${entry.date}${entry.time}`);
		expect(dates).toEqual([...dates].sort().reverse());
		expect(all.filter((entry) => entry.pending).length).toBeLessThanOrEqual(2);
	});

	test("compares this month with the same days of last month", () => {
		let figures = monthToDate(readWallet(null));
		expect(figures.thisCurve).toHaveLength(18);
		expect(figures.total).toBe(
			spendingByCategory(readWallet(null), "2026-11").reduce((sum, row) => sum + row.total, 0),
		);
		expect(figures.before).toBeLessThanOrEqual(figures.beforeWhole);
	});

	test("flags one budget over and one near, so the alert means something", () => {
		let states = budgetStatuses(readWallet(null)).map((status) => status.state);
		expect(states.filter((state) => state === "over")).toHaveLength(1);
		expect(states.filter((state) => state === "near").length).toBeGreaterThanOrEqual(1);
	});
});

describe("Tuppence's visitor state", () => {
	test("drops unknown categories, out-of-range splits and unknown cards from tampered cookies", () => {
		let edits = encodeURIComponent(
			JSON.stringify({ t0190: { category: "yachts", split: 99, note: "x".repeat(400) } }),
		);
		let wallet = readWallet(`tuppence.edits=${edits}; tuppence.frozen=everyday%2Cnope`);
		expect(wallet.edits.t0190?.category).toBeUndefined();
		expect(wallet.edits.t0190?.split).toBeUndefined();
		expect(wallet.edits.t0190?.note).toHaveLength(140);
		expect(wallet.frozen).toEqual(["everyday"]);
		expect(readWallet("tuppence.edits=%7Bbroken").edits).toEqual({});
	});

	test("counts the visitor's share of a split bill as their spending", () => {
		let entry = statement().find((row) => row.merchant === "tasca")!;
		let edits = encodeURIComponent(JSON.stringify({ [entry.id]: { split: 3 } }));
		let split = entries(readWallet(`tuppence.edits=${edits}`)).find((row) => row.id === entry.id)!;
		expect(split.share).toBe(allocate(entry.amount, 3)[2]);
		expect(split.amount).toBe(entry.amount);
	});
});

describe("Tuppence's posts", () => {
	test("a category change saves to a cookie and returns to the open transaction", async () => {
		let response = await post("transactions/t0190", {
			intent: "category",
			category: "travel",
			back: "transactions?category=groceries",
		});
		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toMatch(
			/^\/demo\/apps\/tuppence\/transactions\?category=groceries&tx=t0190&toast=category-saved\./,
		);
		let cookie = cookiesOf(response);
		expect(readWallet(cookie).edits.t0190?.category).toBe("travel");
		let off = await post("transactions/t0190", {
			intent: "category",
			category: "travel",
			back: "https://example.com",
		});
		expect(off.headers.get("Location")).toMatch(
			/^\/demo\/apps\/tuppence\/transactions\?tx=t0190&toast=/,
		);
	});

	test("a note and a split show on the transaction's sheet", async () => {
		let entry = statement().find((row) => row.merchant === "kanpai")!;
		let noted = await post(`transactions/${entry.id}`, {
			intent: "note",
			note: "Ramen with Tomás",
			back: "transactions",
		});
		let split = await post(
			`transactions/${entry.id}`,
			{ intent: "split", split: "2", back: "transactions" },
			cookiesOf(noted),
		);
		let html = await page(`/transactions?tx=${entry.id}`, cookiesOf(split));
		expect(html).toContain("Ramen with Tomás");
		expect(html).toContain("Split 2 ways");
		expect(html).toContain('data-slot="tuppence-split-summary"');
	});

	test("freezing a card shows it frozen and offers Undo", async () => {
		let response = await post("cards/everyday/freeze", { frozen: "true" });
		expect(response.headers.get("Location")).toMatch(
			/cards\?card=everyday&toast=frozen-everyday\./,
		);
		let html = await page("/cards?card=everyday", cookiesOf(response));
		expect(html).toContain("Card is frozen");
		expect(html).toContain("Unfreeze card");
		expect(html).toMatch(/aria-label="Everyday card ending 4821, frozen"/);
	});

	test("a budget saves, and an unreadable one comes back with the form open", async () => {
		let saved = await post("budgets/groceries", { amount: "450" });
		expect(readWallet(cookiesOf(saved)).budgets.groceries).toBe(45000);
		let refused = await post("budgets/groceries", { amount: "lots" });
		expect(refused.headers.get("Location")).toMatch(
			/budgets\?edit=groceries&toast=budget-invalid\./,
		);
	});

	test("a pot move takes from Everyday, and more than there is comes back with the amount typed", async () => {
		let main = findAccount("main")!;
		let moved = await post("pots/kyoto", { direction: "in", amount: "50" });
		let wallet = readWallet(cookiesOf(moved));
		expect(balanceOf(wallet, main)).toBe(main.balance - 5000);
		let refused = await post("pots/kyoto", { direction: "in", amount: "999999" });
		expect(refused.headers.get("Location")).toBe(
			"/demo/apps/tuppence/pots/kyoto?direction=in&amount=999999&error=balance",
		);
		let html = await page("/pots/kyoto?direction=in&amount=999999&error=balance");
		expect(html).toContain('value="999999"');
		expect(html).toMatch(/That(&#x27;|&#39;|')s more than/);
	});

	test("a transfer goes from review to sent, shows as pending and lowers the balance", async () => {
		let review = await page("/transfer/review?payee=tomas&amount=25.50&reference=Dinner");
		expect(review).toContain("Send €25.50");
		expect(review).toContain('name="amount" value="2550"');
		let sent = await post("transfer", { payee: "tomas", amount: "2550", reference: "Dinner" });
		let location = sent.headers.get("Location") ?? "";
		expect(location).toMatch(
			/^\/demo\/apps\/tuppence\/transfer\/sent\?payee=tomas&amount=2550&id=s/,
		);
		let cookie = cookiesOf(sent);
		let main = ACCOUNTS[0]!;
		expect(balanceOf(readWallet(cookie), main)).toBe(main.balance - 2550);
		let confirmation = await page(location.replace("/demo/apps/tuppence", ""), cookie);
		expect(confirmation).toContain("View in transactions");
		let statementHtml = await page("/transactions", cookie);
		expect(statementHtml).toContain("Transfers · Pending · Dinner");
	});

	test("an amount over the balance on review returns to the amount step with it typed", async () => {
		let html = await page("/transfer/review?payee=tomas&amount=99999&reference=Rent");
		expect(html).toContain("available.");
		expect(html).toContain('value="99999"');
		expect(html).toContain('value="Rent"');
		let forged = await post("transfer", { payee: "tomas", amount: "99999999", reference: "" });
		expect(forged.headers.get("Location")).toMatch(
			/transfer\/amount\?payee=tomas&amount=999999\.99/,
		);
	});

	test("the euro total on home adds every account at today's rates", async () => {
		let total = ACCOUNTS.reduce(
			(sum, account) => sum + toHome(account.balance, account.currency),
			0,
		);
		expect(total).toBe(601687);
		expect(await page("")).toContain("6,016");
	});

	test("reset expires every Tuppence cookie", async () => {
		let response = await post("reset", {}, "tuppence.frozen=everyday; tuppence.sent=%5B%5D");
		expect(response.headers.get("Location")).toMatch(/^\/demo\/apps\/tuppence\?toast=reset\./);
		let expired = response.headers.getSetCookie();
		expect(expired).toHaveLength(2);
		for (let cookie of expired) expect(cookie).toContain("Max-Age=0");
	});
});

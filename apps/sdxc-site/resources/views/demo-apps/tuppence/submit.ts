/**
 * Answers every Tuppence form: a transaction's category, note and split, a card's freeze, a
 * budget, money into or out of a pot, a sent transfer and the reset. Each change lands in the
 * visitor's cookies and redirects back to where they were, with the typed text kept on error.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { generateUUID } from "@sdxc/uuid/v7";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";

import type { DemoApp, DemoAppRedirect, DemoAppRequest } from "~/resources/views/demo-apps";

import { HOME, findAccount, findCard, findCategory, findPayee, findPot } from "./data";
import { parseAmount } from "./money";
import {
	NOTE_LIMIT,
	SPLIT_LIMIT,
	balanceOf,
	budgetCookie,
	editCookie,
	findEntry,
	frozenCookie,
	moveCookie,
	potBalance,
	readWallet,
	resetCookies,
	sentCookie,
} from "./state";

/** The list addresses a transaction edit may return to, so a post can never send the visitor elsewhere. */
const LIST_PAGES = /^(transactions|accounts\/(main|gbp|usd|jpy))(\?[\w=&%.+-]*)?$/;

/** A transaction edit: which field changes and its new value. */
const EDIT_FORM = f.object({
	intent: f.field(s.enum_(["category", "note", "split"])),
	category: f.field(s.defaulted(s.string(), "")),
	note: f.field(s.defaulted(s.string(), "")),
	split: f.field(s.defaulted(s.string(), "1")),
	back: f.field(s.defaulted(s.string(), "")),
});

/** A card freeze: whether it is frozen after the post. */
const FREEZE_FORM = f.object({ frozen: f.field(s.enum_(["true", "false"])) });

/** A budget: the amount typed. */
const BUDGET_FORM = f.object({ amount: f.field(s.defaulted(s.string(), "")) });

/** A pot move: which way and the amount typed. */
const MOVE_FORM = f.object({
	direction: f.field(s.enum_(["in", "out"])),
	amount: f.field(s.defaulted(s.string(), "")),
});

/** A transfer, confirmed on the review step: the amount in minor units as reviewed. */
const TRANSFER_FORM = f.object({
	payee: f.field(s.string()),
	amount: f.field(s.string()),
	reference: f.field(s.defaulted(s.string(), "")),
});

/** The time of day in Lisbon, for the new rows a post adds to today's statement. */
function lisbonTime(): string {
	return new Intl.DateTimeFormat("en-GB", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
		timeZone: "Europe/Lisbon",
	}).format(new Date());
}

/** A short id for a row the visitor adds, unique enough among a dozen. */
function rowId(prefix: string): string {
	return `${prefix}${generateUUID().replaceAll("-", "").slice(-10)}`;
}

/** Saves a category, note or split on one transaction. */
function submitEdit(id: string, form: FormData, request: DemoAppRequest): DemoAppRedirect | null {
	let wallet = readWallet(request.cookie);
	let entry = findEntry(wallet, id);
	let parsed = s.parseSafe(EDIT_FORM, form);
	if (entry === undefined || !parsed.success) return null;
	let { intent, category, note, split, back } = parsed.value;
	let list = new URL(LIST_PAGES.test(back) ? back : "transactions", "https://tuppence.invalid/");
	list.searchParams.set("tx", id);
	let detail = `${list.pathname.slice(1)}${list.search}`;
	if (intent === "category") {
		let found = findCategory(category);
		if (found === undefined) return null;
		return {
			page: detail,
			toast: "category-saved",
			cookies: [editCookie(wallet, id, { category: found.id })],
		};
	}
	if (intent === "note") {
		let text = note.trim().slice(0, NOTE_LIMIT);
		return {
			page: detail,
			toast: text === "" ? "note-removed" : "note-saved",
			cookies: [editCookie(wallet, id, { note: text })],
		};
	}
	let people = Math.floor(Number(split));
	if (!Number.isFinite(people) || people < 1 || people > SPLIT_LIMIT || entry.amount >= 0)
		return null;
	return {
		page: detail,
		toast: people === 1 ? "split-removed" : `split-${people}`,
		cookies: [editCookie(wallet, id, { split: people === 1 ? undefined : people })],
	};
}

/** Freezes or unfreezes a card; instant, with Undo in its toast. */
function submitFreeze(id: string, form: FormData, request: DemoAppRequest): DemoAppRedirect | null {
	let card = findCard(id);
	let parsed = s.parseSafe(FREEZE_FORM, form);
	if (card === undefined || !parsed.success) return null;
	let frozen = parsed.value.frozen === "true";
	return {
		page: `cards?card=${card.id}`,
		toast: `${frozen ? "frozen" : "unfrozen"}-${card.id}`,
		cookies: [frozenCookie(readWallet(request.cookie), card.id, frozen)],
	};
}

/** Sets a category's monthly budget. */
function submitBudget(id: string, form: FormData, request: DemoAppRequest): DemoAppRedirect | null {
	let category = findCategory(id);
	let parsed = s.parseSafe(BUDGET_FORM, form);
	if (category === undefined || !category.spending || !parsed.success) return null;
	let cents = parseAmount(parsed.value.amount, HOME);
	if (cents === null)
		return {
			page: `budgets?edit=${category.id}`,
			hash: `budget-${category.id}`,
			toast: "budget-invalid",
		};
	return {
		page: "budgets",
		hash: `budget-${category.id}`,
		toast: "budget-saved",
		cookies: [budgetCookie(readWallet(request.cookie), category.id, cents)],
	};
}

/**
 * Moves money between the main account and a pot. A refused move returns to the pot with the
 * amount typed and the reason, so nothing has to be typed twice.
 */
function submitMove(id: string, form: FormData, request: DemoAppRequest): DemoAppRedirect | null {
	let pot = findPot(id);
	let parsed = s.parseSafe(MOVE_FORM, form);
	if (pot === undefined || !parsed.success) return null;
	let wallet = readWallet(request.cookie);
	let { direction, amount } = parsed.value;
	let cents = parseAmount(amount, HOME);
	let main = findAccount("main")!;
	let available = direction === "in" ? balanceOf(wallet, main) : potBalance(wallet, pot.id);
	let retry = (error: string) =>
		`pots/${pot.id}?direction=${direction}&amount=${encodeURIComponent(amount)}&error=${error}`;
	if (cents === null) return { page: retry("amount") };
	if (cents > available) return { page: retry("balance") };
	let signed = direction === "in" ? cents : -cents;
	return {
		page: `pots/${pot.id}`,
		toast: `moved-${direction}-${pot.id}`,
		cookies: [
			moveCookie(wallet, { id: rowId("m"), pot: pot.id, amount: signed, time: lisbonTime() }),
		],
	};
}

/**
 * Records a reviewed transfer as pending on today's statement and shows the confirmation.
 * The amount is checked again here, since the review page is only an address.
 */
function submitTransfer(form: FormData, request: DemoAppRequest): DemoAppRedirect | null {
	let parsed = s.parseSafe(TRANSFER_FORM, form);
	if (!parsed.success) return null;
	let payee = findPayee(parsed.value.payee);
	let cents = Number(parsed.value.amount);
	if (payee === undefined || !Number.isSafeInteger(cents) || cents <= 0) return null;
	let wallet = readWallet(request.cookie);
	let from = findAccount(payee.currency === "GBP" ? "gbp" : "main")!;
	let reference = parsed.value.reference.trim().slice(0, 40);
	if (cents > balanceOf(wallet, from)) {
		return {
			page: `transfer/amount?payee=${payee.id}&amount=${encodeURIComponent((cents / 100).toFixed(2))}&reference=${encodeURIComponent(reference)}&error=balance`,
		};
	}
	let id = rowId("s");
	return {
		page: `transfer/sent?payee=${payee.id}&amount=${cents}&id=${id}`,
		cookies: [
			sentCookie(wallet, { id, payee: payee.id, amount: cents, reference, time: lisbonTime() }),
		],
	};
}

/** Answers a post on a page path. */
export const submit: DemoApp["submit"] = (page, form, request) => {
	if (page === "reset") return { page: "", toast: "reset", cookies: resetCookies(request.cookie) };
	if (page === "transfer") return submitTransfer(form, request);
	let [first, second, third, extra] = page.split("/");
	if (extra !== undefined || second === undefined) return null;
	if (first === "transactions" && third === undefined) return submitEdit(second, form, request);
	if (first === "cards" && third === "freeze") return submitFreeze(second, form, request);
	if (first === "budgets" && third === undefined) return submitBudget(second, form, request);
	if (first === "pots" && third === undefined) return submitMove(second, form, request);
	return null;
};

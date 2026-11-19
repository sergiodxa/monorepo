/**
 * What one visitor did on Tuppence, kept in their own cookies: categories, notes and splits
 * on transactions, frozen cards, budgets, money moved into pots and transfers sent. Every
 * screen reads it on the server, so changes survive a reload and work without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";

import { demoAppCookiePath } from "~/resources/views/demo-apps";

import type { Account, CategoryId, Transaction } from "./data";

import {
	ACCOUNTS,
	BUDGETS,
	CATEGORIES,
	CARDS,
	POTS,
	SLUG,
	TODAY,
	findCategory,
	findMerchant,
	findPayee,
	findPot,
	statement,
} from "./data";
import { allocate } from "./money";

/** Every Tuppence cookie starts with this, which is how a request is known to be personal. */
const COOKIE_PREFIX = "tuppence.";

/** A week: long enough to come back to, short enough that the demo resets itself. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/** The most edits, moves and transfers kept, so the cookies stay well under the browser's limit. */
const KEEP = 12;

/** The longest note a transaction keeps. */
export const NOTE_LIMIT = 140;

/** The most people a bill splits between, the visitor included. */
export const SPLIT_LIMIT = 8;

/** A visitor's changes to one transaction. */
export interface Edit {
	category?: CategoryId;
	note?: string;
	/** People sharing the bill, the visitor included; 1 or absent means unsplit. */
	split?: number;
}

/** Money the visitor moved into (positive) or out of (negative) a pot, in cents. */
export interface Move {
	id: string;
	pot: string;
	amount: number;
	time: string;
}

/** A transfer the visitor sent through the demo's flow. Nothing leaves; it shows as pending. */
export interface Sent {
	id: string;
	payee: string;
	amount: number;
	reference: string;
	time: string;
}

/** Everything a visitor changed, as every screen reads it. */
export interface Wallet {
	edits: Record<string, Edit>;
	frozen: string[];
	budgets: Partial<Record<CategoryId, number>>;
	moves: Move[];
	sent: Sent[];
}

/** One movement as a screen shows it: the statement's, with the visitor's edits applied. */
export interface Entry extends Transaction {
	note?: string;
	split?: number;
	/** The visitor's own part of a split bill; the whole amount when unsplit. */
	share: number;
}

/** The cookies' shapes; anything else in a cookie reads as no change. */
const EDITS = s.record(
	s.string(),
	s.object({
		category: s.optional(s.string()),
		note: s.optional(s.string()),
		split: s.optional(s.number()),
	}),
);
const MOVES = s.array(
	s.object({ id: s.string(), pot: s.string(), amount: s.number(), time: s.string() }),
);
const SENT = s.array(
	s.object({
		id: s.string(),
		payee: s.string(),
		amount: s.number(),
		reference: s.string(),
		time: s.string(),
	}),
);
const BUDGET_MAP = s.record(s.string(), s.number());

/** The names of Tuppence's cookies. */
const NAMES = {
	edits: `${COOKIE_PREFIX}edits`,
	frozen: `${COOKIE_PREFIX}frozen`,
	budgets: `${COOKIE_PREFIX}budgets`,
	moves: `${COOKIE_PREFIX}moves`,
	sent: `${COOKIE_PREFIX}sent`,
} as const;

/**
 * Splits a `Cookie` header into Tuppence's pairs. Where a name repeats, the first wins: the
 * browser sends the cookie with the longest path first, so the app's own outranks an older one.
 */
function tuppenceCookies(header: string | null): Map<string, string> {
	let pairs = new Map<string, string>();
	for (let pair of (header ?? "").split(";")) {
		let [name = "", ...value] = pair.trim().split("=");
		if (name.startsWith(COOKIE_PREFIX) && !pairs.has(name)) pairs.set(name, value.join("="));
	}
	return pairs;
}

/** A cookie's JSON value parsed against its shape, or `fallback` when it does not fit. */
function readJson<T>(raw: string | undefined, schema: s.Schema<unknown, T>, fallback: T): T {
	if (raw === undefined || raw === "") return fallback;
	try {
		let parsed = s.parseSafe(schema, JSON.parse(decodeURIComponent(raw)));
		return parsed.success ? parsed.value : fallback;
	} catch {
		return fallback;
	}
}

/**
 * Whether a request carries a change the visitor made, so its pages render fresh rather than
 * from a copy cached for everyone.
 *
 * @param header The request's `Cookie` header.
 */
export function isPersonal(header: string | null): boolean {
	return tuppenceCookies(header).size > 0;
}

/** A visitor's edits with unknown categories and out-of-range splits dropped. */
function cleanEdits(edits: Record<string, { category?: string; note?: string; split?: number }>) {
	let clean: Record<string, Edit> = {};
	for (let [id, edit] of Object.entries(edits)) {
		let category = findCategory(edit.category ?? "")?.id;
		let split =
			edit.split !== undefined && edit.split >= 2 && edit.split <= SPLIT_LIMIT
				? Math.floor(edit.split)
				: undefined;
		let note = edit.note?.slice(0, NOTE_LIMIT);
		clean[id] = { category, note, split };
	}
	return clean;
}

/**
 * Reads everything the visitor changed. Unknown ids, categories, pots and payees are dropped,
 * so a tampered cookie can only lose changes.
 *
 * @param header The request's `Cookie` header.
 */
export function readWallet(header: string | null): Wallet {
	let cookies = tuppenceCookies(header);
	let frozen = decodeURIComponent(cookies.get(NAMES.frozen) ?? "")
		.split(",")
		.filter((id) => CARDS.some((card) => card.id === id));
	let budgets: Partial<Record<CategoryId, number>> = {};
	for (let [id, cents] of Object.entries(readJson(cookies.get(NAMES.budgets), BUDGET_MAP, {}))) {
		let category = findCategory(id);
		if (category?.spending && Number.isSafeInteger(cents) && cents > 0)
			budgets[category.id] = cents;
	}
	return {
		edits: cleanEdits(readJson(cookies.get(NAMES.edits), EDITS, {})),
		frozen,
		budgets,
		moves: readJson(cookies.get(NAMES.moves), MOVES, []).filter(
			(move) => findPot(move.pot) !== undefined && Number.isSafeInteger(move.amount),
		),
		sent: readJson(cookies.get(NAMES.sent), SENT, []).filter(
			(sent) => findPayee(sent.payee) !== undefined && Number.isSafeInteger(sent.amount),
		),
	};
}

/** One `Set-Cookie` value under the app's own path. */
function cookieHeader(name: string, value: string): string {
	return `${name}=${value}; Path=${demoAppCookiePath(SLUG)}; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax; HttpOnly`;
}

/** A JSON value as a cookie. */
function jsonCookie(name: string, value: unknown): string {
	return cookieHeader(name, encodeURIComponent(JSON.stringify(value)));
}

/**
 * The cookie holding a transaction's edits with one change applied. The most recent edits
 * are kept when there are more than the cookie holds.
 *
 * @param wallet The visitor as the request found them.
 * @param id The transaction's id.
 * @param edit The fields that change; `undefined` clears one.
 */
export function editCookie(wallet: Wallet, id: string, edit: Edit): string {
	let { [id]: current = {}, ...rest } = wallet.edits;
	let next = { ...current, ...edit };
	let kept = Object.entries(rest).slice(-(KEEP - 1));
	return jsonCookie(NAMES.edits, Object.fromEntries([...kept, [id, next]]));
}

/**
 * The cookie with a card frozen or unfrozen.
 *
 * @param wallet The visitor as the request found them.
 * @param card The card's id.
 * @param frozen Whether it is frozen now.
 */
export function frozenCookie(wallet: Wallet, card: string, frozen: boolean): string {
	let rest = wallet.frozen.filter((id) => id !== card);
	return cookieHeader(
		NAMES.frozen,
		encodeURIComponent([...rest, ...(frozen ? [card] : [])].join(",")),
	);
}

/**
 * The cookie with one category's monthly budget set.
 *
 * @param wallet The visitor as the request found them.
 * @param category The spending category.
 * @param cents The new budget.
 */
export function budgetCookie(wallet: Wallet, category: CategoryId, cents: number): string {
	return jsonCookie(NAMES.budgets, { ...wallet.budgets, [category]: cents });
}

/**
 * The cookie with one more pot move, the oldest dropped past the limit.
 *
 * @param wallet The visitor as the request found them.
 * @param move The move made.
 */
export function moveCookie(wallet: Wallet, move: Move): string {
	return jsonCookie(NAMES.moves, [...wallet.moves, move].slice(-KEEP));
}

/**
 * The cookie with one more sent transfer, the oldest dropped past the limit.
 *
 * @param wallet The visitor as the request found them.
 * @param sent The transfer made.
 */
export function sentCookie(wallet: Wallet, sent: Sent): string {
	return jsonCookie(NAMES.sent, [...wallet.sent, sent].slice(-KEEP));
}

/**
 * The cookies that put the demo back as it started: every Tuppence cookie the request
 * carries, expired.
 *
 * @param header The request's `Cookie` header.
 */
export function resetCookies(header: string | null): string[] {
	return [...tuppenceCookies(header).keys()].map(
		(name) => `${name}=; Path=${demoAppCookiePath(SLUG)}; Max-Age=0; SameSite=Lax; HttpOnly`,
	);
}

/** The movements a visitor's own transfers and pot moves add, newest first, all today. */
function visitorEntries(wallet: Wallet): Transaction[] {
	let sent: Transaction[] = wallet.sent.map((entry) => {
		let payee = findPayee(entry.payee)!;
		return {
			id: entry.id,
			date: TODAY,
			time: entry.time,
			merchant: payee.merchant,
			amount: -entry.amount,
			account: payee.currency === "GBP" ? "gbp" : "main",
			category: "transfers",
			method: "transfer",
			pending: true,
			reference: entry.reference,
		};
	});
	let moves: Transaction[] = wallet.moves.map((move) => ({
		id: move.id,
		date: TODAY,
		time: move.time,
		merchant: `pot-${move.pot}`,
		amount: -move.amount,
		account: "main",
		category: "savings",
		method: "pot",
		pending: false,
		reference: findPot(move.pot)?.name,
	}));
	return [...sent, ...moves].sort((a, b) => b.time.localeCompare(a.time));
}

/**
 * Every movement with the visitor's edits applied, newest first: their own transfers and pot
 * moves from today lead, then the statement.
 *
 * @param wallet The visitor's changes.
 */
export function entries(wallet: Wallet): Entry[] {
	return [...visitorEntries(wallet), ...statement()].map((entry) => {
		let edit = wallet.edits[entry.id] ?? {};
		let split = edit.split;
		let shares = split === undefined ? [entry.amount] : allocate(entry.amount, split);
		return {
			...entry,
			category: edit.category ?? entry.category,
			note: edit.note === "" ? undefined : edit.note,
			split,
			share: shares[shares.length - 1] ?? entry.amount,
		};
	});
}

/**
 * The movement an id names, with the visitor's edits.
 *
 * @param wallet The visitor's changes.
 * @param id A transaction id from an address or a form.
 */
export function findEntry(wallet: Wallet, id: string): Entry | undefined {
	return entries(wallet).find((entry) => entry.id === id);
}

/**
 * An account's balance now: the starting balance less what the visitor sent or moved out.
 *
 * @param wallet The visitor's changes.
 * @param account The account.
 */
export function balanceOf(wallet: Wallet, account: Account): number {
	return visitorEntries(wallet)
		.filter((entry) => entry.account === account.id)
		.reduce((total, entry) => total + entry.amount, account.balance);
}

/**
 * Every account with its balance now.
 *
 * @param wallet The visitor's changes.
 */
export function balances(wallet: Wallet): Array<Account & { now: number }> {
	return ACCOUNTS.map((account) => ({ ...account, now: balanceOf(wallet, account) }));
}

/**
 * A pot's balance now, with the visitor's moves in and out.
 *
 * @param wallet The visitor's changes.
 * @param pot The pot's id.
 */
export function potBalance(wallet: Wallet, pot: string): number {
	let base = POTS.find((entry) => entry.id === pot)?.balance ?? 0;
	return wallet.moves
		.filter((move) => move.pot === pot)
		.reduce((total, move) => total + move.amount, base);
}

/**
 * The monthly budget for a category, the visitor's own when they set one.
 *
 * @param wallet The visitor's changes.
 * @param category The spending category.
 */
export function budgetFor(wallet: Wallet, category: CategoryId): number | undefined {
	return wallet.budgets[category] ?? BUDGETS[category];
}

/** The categories a budget can be set for: every spending one. */
export const BUDGETABLE = CATEGORIES.filter((category) => category.spending);

/**
 * The merchant's display name for a movement, falling back to its id.
 *
 * @param entry The movement.
 */
export function merchantName(entry: Transaction): string {
	return findMerchant(entry.merchant)?.name ?? entry.merchant;
}

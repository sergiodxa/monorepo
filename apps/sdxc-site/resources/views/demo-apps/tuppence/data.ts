/**
 * Tuppence's invented world: Noor Halvorsen, a freelance illustrator in Lisbon, with euro,
 * pound, dollar and yen accounts, savings pots, two cards, and eleven weeks of statements
 * drawn from a seeded generator, so every visit and every test sees the same money.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Chart } from "@sdxc/ui/app/chart";

import { convert } from "@sdxc/money";

import { demoAppActionHref, demoAppHref } from "~/resources/views/demo-apps";

/** The folder name, which is the app's slug. */
export const SLUG = "tuppence";

/** The address of a Tuppence screen. */
export const href = demoAppHref(SLUG);

/** The address a Tuppence form posts to. */
export const actionHref = demoAppActionHref(SLUG);

/** The day the demo stands on; the statement ends here and "upcoming" starts after it. */
export const TODAY = "2026-11-18";

/** The first day the generated statement covers. */
const FIRST_DAY = "2026-09-01";

/** The interface's locale: English words with the day-month order and euro grouping of Ireland. */
export const LOCALE = "en-IE";

/** The currency totals are counted in. */
export const HOME = "EUR";

/** The account holder, an invented person. */
export const HOLDER = {
	name: "Noor Halvorsen",
	first: "Noor",
	initials: "NH",
	email: "noor@example.com",
} as const;

/** One currency account. */
export interface Account {
	id: "main" | "gbp" | "usd" | "jpy";
	name: string;
	currency: "EUR" | "GBP" | "USD" | "JPY";
	/** The balance as the statement starts the demo, in minor units. */
	balance: number;
	/** A quiet line naming the account's use. */
	detail: string;
	/** The fake, masked account reference. */
	masked: string;
	/** A flag-free mark: the currency's symbol on a tinted tile. */
	symbol: string;
}

/** Noor's accounts, the euro one first. */
export const ACCOUNTS: readonly Account[] = [
	{
		id: "main",
		name: "Everyday",
		currency: "EUR",
		balance: 348216,
		detail: "Main account",
		masked: "•• 2290",
		symbol: "€",
	},
	{
		id: "gbp",
		name: "Pounds",
		currency: "GBP",
		balance: 124050,
		detail: "London clients",
		masked: "•• 5143",
		symbol: "£",
	},
	{
		id: "usd",
		name: "Dollars",
		currency: "USD",
		balance: 61208,
		detail: "US royalties",
		masked: "•• 7731",
		symbol: "$",
	},
	{
		id: "jpy",
		name: "Yen",
		currency: "JPY",
		balance: 84500,
		detail: "For Kyoto in spring",
		masked: "•• 0418",
		symbol: "¥",
	},
];

/** Invented rates: how many euros one unit of each currency buys today. */
export const RATES: Record<Account["currency"], number> = {
	EUR: 1,
	GBP: 1.1712,
	USD: 0.9248,
	JPY: 0.006104,
};

/**
 * An amount in euros, at today's invented rate.
 *
 * @param value Minor units of `currency`.
 * @param currency The ISO code it is in.
 */
export function toHome(value: number, currency: string): number {
	let rate = RATES[currency as Account["currency"]] ?? 1;
	return currency === HOME ? value : convert(value, currency, HOME, rate);
}

/**
 * The account an id names.
 *
 * @param id An account id from an address or a form.
 */
export function findAccount(id: string): Account | undefined {
	return ACCOUNTS.find((account) => account.id === id);
}

/** The spending categories a chart colors, and the money that moves without being spent. */
export type CategoryId =
	| "groceries"
	| "eating-out"
	| "transport"
	| "bills"
	| "shopping"
	| "entertainment"
	| "health"
	| "travel"
	| "income"
	| "savings"
	| "transfers";

/** One category: its name, its chart color and its icon's key. */
export interface Category {
	id: CategoryId;
	name: string;
	/** The chart slot, pinned so a category keeps its color on every screen; `null` off the charts. */
	color: Chart.Color | null;
	/** Whether money in it counts as spending. */
	spending: boolean;
}

/** Every category, the eight spending ones first in the order the charts draw them. */
export const CATEGORIES: readonly Category[] = [
	{ id: "groceries", name: "Groceries", color: 1, spending: true },
	{ id: "eating-out", name: "Eating out", color: 2, spending: true },
	{ id: "bills", name: "Bills", color: 3, spending: true },
	{ id: "transport", name: "Transport", color: 4, spending: true },
	{ id: "shopping", name: "Shopping", color: 5, spending: true },
	{ id: "entertainment", name: "Entertainment", color: 6, spending: true },
	{ id: "health", name: "Health", color: 7, spending: true },
	{ id: "travel", name: "Travel", color: 8, spending: true },
	{ id: "income", name: "Income", color: null, spending: false },
	{ id: "savings", name: "Savings", color: null, spending: false },
	{ id: "transfers", name: "Transfers", color: null, spending: false },
];

/**
 * The category an id names.
 *
 * @param id A category id from an address, a form or a cookie.
 */
export function findCategory(id: string): Category | undefined {
	return CATEGORIES.find((category) => category.id === id);
}

/** Someone money goes to or comes from: a shop, a company or a person. */
export interface Merchant {
	id: string;
	name: string;
	category: CategoryId;
	/** One or two letters drawn on the mark. */
	letters: string;
	/** The mark's hue, in oklch degrees. */
	hue: number;
	/** Where it is, or what it is, for the detail view. */
	place: string;
}

/** Every merchant and person on the statement; all invented. */
export const MERCHANTS: readonly Merchant[] = [
	{
		id: "pomar",
		name: "Pomar Market",
		category: "groceries",
		letters: "P",
		hue: 140,
		place: "Rua da Graça, Lisbon",
	},
	{
		id: "santos",
		name: "Mercearia Santos",
		category: "groceries",
		letters: "MS",
		hue: 95,
		place: "Largo do Intendente, Lisbon",
	},
	{
		id: "lumen",
		name: "Café Lumen",
		category: "eating-out",
		letters: "CL",
		hue: 55,
		place: "Rua dos Anjos, Lisbon",
	},
	{
		id: "tasca",
		name: "Tasca do Ribeiro",
		category: "eating-out",
		letters: "TR",
		hue: 25,
		place: "Alfama, Lisbon",
	},
	{
		id: "bocado",
		name: "Bocado",
		category: "eating-out",
		letters: "B",
		hue: 35,
		place: "Food delivery",
	},
	{
		id: "kanpai",
		name: "Kanpai Alfama",
		category: "eating-out",
		letters: "K",
		hue: 5,
		place: "Noodle bar, Lisbon",
	},
	{
		id: "linha",
		name: "Linha Azul Transit",
		category: "transport",
		letters: "LA",
		hue: 245,
		place: "Monthly pass",
	},
	{
		id: "velo",
		name: "Velo Rides",
		category: "transport",
		letters: "V",
		hue: 200,
		place: "E-bike hire",
	},
	{
		id: "comboio",
		name: "Comboio Norte",
		category: "travel",
		letters: "CN",
		hue: 265,
		place: "Rail tickets",
	},
	{
		id: "wayfern",
		name: "Wayfern",
		category: "travel",
		letters: "W",
		hue: 170,
		place: "Stay in Porto",
	},
	{
		id: "landlord",
		name: "Inês Prado",
		category: "bills",
		letters: "IP",
		hue: 310,
		place: "Rent, Rua das Flores flat",
	},
	{
		id: "fibrela",
		name: "Fibrela",
		category: "bills",
		letters: "F",
		hue: 220,
		place: "Home internet",
	},
	{
		id: "casaluz",
		name: "Casa Luz Energia",
		category: "bills",
		letters: "CL",
		hue: 75,
		place: "Electricity",
	},
	{
		id: "fernway",
		name: "Fernway Mobile",
		category: "bills",
		letters: "FM",
		hue: 160,
		place: "Phone plan",
	},
	{
		id: "driftbox",
		name: "Driftbox",
		category: "bills",
		letters: "D",
		hue: 230,
		place: "Cloud storage",
	},
	{
		id: "vesper",
		name: "Vesper",
		category: "entertainment",
		letters: "V",
		hue: 300,
		place: "Streaming",
	},
	{
		id: "murmur",
		name: "Murmur",
		category: "entertainment",
		letters: "M",
		hue: 285,
		place: "Music",
	},
	{
		id: "cinetejo",
		name: "Cine Tejo",
		category: "entertainment",
		letters: "CT",
		hue: 345,
		place: "Cinema",
	},
	{
		id: "forma",
		name: "Forma Studio",
		category: "health",
		letters: "FS",
		hue: 185,
		place: "Gym membership",
	},
	{
		id: "farmacia",
		name: "Farmácia Sol",
		category: "health",
		letters: "FS",
		hue: 130,
		place: "Pharmacy",
	},
	{
		id: "livraria",
		name: "Livraria Ponte",
		category: "shopping",
		letters: "LP",
		hue: 45,
		place: "Bookshop",
	},
	{
		id: "oficina",
		name: "Oficina Papel",
		category: "shopping",
		letters: "OP",
		hue: 15,
		place: "Art supplies",
	},
	{
		id: "brushwork",
		name: "Brushwork Pro",
		category: "shopping",
		letters: "BP",
		hue: 260,
		place: "Drawing app, billed in dollars",
	},
	{
		id: "atelier",
		name: "Atelier Norte",
		category: "income",
		letters: "AN",
		hue: 150,
		place: "Monthly retainer",
	},
	{
		id: "harrow",
		name: "Harrow & Finch Studio",
		category: "income",
		letters: "HF",
		hue: 115,
		place: "Invoices from London",
	},
	{
		id: "penrose",
		name: "Penrose Press",
		category: "income",
		letters: "PP",
		hue: 90,
		place: "Book royalties",
	},
	{
		id: "pot-rainy-day",
		name: "Rainy day",
		category: "savings",
		letters: "RD",
		hue: 50,
		place: "Savings pot",
	},
	{
		id: "pot-kyoto",
		name: "Kyoto in spring",
		category: "savings",
		letters: "KS",
		hue: 350,
		place: "Savings pot",
	},
	{
		id: "pot-tablet",
		name: "New drawing tablet",
		category: "savings",
		letters: "DT",
		hue: 220,
		place: "Savings pot",
	},
	{
		id: "pot-tax",
		name: "Tax set-aside",
		category: "savings",
		letters: "TX",
		hue: 150,
		place: "Savings pot",
	},
	{
		id: "exchange",
		name: "Exchanged to yen",
		category: "transfers",
		letters: "¥",
		hue: 60,
		place: "Between your accounts",
	},
	{
		id: "tomas",
		name: "Tomás Ferreira",
		category: "transfers",
		letters: "TF",
		hue: 205,
		place: "Friend",
	},
	{
		id: "mira",
		name: "Mira Halvorsen",
		category: "transfers",
		letters: "MH",
		hue: 330,
		place: "Sister",
	},
];

/**
 * The merchant an id names.
 *
 * @param id A merchant id from the statement.
 */
export function findMerchant(id: string): Merchant | undefined {
	return MERCHANTS.find((merchant) => merchant.id === id);
}

/** How a movement was made, for the detail view's quiet line. */
export type Method = "card" | "direct-debit" | "transfer" | "pot" | "exchange";

/** One movement on an account, as the statement holds it before a visitor's edits. */
export interface Transaction {
	id: string;
	/** `YYYY-MM-DD`. */
	date: string;
	/** `HH:MM`, local time. */
	time: string;
	merchant: string;
	/** Minor units of the account's currency; negative leaves the account. */
	amount: number;
	account: Account["id"];
	category: CategoryId;
	method: Method;
	/** Still settling with the merchant. */
	pending: boolean;
	/** A reference the payer wrote, on transfers. */
	reference?: string;
}

/** A bill, subscription or income that repeats on a day of every month. */
export interface Recurring {
	id: string;
	merchant: string;
	/** Minor units of the account's currency; the usual amount when it varies. */
	amount: number;
	account: Account["id"];
	day: number;
	kind: "bill" | "subscription" | "income" | "saving";
	/** The amount changes from month to month. */
	varies?: boolean;
}

/** Everything that repeats, in the order of its day of the month. */
export const RECURRING: readonly Recurring[] = [
	{ id: "rent", merchant: "landlord", amount: -95000, account: "main", day: 1, kind: "bill" },
	{ id: "transit", merchant: "linha", amount: -4000, account: "main", day: 1, kind: "bill" },
	{ id: "murmur", merchant: "murmur", amount: -999, account: "main", day: 3, kind: "subscription" },
	{ id: "gym", merchant: "forma", amount: -3500, account: "main", day: 5, kind: "subscription" },
	{ id: "internet", merchant: "fibrela", amount: -3200, account: "main", day: 8, kind: "bill" },
	{ id: "harrow", merchant: "harrow", amount: 145000, account: "gbp", day: 10, kind: "income" },
	{
		id: "power",
		merchant: "casaluz",
		amount: -5840,
		account: "main",
		day: 12,
		kind: "bill",
		varies: true,
	},
	{
		id: "vesper",
		merchant: "vesper",
		amount: -1199,
		account: "main",
		day: 14,
		kind: "subscription",
	},
	{ id: "royalties", merchant: "penrose", amount: 62000, account: "usd", day: 15, kind: "income" },
	{ id: "phone", merchant: "fernway", amount: -1800, account: "main", day: 20, kind: "bill" },
	{
		id: "storage",
		merchant: "driftbox",
		amount: -299,
		account: "main",
		day: 22,
		kind: "subscription",
	},
	{ id: "retainer", merchant: "atelier", amount: 210000, account: "main", day: 25, kind: "income" },
	{
		id: "rainy",
		merchant: "pot-rainy-day",
		amount: -20000,
		account: "main",
		day: 26,
		kind: "saving",
	},
	{ id: "kyoto", merchant: "pot-kyoto", amount: -15000, account: "main", day: 26, kind: "saving" },
];

/** A savings pot: money set aside toward a goal, in euros. */
export interface Pot {
	id: string;
	name: string;
	/** What it is for, in a sentence. */
	purpose: string;
	balance: number;
	/** The goal in cents; a pot without one just collects. */
	target?: number;
	/** `YYYY-MM-DD` the goal is for. */
	by?: string;
	/** The pot's hue on its card. */
	hue: number;
	/** The standing transfer that fills it, by {@link Recurring.id}. */
	recurring?: string;
}

/** Noor's pots. */
export const POTS: readonly Pot[] = [
	{
		id: "rainy-day",
		name: "Rainy day",
		purpose: "Three months of rent and bills, in case work goes quiet.",
		balance: 420000,
		target: 600000,
		hue: 50,
		recurring: "rainy",
	},
	{
		id: "kyoto",
		name: "Kyoto in spring",
		purpose: "Flights and two weeks of ryokan nights for March.",
		balance: 185000,
		target: 320000,
		by: "2027-03-01",
		hue: 350,
		recurring: "kyoto",
	},
	{
		id: "tablet",
		name: "New drawing tablet",
		purpose: "The 16-inch pen display, before the next big commission.",
		balance: 64000,
		target: 110000,
		by: "2026-12-20",
		hue: 220,
	},
	{
		id: "tax",
		name: "Tax set-aside",
		purpose: "A quarter of every invoice, for the self-employed tax bill.",
		balance: 296000,
		hue: 150,
	},
];

/**
 * The pot an id names.
 *
 * @param id A pot id from an address or a form.
 */
export function findPot(id: string): Pot | undefined {
	return POTS.find((pot) => pot.id === id);
}

/** Someone Noor can send money to. Every reference is invented and masked. */
export interface Payee {
	id: string;
	merchant: string;
	/** The masked account reference shown on review. */
	masked: string;
	/** The bank the payee banks with, as the review names it. */
	bank: string;
	/** The currency the payee is paid in. */
	currency: Account["currency"];
}

/** Saved payees, most recently paid first. */
export const PAYEES: readonly Payee[] = [
	{ id: "tomas", merchant: "tomas", masked: "PT •• 7702", bank: "Banco Exemplo", currency: "EUR" },
	{ id: "mira", merchant: "mira", masked: "NO •• 1185", bank: "Fjord Demo Bank", currency: "EUR" },
	{
		id: "landlord",
		merchant: "landlord",
		masked: "PT •• 3310",
		bank: "Caixa Fictícia",
		currency: "EUR",
	},
	{
		id: "harrow",
		merchant: "harrow",
		masked: "GB •• 5521",
		bank: "Thames Sample Bank",
		currency: "GBP",
	},
];

/**
 * The payee an id names.
 *
 * @param id A payee id from an address or a form.
 */
export function findPayee(id: string): Payee | undefined {
	return PAYEES.find((payee) => payee.id === id);
}

/** One of Noor's cards, all with fake masked numbers. */
export interface Card {
	id: string;
	name: string;
	kind: "physical" | "virtual";
	last4: string;
	expires: string;
	/** Spent on it so far this month, in cents. */
	spent: number;
	/** The monthly limit, in cents. */
	limit: number;
	tone: "brand" | "ink";
	/** What the card is kept for. */
	use: string;
}

/** Noor's cards. */
export const CARDS: readonly Card[] = [
	{
		id: "everyday",
		name: "Everyday card",
		kind: "physical",
		last4: "4821",
		expires: "09/29",
		spent: 84210,
		limit: 250000,
		tone: "brand",
		use: "Shops, cafés and travel",
	},
	{
		id: "online",
		name: "Online card",
		kind: "virtual",
		last4: "0937",
		expires: "03/27",
		spent: 4597,
		limit: 30000,
		tone: "ink",
		use: "Subscriptions and online shops",
	},
];

/**
 * The card an id names.
 *
 * @param id A card id from an address or a form.
 */
export function findCard(id: string): Card | undefined {
	return CARDS.find((card) => card.id === id);
}

/** Monthly budgets per spending category, in cents. */
export const BUDGETS: Partial<Record<CategoryId, number>> = {
	groceries: 32000,
	"eating-out": 20000,
	transport: 11000,
	shopping: 15000,
	entertainment: 4000,
	health: 11000,
};

/** A small seeded random source, so the generated statement is the same on every render. */
function seeded(seed: number): () => number {
	let state = seed;
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Every day from `first` to `last`, inclusive, as `YYYY-MM-DD`.
 *
 * @param first The first day.
 * @param last The last day.
 */
export function daysBetween(first: string, last: string): string[] {
	let days: string[] = [];
	let at = new Date(`${first}T12:00:00Z`);
	let end = new Date(`${last}T12:00:00Z`);
	while (at <= end) {
		days.push(at.toISOString().slice(0, 10));
		at.setUTCDate(at.getUTCDate() + 1);
	}
	return days;
}

/**
 * A day shifted by a number of days.
 *
 * @param day `YYYY-MM-DD`.
 * @param by Days to add; negative goes back.
 */
export function addDays(day: string, by: number): string {
	let at = new Date(`${day}T12:00:00Z`);
	at.setUTCDate(at.getUTCDate() + by);
	return at.toISOString().slice(0, 10);
}

/** The weekday of a day, 0 for Sunday. */
function weekday(day: string): number {
	return new Date(`${day}T12:00:00Z`).getUTCDay();
}

/** One merchant's chance of a visit per day and the amount it charges, in cents. */
interface Habit {
	merchant: string;
	chance: number;
	min: number;
	max: number;
	/** Only on weekdays (Monday to Friday). */
	weekdays?: boolean;
	/** The hours a visit falls between. */
	hours: [number, number];
	account?: Account["id"];
}

/** The everyday spending the generator draws from. */
const HABITS: readonly Habit[] = [
	{ merchant: "lumen", chance: 0.68, min: 240, max: 520, weekdays: true, hours: [8, 10] },
	{ merchant: "pomar", chance: 0.3, min: 1820, max: 6390, hours: [17, 20] },
	{ merchant: "santos", chance: 0.22, min: 380, max: 1540, hours: [11, 19] },
	{ merchant: "tasca", chance: 0.12, min: 1600, max: 4800, hours: [20, 22] },
	{ merchant: "bocado", chance: 0.16, min: 1390, max: 3260, hours: [19, 22] },
	{ merchant: "kanpai", chance: 0.07, min: 1450, max: 2980, hours: [13, 14] },
	{ merchant: "velo", chance: 0.34, min: 260, max: 940, hours: [9, 19] },
	{ merchant: "livraria", chance: 0.06, min: 990, max: 3450, hours: [12, 18] },
	{ merchant: "oficina", chance: 0.07, min: 840, max: 6480, hours: [11, 18] },
	{ merchant: "cinetejo", chance: 0.05, min: 850, max: 1700, hours: [18, 21] },
	{ merchant: "farmacia", chance: 0.05, min: 560, max: 2380, hours: [10, 19] },
];

/** One-off movements the generator cannot invent: a weekend away, currency bought, a dollar app. */
const ONE_OFFS: readonly Omit<Transaction, "id" | "pending">[] = [
	{
		date: "2026-09-19",
		time: "10:12",
		merchant: "comboio",
		amount: -3480,
		account: "main",
		category: "travel",
		method: "card",
	},
	{
		date: "2026-10-09",
		time: "21:40",
		merchant: "wayfern",
		amount: -18600,
		account: "main",
		category: "travel",
		method: "card",
	},
	{
		date: "2026-10-10",
		time: "08:05",
		merchant: "comboio",
		amount: -3480,
		account: "main",
		category: "travel",
		method: "card",
	},
	{
		date: "2026-09-02",
		time: "09:30",
		merchant: "brushwork",
		amount: -2499,
		account: "usd",
		category: "shopping",
		method: "card",
	},
	{
		date: "2026-10-02",
		time: "09:30",
		merchant: "brushwork",
		amount: -2499,
		account: "usd",
		category: "shopping",
		method: "card",
	},
	{
		date: "2026-11-02",
		time: "09:30",
		merchant: "brushwork",
		amount: -2499,
		account: "usd",
		category: "shopping",
		method: "card",
	},
	{
		date: "2026-10-21",
		time: "14:02",
		merchant: "exchange",
		amount: -30000,
		account: "main",
		category: "transfers",
		method: "exchange",
	},
	{
		date: "2026-10-21",
		time: "14:02",
		merchant: "exchange",
		amount: 49100,
		account: "jpy",
		category: "transfers",
		method: "exchange",
	},
	{
		date: "2026-11-11",
		time: "18:20",
		merchant: "exchange",
		amount: -21600,
		account: "main",
		category: "transfers",
		method: "exchange",
	},
	{
		date: "2026-11-11",
		time: "18:20",
		merchant: "exchange",
		amount: 35400,
		account: "jpy",
		category: "transfers",
		method: "exchange",
	},
	{
		date: "2026-10-03",
		time: "22:41",
		merchant: "tomas",
		amount: -2250,
		account: "main",
		category: "transfers",
		method: "transfer",
		reference: "Concert tickets",
	},
	{
		date: "2026-11-15",
		time: "12:09",
		merchant: "mira",
		amount: 4000,
		account: "main",
		category: "transfers",
		method: "transfer",
		reference: "Mum's birthday flowers",
	},
	{
		date: "2026-11-17",
		time: "16:33",
		merchant: "oficina",
		amount: -8640,
		account: "main",
		category: "shopping",
		method: "card",
	},
];

/** The method a repeating movement uses. */
function recurringMethod(kind: Recurring["kind"]): Method {
	if (kind === "income") return "transfer";
	if (kind === "saving") return "pot";
	return "direct-debit";
}

/** The month's electricity bill, which follows the season. */
function powerBill(month: string): number {
	if (month === "2026-09") return -4960;
	if (month === "2026-10") return -5410;
	return -6120;
}

/** The repeating movements that fell due between the first day and today. */
function recurringTransactions(): Omit<Transaction, "id" | "pending">[] {
	return daysBetween(FIRST_DAY, TODAY).flatMap((day) =>
		RECURRING.filter((entry) => Number(day.slice(8)) === entry.day).map((entry) => ({
			date: day,
			time: entry.kind === "income" ? "06:00" : "05:30",
			merchant: entry.merchant,
			amount: entry.id === "power" ? powerBill(day.slice(0, 7)) : entry.amount,
			account: entry.account,
			category: findMerchant(entry.merchant)?.category ?? "bills",
			method: recurringMethod(entry.kind),
		})),
	);
}

/** The habits drawn day by day from the seeded source. */
function habitTransactions(): Omit<Transaction, "id" | "pending">[] {
	let random = seeded(4821);
	return daysBetween(FIRST_DAY, TODAY).flatMap((day) => {
		let workday = weekday(day) !== 0 && weekday(day) !== 6;
		return HABITS.flatMap((habit) => {
			let roll = random();
			let amount = habit.min + Math.round(random() * (habit.max - habit.min));
			let hour = habit.hours[0] + Math.floor(random() * (habit.hours[1] - habit.hours[0] + 1));
			let minute = Math.floor(random() * 60);
			if ((habit.weekdays && !workday) || roll > habit.chance) return [];
			return [
				{
					date: day,
					time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
					merchant: habit.merchant,
					amount: -amount,
					account: habit.account ?? "main",
					category: findMerchant(habit.merchant)?.category ?? "shopping",
					method: "card" as const,
				},
			];
		});
	});
}

/** The statement, built once per isolate on first use rather than at module load. */
const STATEMENT: { value?: readonly Transaction[] } = {};

/**
 * Every generated movement, newest first. The two most recent card payments are still
 * pending, the way a statement shows the last day's spending.
 */
export function statement(): readonly Transaction[] {
	if (STATEMENT.value !== undefined) return STATEMENT.value;
	let sorted = [...recurringTransactions(), ...habitTransactions(), ...ONE_OFFS].sort(
		(a, b) =>
			`${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`) ||
			a.merchant.localeCompare(b.merchant),
	);
	let total = sorted.length;
	let pendingLeft = 2;
	STATEMENT.value = sorted.map((entry, index) => {
		let pending = entry.date === TODAY && entry.method === "card" && pendingLeft > 0;
		if (pending) pendingLeft -= 1;
		return { ...entry, id: `t${String(total - index).padStart(4, "0")}`, pending };
	});
	return STATEMENT.value;
}

/** Month names for a `YYYY-MM` key. */
export function monthName(month: string, style: "long" | "short" = "long"): string {
	return new Intl.DateTimeFormat(LOCALE, { month: style, timeZone: "UTC" }).format(
		new Date(`${month}-15T12:00:00Z`),
	);
}

/** The months the statement covers, oldest first. */
export const MONTHS = ["2026-09", "2026-10", "2026-11"] as const;

/**
 * The month before a `YYYY-MM` key.
 *
 * @param month `YYYY-MM`.
 */
export function previousMonth(month: string): string {
	let [year = 0, number = 1] = month.split("-").map(Number);
	return number === 1 ? `${year - 1}-12` : `${year}-${String(number - 1).padStart(2, "0")}`;
}

/**
 * Days in a `YYYY-MM` month.
 *
 * @param month `YYYY-MM`.
 */
export function daysInMonth(month: string): number {
	let [year = 0, number = 1] = month.split("-").map(Number);
	return new Date(Date.UTC(year, number, 0)).getUTCDate();
}

/**
 * What one visitor did on Hangwell, kept in their own cookies: the bag, a promo code, the
 * checkout they are part way through, placed orders, returns, saved addresses, a wishlist and
 * the posters they looked at. The server reads them to draw every screen, so the bag follows
 * the visitor across pages and works without script. Prices come from {@link priceCart}.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { allocate, percentOf } from "@sdxc/money";

import { demoAppCookiePath } from "~/resources/views/demo-apps";

import type { Address, Format, Poster, Promo, ShippingMethod, Variant } from "./data";

import {
	FREE_SHIPPING_FROM,
	OVERSIZE_FEE,
	SEED_ADDRESSES,
	SHIPPING,
	SLUG,
	VAT_PERCENT,
	availability,
	findFrame,
	findPayment,
	findPoster,
	findPromo,
	findShipping,
	findSize,
	salePrice,
} from "./data";

/** Every Hangwell cookie starts with this, which is how a request is known to be personal. */
const COOKIE_PREFIX = "hangwell.";

/** The cookie holding the bag's lines. */
const CART_COOKIE = `${COOKIE_PREFIX}cart`;

/** The cookie holding the applied promo code. */
const PROMO_COOKIE = `${COOKIE_PREFIX}promo`;

/** The cookie holding the checkout in progress. */
const CHECKOUT_COOKIE = `${COOKIE_PREFIX}checkout`;

/** The cookie holding placed orders. */
const ORDERS_COOKIE = `${COOKIE_PREFIX}orders`;

/** The cookie holding started returns. */
const RETURNS_COOKIE = `${COOKIE_PREFIX}returns`;

/** The cookie holding saved addresses once the visitor changes them. */
const ADDRESSES_COOKIE = `${COOKIE_PREFIX}addresses`;

/** The cookie holding the wishlist. */
const WISH_COOKIE = `${COOKIE_PREFIX}wish`;

/**
 * The cookie holding recently viewed posters. A product page's island writes it from the
 * browser, so it is readable by script; it holds nothing but poster ids.
 */
export const RECENT_COOKIE = `${COOKIE_PREFIX}recent`;

/** A week: long enough to come back to, short enough that the demo resets itself. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/** The most of one line a bag holds. */
export const MAX_QTY = 10;

/** How many placed orders the cookie keeps, newest first, so it stays well under 4 KB. */
const MAX_ORDERS = 3;

/** How many recently viewed posters are remembered. */
export const MAX_RECENT = 8;

/** One line of the bag: a poster, how it is made, and how many. */
export interface Line {
	poster: string;
	variant: Variant;
	qty: number;
}

/** The checkout in progress, filled in step by step. */
export interface CheckoutDraft {
	email: string;
	name: string;
	line1: string;
	line2: string;
	city: string;
	postcode: string;
	country: string;
	shipping: string;
	payment: string;
	gift: string;
	note: string;
}

/** An empty checkout, which the information step starts from. */
export const EMPTY_DRAFT: CheckoutDraft = {
	email: "",
	name: "",
	line1: "",
	line2: "",
	city: "",
	postcode: "",
	country: "PT",
	shipping: "standard",
	payment: "demo-card",
	gift: "",
	note: "",
};

/** A placed order. */
export interface Order {
	id: string;
	/** The short number a shopper reads, such as `HW-48213`. */
	number: string;
	placedAt: number;
	lines: Line[];
	promo: string;
	draft: CheckoutDraft;
}

/** A return the shopper started. */
export interface Return {
	id: string;
	order: string;
	/** Indexes into the order's lines. */
	lines: number[];
	reason: string;
	method: "dropoff" | "pickup";
	/** The pickup day, `YYYY-MM-DD`, or `""` for a drop-off. */
	day: string;
	startedAt: number;
}

/** What the visitor did, as every screen reads it. */
export interface Visitor {
	lines: Line[];
	promo: string;
	draft: CheckoutDraft;
	/** Orders placed here first, then the seeded history, newest first. */
	orders: Order[];
	returns: Return[];
	addresses: Address[];
	wish: string[];
	recent: string[];
}

/**
 * Splits a `Cookie` header into Hangwell's pairs. Where a name repeats, the first wins: browsers
 * send the cookie with the longest path first, so the app's own cookie outranks an older one.
 */
function hangwellCookies(header: string | null): Map<string, string> {
	let pairs = new Map<string, string>();
	for (let pair of (header ?? "").split(";")) {
		let [name = "", ...value] = pair.trim().split("=");
		if (name.startsWith(COOKIE_PREFIX) && !pairs.has(name))
			pairs.set(name, safeDecode(value.join("=")));
	}
	return pairs;
}

/** Decodes a cookie value, reading a malformed one as empty. */
function safeDecode(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return "";
	}
}

/**
 * Whether a request carries something the visitor did, so its pages render fresh rather than
 * from a copy cached for everyone.
 */
export function isPersonal(header: string | null): boolean {
	return hangwellCookies(header).size > 0;
}

/**
 * Whether a variant is one the poster sells: a print file has no size or frame, a print has a
 * size and no frame, and a framed print has both.
 */
export function validVariant(variant: Variant): boolean {
	if (variant.format === "digital")
		return variant.size === null && variant.frame === null && !variant.mount;
	if (findSize(variant.size ?? "") === undefined) return false;
	if (variant.format === "print") return variant.frame === null && !variant.mount;
	return findFrame(variant.frame ?? "") !== undefined;
}

/** A line's key, the same for two lines that should merge. */
function lineKey(line: Omit<Line, "qty">): string {
	let { format, frame, mount, size } = line.variant;
	return [line.poster, format, size ?? "", frame ?? "", mount ? "1" : "0"].join("~");
}

/** Encodes lines as `poster~format~size~frame~mount~qty`, joined by `,`. */
export function encodeLines(lines: Line[]): string {
	return lines.map((line) => `${lineKey(line)}~${line.qty}`).join(",");
}

/** Reads lines back, keeping only real posters and variants, so a tampered cookie only loses lines. */
export function decodeLines(value: string): Line[] {
	let lines: Line[] = [];
	for (let part of value.split(",")) {
		let [poster = "", format = "", size = "", frame = "", mount = "", count = ""] = part.split("~");
		let qty = Number(count);
		let variant: Variant = {
			format: format as Format,
			size: size === "" ? null : size,
			frame: frame === "" ? null : frame,
			mount: mount === "1",
		};
		if (
			findPoster(poster) !== undefined &&
			["digital", "print", "framed"].includes(format) &&
			validVariant(variant) &&
			Number.isInteger(qty) &&
			qty >= 1 &&
			qty <= MAX_QTY
		) {
			lines.push({ poster, variant, qty });
		}
	}
	return lines;
}

/**
 * Adds a line to the bag: the same poster made the same way grows its line, up to
 * {@link MAX_QTY}; anything else goes on the end.
 */
export function addLine(lines: Line[], line: Line): Line[] {
	let same = lines.findIndex((entry) => lineKey(entry) === lineKey(line));
	if (same === -1) return [...lines, { ...line, qty: Math.min(line.qty, MAX_QTY) }];
	return lines.map((entry, index) =>
		index === same ? { ...entry, qty: Math.min(entry.qty + line.qty, MAX_QTY) } : entry,
	);
}

/** Reads a draft from its cookie form, filling what's missing from {@link EMPTY_DRAFT}. */
function readDraft(value: string | undefined): CheckoutDraft {
	let params = new URLSearchParams(value ?? "");
	let draft = { ...EMPTY_DRAFT };
	for (let key of Object.keys(EMPTY_DRAFT) as (keyof CheckoutDraft)[]) {
		let field = params.get(key);
		if (field !== null) draft[key] = field.slice(0, 200);
	}
	if (findShipping(draft.shipping) === undefined) draft.shipping = EMPTY_DRAFT.shipping;
	if (findPayment(draft.payment) === undefined) draft.payment = EMPTY_DRAFT.payment;
	return draft;
}

/** Writes a draft in its cookie form. */
function encodeDraft(draft: CheckoutDraft): string {
	return new URLSearchParams(Object.entries(draft).filter(([, value]) => value !== "")).toString();
}

/** Reads placed orders from their cookie form, dropping any that don't parse. */
function readOrders(value: string | undefined): Order[] {
	if (value === undefined || value === "") return [];
	let orders: Order[] = [];
	for (let part of value.split("!")) {
		let params = new URLSearchParams(part);
		let id = params.get("id") ?? "";
		let placedAt = Number(params.get("at"));
		let lines = decodeLines(params.get("lines") ?? "");
		if (!/^[0-9a-f-]{36}$/.test(id) || !Number.isSafeInteger(placedAt) || lines.length === 0)
			continue;
		orders.push({
			id,
			number: params.get("n") ?? "HW-00000",
			placedAt,
			lines,
			promo: params.get("promo") ?? "",
			draft: readDraft(params.get("d") ?? ""),
		});
	}
	return orders;
}

/** Writes one order in its cookie form. */
function encodeOrder(order: Order): string {
	return new URLSearchParams({
		id: order.id,
		n: order.number,
		at: String(order.placedAt),
		lines: encodeLines(order.lines),
		promo: order.promo,
		d: encodeDraft(order.draft),
	}).toString();
}

/** Reads started returns. */
function readReturns(value: string | undefined): Return[] {
	if (value === undefined || value === "") return [];
	let returns: Return[] = [];
	for (let part of value.split("!")) {
		let params = new URLSearchParams(part);
		let lines = (params.get("lines") ?? "").split(".").map(Number).filter(Number.isInteger);
		let method: Return["method"] = params.get("m") === "pickup" ? "pickup" : "dropoff";
		let startedAt = Number(params.get("at"));
		if (lines.length === 0 || !Number.isSafeInteger(startedAt)) continue;
		returns.push({
			id: params.get("id") ?? "",
			order: params.get("o") ?? "",
			lines,
			reason: params.get("r") ?? "",
			method,
			day: params.get("day") ?? "",
			startedAt,
		});
	}
	return returns;
}

/** Writes one return in its cookie form. */
function encodeReturn(entry: Return): string {
	return new URLSearchParams({
		id: entry.id,
		o: entry.order,
		lines: entry.lines.join("."),
		r: entry.reason,
		m: entry.method,
		day: entry.day,
		at: String(entry.startedAt),
	}).toString();
}

/** Reads saved addresses; without the cookie, the seeded ones. */
function readAddresses(value: string | undefined): Address[] {
	if (value === undefined) return SEED_ADDRESSES;
	if (value === "") return [];
	return value.split("!").map((part) => {
		let params = new URLSearchParams(part);
		return {
			id: params.get("id") ?? "",
			name: params.get("name") ?? "",
			line1: params.get("line1") ?? "",
			line2: params.get("line2") ?? "",
			city: params.get("city") ?? "",
			postcode: params.get("postcode") ?? "",
			country: params.get("country") ?? "PT",
		};
	});
}

/** A list of poster ids, keeping only real ones. */
function readIds(value: string | undefined): string[] {
	return (value ?? "")
		.split(",")
		.filter((id, index, all) => findPoster(id) !== undefined && all.indexOf(id) === index);
}

/**
 * Two orders the shopper placed before the demo began, so the account has history: one
 * delivered framed print and one print file.
 */
export function pastOrders(now: number): Order[] {
	let day = 24 * 60 * 60 * 1000;
	let home = SEED_ADDRESSES[0]!;
	let draft: CheckoutDraft = {
		...EMPTY_DRAFT,
		email: "maya@example.com",
		name: home.name,
		line1: home.line1,
		line2: home.line2,
		city: home.city,
		postcode: home.postcode,
		country: home.country,
	};
	return [
		{
			id: "0190a1b2-0000-7000-8000-000000000101",
			number: "HW-40312",
			placedAt: now - 12 * day,
			lines: [
				{
					poster: "fern-study",
					variant: { format: "framed", size: "50x70", frame: "oak", mount: true },
					qty: 1,
				},
				{
					poster: "slow-mornings",
					variant: { format: "print", size: "a3", frame: null, mount: false },
					qty: 2,
				},
			],
			promo: "WELCOME10",
			draft,
		},
		{
			id: "0190a1b2-0000-7000-8000-000000000102",
			number: "HW-38871",
			placedAt: now - 41 * day,
			lines: [
				{
					poster: "korrin-hills",
					variant: { format: "digital", size: null, frame: null, mount: false },
					qty: 1,
				},
			],
			promo: "",
			draft: { ...draft, shipping: "standard" },
		},
	];
}

/**
 * Reads everything the visitor did. Anything that doesn't parse is dropped, and the seeded
 * history follows the visitor's own orders.
 *
 * @param header The request's `Cookie` header.
 * @param now The current time, which places the seeded history.
 */
export function readVisitor(header: string | null, now = Date.now()): Visitor {
	let cookies = hangwellCookies(header);
	return {
		lines: decodeLines(cookies.get(CART_COOKIE) ?? ""),
		promo: cookies.get(PROMO_COOKIE) ?? "",
		draft: readDraft(cookies.get(CHECKOUT_COOKIE)),
		orders: [...readOrders(cookies.get(ORDERS_COOKIE)), ...pastOrders(now)],
		returns: readReturns(cookies.get(RETURNS_COOKIE)),
		addresses: readAddresses(cookies.get(ADDRESSES_COOKIE)),
		wish: readIds(cookies.get(WISH_COOKIE)),
		recent: readIds(cookies.get(RECENT_COOKIE)).slice(0, MAX_RECENT),
	};
}

/** One `Set-Cookie` value under the app's own path. */
function cookieHeader(name: string, value: string, maxAge = COOKIE_MAX_AGE): string {
	return `${name}=${encodeURIComponent(value)}; Path=${demoAppCookiePath(SLUG)}; Max-Age=${maxAge}; SameSite=Lax; HttpOnly`;
}

/** The cookie holding the bag, or one that clears it when no line is left. */
export function cartCookie(lines: Line[]): string {
	return lines.length === 0
		? cookieHeader(CART_COOKIE, "", 0)
		: cookieHeader(CART_COOKIE, encodeLines(lines));
}

/** The cookie holding a promo code, or one that clears it. */
export function promoCookie(code: string): string {
	return code === "" ? cookieHeader(PROMO_COOKIE, "", 0) : cookieHeader(PROMO_COOKIE, code);
}

/** The cookie holding the checkout draft, or one that clears it. */
export function draftCookie(draft: CheckoutDraft | null): string {
	return draft === null
		? cookieHeader(CHECKOUT_COOKIE, "", 0)
		: cookieHeader(CHECKOUT_COOKIE, encodeDraft(draft));
}

/** The cookie holding the visitor's own orders with one more at the front. */
export function ordersCookie(header: string | null, order: Order): string {
	let kept = readOrders(hangwellCookies(header).get(ORDERS_COOKIE)).filter(
		(entry) => entry.id !== order.id,
	);
	return cookieHeader(
		ORDERS_COOKIE,
		[order, ...kept].slice(0, MAX_ORDERS).map(encodeOrder).join("!"),
	);
}

/** The cookie holding returns with one more at the front. */
export function returnsCookie(header: string | null, entry: Return): string {
	let kept = readReturns(hangwellCookies(header).get(RETURNS_COOKIE)).filter(
		(other) => other.id !== entry.id,
	);
	return cookieHeader(RETURNS_COOKIE, [entry, ...kept].slice(0, 4).map(encodeReturn).join("!"));
}

/** The cookie holding saved addresses. */
export function addressesCookie(addresses: Address[]): string {
	return cookieHeader(
		ADDRESSES_COOKIE,
		addresses
			.slice(0, 4)
			.map((address) => new URLSearchParams({ ...address }).toString())
			.join("!"),
	);
}

/** The cookie holding the wishlist. */
export function wishCookie(ids: string[]): string {
	return cookieHeader(WISH_COOKIE, ids.slice(0, 24).join(","));
}

/** The cookies that put the demo back as it started: every Hangwell cookie the request carries, expired. */
export function resetCookies(header: string | null): string[] {
	return [...hangwellCookies(header).keys()].map((name) => cookieHeader(name, "", 0));
}

/** A line's poster, which decoding guarantees exists. */
export function linePoster(line: Line): Poster {
	return findPoster(line.poster)!;
}

/** One line's price: the poster's sale price for its variant, times how many. */
export function lineTotal(line: Line): number {
	return salePrice(linePoster(line), line.variant) * line.qty;
}

/** How many items lines hold. */
export function lineCount(lines: Line[]): number {
	return lines.reduce((sum, line) => sum + line.qty, 0);
}

/** Whether a line is shipped rather than downloaded. */
export function isPhysical(line: Line): boolean {
	return line.variant.format !== "digital";
}

/** What applying a promo code to a bag did, or why it can't. */
export type PromoCheck = { ok: true; promo: Promo } | { ok: false; message: string };

/** Checks a promo code against a bag, with the message a shopper reads when it fails. */
export function checkPromo(code: string, lines: Line[]): PromoCheck {
	let promo = findPromo(code);
	if (code.trim() === "") return { ok: false, message: "Enter a code." };
	if (promo === undefined)
		return {
			ok: false,
			message: `We don't recognise ${code.trim().toUpperCase()}. Check the spelling.`,
		};
	if (promo.ended !== undefined)
		return { ok: false, message: `${promo.code} ended on ${promo.ended}.` };
	let subtotal = lines.reduce((sum, line) => sum + lineTotal(line), 0);
	if (subtotal < promo.minimum)
		return {
			ok: false,
			message: `${promo.code} needs an order of at least €${promo.minimum / 100}.`,
		};
	if (promo.applies === "framed" && !lines.some((line) => line.variant.format === "framed")) {
		return {
			ok: false,
			message: `${promo.code} takes money off framed prints. Add one to use it.`,
		};
	}
	if (promo.applies === "shipping" && !lines.some(isPhysical)) {
		return { ok: false, message: `${promo.code} is for shipping, and this bag downloads only.` };
	}
	return { ok: true, promo };
}

/** What a bag or an order costs, in cents. */
export interface Totals {
	subtotal: number;
	/** The physical lines' subtotal, which free shipping is measured against. */
	physical: number;
	discount: number;
	/** `null` when nothing ships. */
	shipping: number | null;
	oversize: number;
	total: number;
	/** The VAT inside the total. */
	vat: number;
	/** The discount's share on each line, in line order, summing to {@link discount} exactly. */
	lineDiscounts: number[];
	/** How much more physical spend makes standard shipping free, `0` once it is. */
	toFreeShipping: number;
	promo: Promo | null;
}

/**
 * Prices a bag: the lines, the promo (spread across the lines it touches with `allocate`, so a
 * refund later returns an exact share), shipping for the physical part only, and the VAT the
 * total already includes.
 *
 * @param lines The bag's lines.
 * @param code The applied promo code, `""` for none.
 * @param method The shipping method id.
 */
export function priceCart(lines: Line[], code: string, method: string): Totals {
	let totals = lines.map(lineTotal);
	let subtotal = totals.reduce((sum, value) => sum + value, 0);
	let physical = lines.reduce(
		(sum, line, index) => sum + (isPhysical(line) ? (totals[index] ?? 0) : 0),
		0,
	);
	let check = code === "" ? null : checkPromo(code, lines);
	let promo = check?.ok === true ? check.promo : null;
	let shippingMethod: ShippingMethod = findShipping(method) ?? SHIPPING[0]!;
	let ships = physical > 0;
	let shipping: number | null = null;
	let oversize = 0;
	if (ships) {
		shipping =
			shippingMethod.id === "standard" && physical >= FREE_SHIPPING_FROM ? 0 : shippingMethod.price;
		let big = lines.some(
			(line) => line.variant.format === "framed" && line.variant.size === "70x100",
		);
		oversize = big && shippingMethod.id !== "pickup" ? OVERSIZE_FEE : 0;
	}
	let lineDiscounts = lines.map(() => 0);
	let discount = 0;
	if (promo !== null && promo.applies !== "shipping") {
		let weights = lines.map((line, index) =>
			promo!.applies === "all" || line.variant.format === "framed" ? (totals[index] ?? 0) : 0,
		);
		let base = weights.reduce((sum, value) => sum + value, 0);
		discount = percentOf(base, promo.percent);
		lineDiscounts = base === 0 ? lineDiscounts : allocate(discount, weights);
	}
	if (
		promo !== null &&
		promo.applies === "shipping" &&
		shipping !== null &&
		shippingMethod.id === "standard"
	) {
		discount = shipping;
	}
	let total = subtotal - discount + (shipping ?? 0) + oversize;
	let vat = total - Math.round((total * 100) / (100 + VAT_PERCENT));
	return {
		subtotal,
		physical,
		discount,
		shipping,
		oversize,
		total,
		vat,
		lineDiscounts,
		toFreeShipping: ships ? Math.max(FREE_SHIPPING_FROM - physical, 0) : 0,
		promo,
	};
}

/** Whether every line can still be ordered, and the first one that can't. */
export function unavailableLine(lines: Line[]): Line | undefined {
	return lines.find((line) => !availability(linePoster(line), line.variant).available);
}

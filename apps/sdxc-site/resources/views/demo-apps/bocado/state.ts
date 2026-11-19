/**
 * What one visitor did on Bocado, kept in their own cookies: the address they deliver to, the
 * cart and the orders they placed. The server reads them to draw every screen, so the cart
 * follows the visitor across pages, survives a reload and works without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { percentOf } from "@sdxc/money";

import { demoAppCookiePath } from "~/resources/views/demo-apps";

import type { Address, Line, Order, Restaurant } from "./data";

import {
	ADDRESSES,
	PRIORITY_FEE,
	SERVICE_MIN,
	SERVICE_PERCENT,
	SLUG,
	findAddress,
	findChoice,
	findItem,
	findPayment,
	findRestaurant,
	itemGroups,
	pastOrders,
} from "./data";

/** Every Bocado cookie starts with this, which is how a request is known to be personal. */
const COOKIE_PREFIX = "bocado.";

/** The cookie naming the address the visitor delivers to. */
export const ADDRESS_COOKIE = `${COOKIE_PREFIX}address`;

/** The cookie holding the cart. */
export const CART_COOKIE = `${COOKIE_PREFIX}cart`;

/** The cookie holding the orders the visitor placed. */
export const ORDERS_COOKIE = `${COOKIE_PREFIX}orders`;

/** A week: long enough to come back to, short enough that the demo resets itself. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/** How many placed orders the cookie keeps, newest first, so it stays well under 4 KB. */
const MAX_ORDERS = 4;

/** The most of one dish a line holds. */
export const MAX_QTY = 20;

/** The visitor's cart: one restaurant and the dishes from it. */
export interface Cart {
	restaurant: Restaurant;
	lines: Line[];
}

/** What the visitor did, as every screen reads it. */
export interface Visitor {
	address: Address;
	cart: Cart | undefined;
	/** Every order, the ones placed here first and then the seeded history, newest first. */
	orders: Order[];
}

/**
 * Splits a `Cookie` header into Bocado's pairs. Where a name repeats, the first wins: browsers
 * send the cookie with the longest path first, so the app's own cookie outranks an older one.
 */
function bocadoCookies(header: string | null): Map<string, string> {
	let pairs = new Map<string, string>();
	for (let pair of (header ?? "").split(";")) {
		let [name = "", ...value] = pair.trim().split("=");
		if (name.startsWith(COOKIE_PREFIX) && !pairs.has(name)) {
			pairs.set(name, safeDecode(value.join("=")));
		}
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
 *
 * @param header The request's `Cookie` header.
 */
export function isPersonal(header: string | null): boolean {
	return bocadoCookies(header).size > 0;
}

/**
 * Encodes lines as `item~choice.choice~qty`, joined by `,`.
 *
 * @example encodeLines([{ item: "theory", choices: ["double"], qty: 2 }]) // "theory~double~2"
 */
export function encodeLines(lines: Line[]): string {
	return lines.map((line) => `${line.item}~${line.choices.join(".")}~${line.qty}`).join(",");
}

/**
 * Reads lines back for one restaurant, keeping only dishes on its menu with valid picks for
 * them, so a tampered cookie can only lose lines.
 */
export function decodeLines(restaurant: Restaurant, value: string): Line[] {
	let lines: Line[] = [];
	for (let part of value.split(",")) {
		let [id = "", picks = "", count = ""] = part.split("~");
		let qty = Number(count);
		let line = { item: id, choices: picks === "" ? [] : picks.split("."), qty };
		if (Number.isInteger(qty) && qty >= 1 && qty <= MAX_QTY && validLine(restaurant, line)) {
			lines.push(line);
		}
	}
	return lines;
}

/**
 * Whether a line names a dish the restaurant serves, with exactly one pick for each required
 * group and no more than each optional group allows.
 *
 * @param restaurant Where the line is ordered from.
 * @param line The dish and its picks.
 */
export function validLine(restaurant: Restaurant, line: Omit<Line, "qty">): boolean {
	let entry = findItem(restaurant, line.item);
	if (entry === undefined) return false;
	let groups = itemGroups(restaurant, entry);
	let allowed = new Set(groups.flatMap((group) => group.choices.map((choice) => choice.id)));
	if (!line.choices.every((choice) => allowed.has(choice))) return false;
	if (new Set(line.choices).size !== line.choices.length) return false;
	return groups.every((group) => {
		let picked = group.choices.filter((choice) => line.choices.includes(choice.id)).length;
		return group.required ? picked === 1 : picked <= group.max;
	});
}

/** Reads the cart cookie: `restaurant|lines`. An unknown restaurant or empty cart reads as none. */
function readCart(value: string | undefined): Cart | undefined {
	if (value === undefined) return undefined;
	let [id = "", rest = ""] = value.split("|");
	let restaurant = findRestaurant(id);
	if (restaurant === undefined) return undefined;
	let lines = decodeLines(restaurant, rest);
	return lines.length === 0 ? undefined : { restaurant, lines };
}

/** Reads one placed order from its cookie form, or `undefined` for one that does not parse. */
function readOrder(value: string): Order | undefined {
	let [
		id = "",
		restaurantId = "",
		placed = "",
		tip = "",
		address = "",
		payment = "",
		priority,
		lines = "",
	] = value.split("*");
	let restaurant = findRestaurant(restaurantId);
	let placedAt = Number(placed);
	if (
		restaurant === undefined ||
		!/^[0-9a-f-]{36}$/.test(id) ||
		!Number.isSafeInteger(placedAt) ||
		findAddress(address) === undefined ||
		findPayment(payment) === undefined
	) {
		return undefined;
	}
	let decoded = decodeLines(restaurant, lines);
	if (decoded.length === 0) return undefined;
	return {
		id,
		restaurant: restaurant.id,
		lines: decoded,
		placedAt,
		tip: Math.min(Math.max(Number(tip) || 0, 0), 30),
		address,
		payment,
		priority: priority === "1",
	};
}

/** Encodes one placed order for the orders cookie. */
function encodeOrder(order: Order): string {
	return [
		order.id,
		order.restaurant,
		order.placedAt,
		order.tip,
		order.address,
		order.payment,
		order.priority ? "1" : "0",
		encodeLines(order.lines),
	].join("*");
}

/** The orders the visitor placed here, newest first, read from their cookie. */
function placedOrders(cookies: Map<string, string>): Order[] {
	let value = cookies.get(ORDERS_COOKIE);
	if (value === undefined || value === "") return [];
	return value
		.split("!")
		.map(readOrder)
		.filter((order): order is Order => order !== undefined);
}

/**
 * Reads the visitor's address, cart and orders. An unknown address reads as the first saved
 * one, and anything that does not parse is dropped.
 *
 * @param header The request's `Cookie` header.
 * @param now The current time, which places the seeded history.
 */
export function readVisitor(header: string | null, now = Date.now()): Visitor {
	let cookies = bocadoCookies(header);
	let address = findAddress(cookies.get(ADDRESS_COOKIE) ?? "") ?? ADDRESSES[0]!;
	return {
		address,
		cart: readCart(cookies.get(CART_COOKIE)),
		orders: [...placedOrders(cookies), ...pastOrders(now)],
	};
}

/** One `Set-Cookie` value under the app's own path. */
function cookieHeader(name: string, value: string, maxAge = COOKIE_MAX_AGE): string {
	return `${name}=${encodeURIComponent(value)}; Path=${demoAppCookiePath(SLUG)}; Max-Age=${maxAge}; SameSite=Lax; HttpOnly`;
}

/** The cookie that delivers to a saved address. */
export function addressCookie(address: Address): string {
	return cookieHeader(ADDRESS_COOKIE, address.id);
}

/**
 * The cookie holding a cart, or one that clears it when no line is left.
 *
 * @param restaurant Where the cart orders from.
 * @param lines Its dishes; an empty list clears the cart.
 */
export function cartCookie(restaurant: Restaurant, lines: Line[]): string {
	return lines.length === 0
		? cookieHeader(CART_COOKIE, "", 0)
		: cookieHeader(CART_COOKIE, `${restaurant.id}|${encodeLines(lines)}`);
}

/**
 * The cookie holding the visitor's placed orders with one more at the front, keeping the
 * newest {@link MAX_ORDERS}. Seeded history is never written.
 *
 * @param header The request's `Cookie` header.
 * @param order The order just placed.
 */
export function ordersCookie(header: string | null, order: Order): string {
	let kept = placedOrders(bocadoCookies(header)).filter((entry) => entry.id !== order.id);
	let next = [order, ...kept].slice(0, MAX_ORDERS);
	return cookieHeader(ORDERS_COOKIE, next.map(encodeOrder).join("!"));
}

/**
 * The cookies that put the demo back as it started: every Bocado cookie the request carries,
 * expired.
 *
 * @param header The request's `Cookie` header.
 */
export function resetCookies(header: string | null): string[] {
	return [...bocadoCookies(header).keys()].map((name) => cookieHeader(name, "", 0));
}

/**
 * Adds a dish to a cart's lines: the same dish with the same picks grows its line, up to
 * {@link MAX_QTY}; anything else goes on the end.
 */
export function addLine(lines: Line[], line: Line): Line[] {
	let key = (entry: Line) => `${entry.item}~${entry.choices.join(".")}`;
	let same = lines.findIndex((entry) => key(entry) === key(line));
	if (same === -1) return [...lines, { ...line, qty: Math.min(line.qty, MAX_QTY) }];
	return lines.map((entry, index) =>
		index === same ? { ...entry, qty: Math.min(entry.qty + line.qty, MAX_QTY) } : entry,
	);
}

/** One line's price: its dish and every pick, times how many. */
export function lineTotal(restaurant: Restaurant, line: Line): number {
	let entry = findItem(restaurant, line.item);
	if (entry === undefined) return 0;
	let picks = line.choices.reduce((sum, id) => sum + (findChoice(restaurant, id)?.price ?? 0), 0);
	return (entry.price + picks) * line.qty;
}

/** How many dishes lines hold. */
export function lineCount(lines: Line[]): number {
	return lines.reduce((sum, line) => sum + line.qty, 0);
}

/** What an order costs, in cents, line by line. */
export interface Totals {
	subtotal: number;
	delivery: number;
	service: number;
	priority: number;
	tip: number;
	total: number;
}

/**
 * Prices a cart or an order: the subtotal, the restaurant's delivery fee, the service fee (a
 * share of the subtotal with a floor), priority and the tip, a percent of the subtotal.
 *
 * @param restaurant Where it is ordered from.
 * @param lines Its dishes.
 * @param options The tip's percent and whether delivery is priority.
 */
export function priceLines(
	restaurant: Restaurant,
	lines: Line[],
	options: { tip: number; priority: boolean },
): Totals {
	let subtotal = lines.reduce((sum, line) => sum + lineTotal(restaurant, line), 0);
	let service = Math.max(percentOf(subtotal, SERVICE_PERCENT), SERVICE_MIN);
	let priority = options.priority ? PRIORITY_FEE : 0;
	let tip = percentOf(subtotal, options.tip);
	let delivery = restaurant.fee;
	return {
		subtotal,
		delivery,
		service,
		priority,
		tip,
		total: subtotal + delivery + service + priority + tip,
	};
}

/** The picks of a line as a reader sees them, such as "Blue corn · Guacamole". */
export function choiceSummary(restaurant: Restaurant, line: Line): string {
	return line.choices
		.map((id) => findChoice(restaurant, id)?.name)
		.filter((name): name is string => name !== undefined)
		.join(" · ");
}

/**
 * Bocado, an invented food delivery app: restaurants near a saved address, search with
 * filters, menus whose dishes ask for their picks, a cart that follows the visitor, checkout
 * with invented saved cards, live order tracking on a drawn map, and the order history.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { LinkButton } from "@sdxc/ui";
import { generateUUID } from "@sdxc/uuid/v7";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";

import type { DemoApp, DemoAppRequest } from "~/resources/views/demo-apps";

import { DEMO_APP_TOAST_PARAM } from "~/resources/views/demo-apps";
import {
	MAIN_FRAME,
	MainFrame,
	MainScreen,
	mainSource,
} from "~/resources/views/demo-apps/main-frame";
import { MainFrameSync } from "~/resources/views/demo-apps/main-frame-sync";

import type { Destination } from "./shell";

import { DishArt } from "./art";
import { CartPage, CheckoutPage } from "./checkout";
import {
	RESTAURANTS,
	TIPS,
	findAddress,
	findPayment,
	findRestaurant,
	href,
	readSearch,
} from "./data";
import { MAP_HOST } from "./delivery-map";
import Home from "./home";
import { OrdersPage, TrackingPage } from "./orders";
import { Gutter } from "./parts";
import RestaurantPage from "./restaurant";
import SearchPage from "./search";
import BocadoShell, { LoadingBar } from "./shell";
import {
	addLine,
	addressCookie,
	cartCookie,
	isPersonal,
	ordersCookie,
	readVisitor,
	resetCookies,
	validLine,
} from "./state";
import { BocadoThumbnail } from "./thumbnail";
import { trackingStream } from "./tracking";

/** A berry red at hue 355: warm like food, far from any delivery brand's colour. */
const BRAND = [
	"oklch(0.97 0.015 355)",
	"oklch(0.93 0.04 355)",
	"oklch(0.87 0.08 355)",
	"oklch(0.78 0.13 355)",
	"oklch(0.68 0.18 355)",
	"oklch(0.58 0.2 355)",
	"oklch(0.5 0.19 355)",
	"oklch(0.43 0.16 355)",
	"oklch(0.36 0.13 355)",
	"oklch(0.29 0.1 355)",
	"oklch(0.2 0.07 355)",
] as const;

/** Warm cream neutrals, like a paper tray liner, deepening to a plum-brown. */
const NEUTRAL = [
	"oklch(0.985 0.006 80)",
	"oklch(0.965 0.009 75)",
	"oklch(0.92 0.012 70)",
	"oklch(0.86 0.014 60)",
	"oklch(0.72 0.016 50)",
	"oklch(0.58 0.018 40)",
	"oklch(0.46 0.018 30)",
	"oklch(0.37 0.016 20)",
	"oklch(0.28 0.014 10)",
	"oklch(0.21 0.012 0)",
	"oklch(0.15 0.01 350)",
] as const;

/** A rounded face where the platform has one, generous radii and pill buttons. */
const TOKENS = {
	"--ui-font-sans":
		"ui-rounded, 'SF Pro Rounded', 'Nunito', 'Segoe UI Variable Display', 'Segoe UI', system-ui, -apple-system, sans-serif",
	"--ui-radius-sm": "0.5rem",
	"--ui-radius-md": "0.75rem",
	"--ui-radius-lg": "1rem",
	"--ui-cta-radius": "999px",
} as const;

/** The pages a post may return to, so a post can never send the visitor elsewhere. */
const RETURN_PAGES = /^(|search|cart|checkout|orders|r\/[a-z-]+)(\?[\w=&%.+-]*)?$/;

/** An address post: which saved address, and the page to return to. */
const ADDRESS_FORM = f.object({
	address: f.field(s.string()),
	back: f.field(s.defaulted(s.string(), "")),
});

/** A cart post naming a line and its new count. */
const LINE_FORM = f.object({
	line: f.field(s.string()),
	qty: f.field(s.string()),
	back: f.field(s.defaulted(s.string(), "cart")),
});

/** A checkout post: where, how fast, how to pay and the tip. */
const CHECKOUT_FORM = f.object({
	address: f.field(s.string()),
	payment: f.field(s.string()),
	tip: f.field(s.defaulted(s.string(), "0")),
	speed: f.field(s.defaulted(s.enum_(["standard", "priority"]), "standard")),
});

/** Every toast a Bocado redirect can name. */
const TOASTS: DemoApp["toasts"] = {
	added: { color: "success", title: "Added to cart" },
	"new-cart": {
		color: "neutral",
		title: "Started a new cart",
		description: "The cart from the other restaurant was emptied.",
	},
	"cart-conflict": {
		color: "warning",
		title: "Your cart is from another restaurant",
		description: "Open the dish again to start a new cart.",
	},
	"pick-missing": {
		color: "warning",
		title: "Pick every required option",
		description: "Each one marked Required needs a choice.",
	},
	closed: { color: "warning", title: "This kitchen isn't open yet" },
	updated: { color: "neutral", title: "Cart updated" },
	removed: { color: "neutral", title: "Removed from cart" },
	cleared: { color: "neutral", title: "Cart emptied" },
	address: { color: "neutral", title: "Delivery address changed" },
	placed: {
		color: "success",
		title: "Order placed",
		description: "The restaurant has it. Track it here.",
	},
	reordered: {
		color: "success",
		title: "Order added to your cart",
		description: "Check it over, then head to checkout.",
	},
	"empty-cart": { color: "warning", title: "Your cart is empty" },
	reset: {
		color: "neutral",
		title: "Demo reset",
		description: "Cart, address and orders are back to how they started.",
	},
};

/** One Bocado screen: its title and status, the destination it marks, and its content. */
interface BocadoScreen {
	title: string;
	status?: number;
	current: Destination;
	content: RemixNode;
}

/** The app's own 404, inside its frame. */
function NotFound() {
	return () => (
		<Gutter>
			<div style="display:grid;justify-items:center;gap:0.75rem;padding-block:4rem;text-align:center">
				<span style="inline-size:6rem">
					<DishArt dish="bowl" />
				</span>
				<h1 style="margin:0;font-size:1.5rem">This page isn't on the menu</h1>
				<p style="margin:0;color:var(--ui-neutral-fg-muted)">
					It may have moved, or the address has a typo.
				</p>
				<LinkButton href={href()} color="brand">
					Back to restaurants
				</LinkButton>
			</div>
		</Gutter>
	);
}

/** Picks the screen a page path names; a path Bocado lacks gets its own 404 in the frame. */
function route(request: DemoAppRequest, now: number): BocadoScreen {
	let visitor = readVisitor(request.cookie, now);
	let [first = "", second, extra] = request.page.split("/");
	let notFound: BocadoScreen = {
		title: "Not found",
		status: 404,
		current: "none",
		content: <NotFound />,
	};
	if (extra !== undefined) return notFound;
	if (second !== undefined) {
		if (first === "r") {
			let restaurant = findRestaurant(second);
			if (restaurant === undefined) return notFound;
			return {
				title: restaurant.name,
				current: "none",
				content: (
					<RestaurantPage restaurant={restaurant} visitor={visitor} back={`r/${restaurant.id}`} />
				),
			};
		}
		if (first === "orders") {
			let order = visitor.orders.find((entry) => entry.id === second);
			if (order === undefined) return notFound;
			return {
				title: `Order from ${findRestaurant(order.restaurant)?.name ?? "Bocado"}`,
				current: "orders",
				content: <TrackingPage order={order} now={now} />,
			};
		}
		return notFound;
	}
	if (first === "") return { title: "Home", current: "home", content: <Home visitor={visitor} /> };
	if (first === "search") {
		let query = readSearch(request.url.searchParams);
		return {
			title: query.q === "" ? (query.cuisine?.name ?? "Search") : `Search: ${query.q}`,
			current: "search",
			content: <SearchPage query={query} />,
		};
	}
	if (first === "cart")
		return { title: "Cart", current: "cart", content: <CartPage visitor={visitor} /> };
	if (first === "checkout")
		return { title: "Checkout", current: "cart", content: <CheckoutPage visitor={visitor} /> };
	if (first === "orders")
		return {
			title: "Orders",
			current: "orders",
			content: <OrdersPage visitor={visitor} now={now} />,
		};
	return notFound;
}

/** A form field as text, `""` when it is missing or a file. */
function formText(form: FormData, name: string): string {
	let value = form.get(name);
	return typeof value === "string" ? value : "";
}

/** The page a post returns to, or `fallback` for one that would leave Bocado. */
function returnPage(back: unknown, fallback: string): string {
	return typeof back === "string" && RETURN_PAGES.test(back) ? back : fallback;
}

/**
 * Adds a dish to the cart. Each required group must have exactly one pick and each optional
 * group no more than it allows; a cart from another restaurant is kept unless the post says to
 * replace it, which the dialog does once it has warned.
 */
function addToCart(form: FormData, cookie: string | null) {
	let restaurant = findRestaurant(formText(form, "restaurant"));
	let item = formText(form, "item");
	if (restaurant === undefined) return null;
	let back = returnPage(form.get("back"), `r/${restaurant.id}`);
	let qty = Number(form.get("qty") ?? "1");
	if (!Number.isInteger(qty) || qty < 1 || qty > 20) return null;
	let choices = [...form.entries()]
		.filter(([name]) => name.startsWith("g."))
		.map(([, value]) => String(value));
	let line = { item, choices, qty };
	if (restaurant.opensAt !== undefined) return { page: back, toast: "closed" };
	if (!validLine(restaurant, line)) {
		return restaurant.sections.some((section) => section.items.some((entry) => entry.id === item))
			? { page: back, toast: "pick-missing" }
			: null;
	}
	let visitor = readVisitor(cookie);
	let current = visitor.cart;
	if (current !== undefined && current.restaurant.id !== restaurant.id) {
		if (form.get("replace") !== "1") return { page: back, toast: "cart-conflict" };
		return { page: back, toast: "new-cart", cookies: [cartCookie(restaurant, [line])] };
	}
	return {
		page: back,
		toast: "added",
		cookies: [cartCookie(restaurant, addLine(current?.lines ?? [], line))],
	};
}

/** Changes a cart line's count; zero removes it. */
function changeLine(form: FormData, cookie: string | null) {
	let parsed = s.parseSafe(LINE_FORM, form);
	let cart = readVisitor(cookie).cart;
	if (!parsed.success) return null;
	let back = returnPage(parsed.value.back, "cart");
	if (cart === undefined) return { page: back };
	let index = Number(parsed.value.line);
	let qty = Number(parsed.value.qty);
	if (!Number.isInteger(index) || index < 0 || index >= cart.lines.length) return { page: back };
	if (!Number.isInteger(qty) || qty < 0 || qty > 20) return null;
	let lines =
		qty === 0
			? cart.lines.filter((_, at) => at !== index)
			: cart.lines.map((line, at) => (at === index ? { ...line, qty } : line));
	return {
		page: back,
		toast: qty === 0 ? "removed" : "updated",
		cookies: [cartCookie(cart.restaurant, lines)],
	};
}

/** Places the cart as an order and sends the visitor to track it. */
function placeOrder(form: FormData, cookie: string | null) {
	let parsed = s.parseSafe(CHECKOUT_FORM, form);
	if (!parsed.success) return null;
	let { address, payment, speed, tip } = parsed.value;
	let percent = Number(tip);
	if (findAddress(address) === undefined || findPayment(payment) === undefined) return null;
	if (!(TIPS as readonly number[]).includes(percent)) return null;
	let cart = readVisitor(cookie).cart;
	if (cart === undefined) return { page: "cart", toast: "empty-cart" };
	let order = {
		id: generateUUID(),
		restaurant: cart.restaurant.id,
		lines: cart.lines,
		placedAt: Date.now(),
		tip: percent,
		address,
		payment,
		priority: speed === "priority",
	};
	let chosen = findAddress(address)!;
	return {
		page: `orders/${order.id}`,
		toast: "placed",
		cookies: [ordersCookie(cookie, order), cartCookie(cart.restaurant, []), addressCookie(chosen)],
	};
}

/** Every screen a visitor reaches by clicking, so a test can walk them all. */
const SCREENS = [
	"",
	"search",
	"search?q=ceviche",
	"search?cuisine=empanadas",
	"search?free=1&sort=fastest",
	"search?q=zzz",
	"search?rating=4.8&price=1&fast=1",
	...RESTAURANTS.map((restaurant) => `r/${restaurant.id}`),
	"cart",
	"checkout",
	"orders",
];

export default {
	name: "Bocado",
	kind: "Food delivery",
	tagline: "Your city, one bite away.",
	artDirection: "Berry red on cream, rounded type, drawn food.",
	description:
		"Bocado, an invented food delivery app: restaurants by cuisine and delivery time, search with filters, menus with options, a cart, checkout and live order tracking on a drawn map.",
	theme: { brand: BRAND, neutral: NEUTRAL, tokens: TOKENS },
	thumbnail: () => <BocadoThumbnail />,
	screens: SCREENS,
	cookies: [],
	csp: { connectSrc: [MAP_HOST], imgSrc: [MAP_HOST, "blob:"], workerSrc: ["blob:"] },
	isPersonal,
	toasts: TOASTS,
	stream: (part, request) => trackingStream(part, request),
	render(request) {
		let screen = route(request, Date.now());
		return {
			title: screen.title,
			status: screen.status,
			body: (
				<>
					<LoadingBar />
					<MainFrame src={mainSource(request.url)} />
					<MainFrameSync root={href()} />
				</>
			),
		};
	},
	target(name, request) {
		if (name !== MAIN_FRAME) return null;
		let now = Date.now();
		let screen = route(request, now);
		let key = request.url.searchParams.get(DEMO_APP_TOAST_PARAM);
		let clean = new URL(mainSource(request.url), request.url);
		return (
			<MainScreen
				title={screen.title}
				nav={screen.current}
				url={request.url}
				toast={
					key !== null && Object.hasOwn(TOASTS, key.split(".")[0] ?? "")
						? TOASTS[key.split(".")[0]!]
						: undefined
				}
			>
				<BocadoShell
					visitor={readVisitor(request.cookie, now)}
					current={screen.current}
					back={`${request.page}${clean.search}`}
				>
					{screen.content}
				</BocadoShell>
			</MainScreen>
		);
	},
	submit(page, form, request) {
		let cookie = request.cookie;
		if (page === "reset") return { page: "", toast: "reset", cookies: resetCookies(cookie) };
		if (page === "address") {
			let parsed = s.parseSafe(ADDRESS_FORM, form);
			let address = parsed.success ? findAddress(parsed.value.address) : undefined;
			if (!parsed.success || address === undefined) return null;
			return {
				page: returnPage(parsed.value.back, ""),
				toast: "address",
				cookies: [addressCookie(address)],
			};
		}
		if (page === "cart/add") return addToCart(form, cookie);
		if (page === "cart/line") return changeLine(form, cookie);
		if (page === "cart/clear") {
			let cart = readVisitor(cookie).cart;
			let back = returnPage(form.get("back"), "cart");
			return cart === undefined
				? { page: back }
				: { page: back, toast: "cleared", cookies: [cartCookie(cart.restaurant, [])] };
		}
		if (page === "checkout") return placeOrder(form, cookie);
		let [first, id, action, extra] = page.split("/");
		if (first === "orders" && action === "reorder" && extra === undefined && id !== undefined) {
			let order = readVisitor(cookie).orders.find((entry) => entry.id === id);
			let restaurant = order === undefined ? undefined : findRestaurant(order.restaurant);
			if (order === undefined || restaurant === undefined) return null;
			return { page: "cart", toast: "reordered", cookies: [cartCookie(restaurant, order.lines)] };
		}
		return null;
	},
} satisfies DemoApp;

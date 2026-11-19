/**
 * Hangwell, an invented poster studio's shop: posters by eight invented artists sold as a print
 * file, a print or a framed print; collections filtered with facet counts, product pages with
 * variant pickers, a bag, a checkout that adapts to what ships, orders with downloads and
 * tracking, returns and an account. Everything is server-rendered and works without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { LinkButton } from "@sdxc/ui/link-button";
import { generateUUID } from "@sdxc/uuid/v4";
import { generateUUID as generateRecordId } from "@sdxc/uuid/v7";
import { renderToString } from "remix/component/server";

import type {
	DemoApp,
	DemoAppRedirect,
	DemoAppRequest,
	DemoAppScreen,
} from "~/resources/views/demo-apps";

import { DEMO_APP_TOAST_PARAM } from "~/resources/views/demo-apps";
import {
	MAIN_FRAME,
	MainFrame,
	MainScreen,
	mainSource,
} from "~/resources/views/demo-apps/main-frame";
import { MainFrameSync } from "~/resources/views/demo-apps/main-frame-sync";

import type { AccountTab } from "./account";
import type { Step, StepErrors } from "./checkout";
import type { Address, Format, Variant } from "./data";
import type { Destination } from "./shell";
import type { CheckoutDraft, Order, Visitor } from "./state";

import AccountPage from "./account";
import { PosterArt, printFile } from "./art";
import {
	ArtistPage,
	ArtistsPage,
	FramesPage,
	ReviewForm,
	SearchPage,
	ShippingHelp,
} from "./browse";
import { findCollection, readShopQuery } from "./catalog";
import { CartPage, CheckoutPage, stepPage, stepsFor } from "./checkout";
import {
	COUNTRIES,
	POSTERS,
	findArtist,
	findPayment,
	findPoster,
	findShipping,
	href,
} from "./data";
import Home from "./home";
import {
	OrderPage,
	RETURN_REASONS,
	ReturnLabel,
	ReturnPage,
	TrackPage,
	isDelivered,
	pickupDays,
} from "./orders";
import { Gutter } from "./parts";
import ProductPage, { BUY_FRAME, BuyBox, REVIEWS_FRAME, Reviews, readVariant } from "./product";
import HangwellShell, { LoadingBar } from "./shell";
import ShopPage from "./shop";
import {
	EMPTY_DRAFT,
	MAX_QTY,
	addLine,
	addressesCookie,
	cartCookie,
	checkPromo,
	draftCookie,
	isPersonal,
	isPhysical,
	ordersCookie,
	priceCart,
	promoCookie,
	readVisitor,
	resetCookies,
	returnsCookie,
	unavailableLine,
	validVariant,
	wishCookie,
} from "./state";
import { HangwellThumbnail } from "./thumbnail";

/** Vermilion at hue 30: an ink on a gallery wall, the one colour the chrome keeps. */
const BRAND = [
	"oklch(0.97 0.015 32)",
	"oklch(0.93 0.04 32)",
	"oklch(0.87 0.08 32)",
	"oklch(0.79 0.13 32)",
	"oklch(0.7 0.17 32)",
	"oklch(0.62 0.2 32)",
	"oklch(0.55 0.19 32)",
	"oklch(0.47 0.16 32)",
	"oklch(0.39 0.13 32)",
	"oklch(0.31 0.1 32)",
	"oklch(0.22 0.07 32)",
] as const;

/** Gallery-white neutrals with the faintest warmth, deepening to soft black. */
const NEUTRAL = [
	"oklch(0.99 0.003 85)",
	"oklch(0.97 0.004 85)",
	"oklch(0.925 0.006 80)",
	"oklch(0.87 0.008 75)",
	"oklch(0.72 0.01 70)",
	"oklch(0.57 0.01 65)",
	"oklch(0.45 0.01 60)",
	"oklch(0.36 0.008 60)",
	"oklch(0.27 0.006 60)",
	"oklch(0.2 0.005 60)",
	"oklch(0.15 0.004 60)",
] as const;

/** A neo-grotesk, small radii and squared-off pill buttons, so the art carries the colour. */
const TOKENS = {
	"--ui-font-sans":
		"'Helvetica Neue', 'Inter', 'Segoe UI Variable Text', 'Segoe UI', system-ui, -apple-system, sans-serif",
	"--ui-radius-sm": "0.25rem",
	"--ui-radius-md": "0.375rem",
	"--ui-radius-lg": "0.625rem",
	"--ui-cta-radius": "999px",
	"--ui-rating-color": "oklch(0.25 0.01 60)",
} as const;

/** The pages a post may return to, so a post can never send the visitor elsewhere. */
const RETURN_PAGES =
	/^(|cart|shop(\/[a-z-]+)?|search|artists(\/[a-z-]+)?|account(\/[a-z]+)?|p\/[a-z0-9-]+)(\?[\w=&%.+~-]*)?$/;

/** Every toast a Hangwell redirect can name. */
const TOASTS: DemoApp["toasts"] = {
	added: { color: "success", title: "Added to your bag" },
	updated: { color: "neutral", title: "Bag updated" },
	removed: { color: "neutral", title: "Removed from your bag" },
	"saved-later": { color: "neutral", title: "Moved to your wishlist" },
	"sold-out": {
		color: "warning",
		title: "That one just sold out",
		description: "Pick another size or frame.",
	},
	promo: { color: "success", title: "Promo code applied" },
	"promo-removed": { color: "neutral", title: "Promo code removed" },
	saved: { color: "success", title: "Saved to your wishlist" },
	unsaved: { color: "neutral", title: "Removed from your wishlist" },
	subscribed: {
		color: "success",
		title: "You're on the list",
		description: "One email a month, when new posters land.",
	},
	notify: {
		color: "success",
		title: "We'll email you",
		description: "As soon as it's framed again.",
	},
	asked: {
		color: "success",
		title: "Question sent",
		description: "The studio answers within a working day.",
	},
	helpful: { color: "neutral", title: "Thanks for the feedback" },
	reviewed: {
		color: "success",
		title: "Review sent",
		description: "It appears once the studio has read it.",
	},
	placed: {
		color: "success",
		title: "Order placed",
		description: "Nothing was charged: this is a demo.",
	},
	"empty-bag": { color: "warning", title: "Your bag is empty" },
	reordered: { color: "success", title: "Added to your bag again" },
	"return-started": {
		color: "success",
		title: "Return started",
		description: "Show the code at a parcel point.",
	},
	"address-added": { color: "success", title: "Address added" },
	"address-saved": { color: "success", title: "Address saved" },
	"address-default": { color: "neutral", title: "Default address changed" },
	"address-deleted": { color: "neutral", title: "Address deleted" },
	reset: {
		color: "neutral",
		title: "Demo reset",
		description: "Bag, orders, addresses and wishlist are back to how they started.",
	},
};

/** One Hangwell screen: its title and status, what it marks current, and its content. */
interface HangwellScreen {
	title: string;
	status?: number;
	current: Destination;
	content: RemixNode;
	/** What the buy and reviews frames hold, on a product page. */
	frames?: Record<string, RemixNode>;
}

/** The app's own 404. */
function NotFound() {
	return () => {
		let poster = findPoster("small-bear")!;
		return (
			<Gutter narrow>
				<div
					mix={[
						raw({
							display: "grid",
							justifyItems: "center",
							gap: "1rem",
							paddingBlock: "4rem",
							textAlign: "center",
						}),
					]}
				>
					<span mix={[raw({ inlineSize: "8rem" })]}>
						<PosterArt poster={poster} />
					</span>
					<h1 mix={[raw({ margin: "0", fontSize: "1.75rem", fontWeight: "500" })]}>
						This wall is empty
					</h1>
					<p mix={[raw({ margin: "0", color: "var(--ui-neutral-fg-muted)" })]}>
						The page may have moved, or the address has a typo.
					</p>
					<LinkButton href={href("shop")} color="brand">
						Browse posters
					</LinkButton>
				</div>
			</Gutter>
		);
	};
}

/** The 404 screen. */
function notFound(): HangwellScreen {
	return { title: "Not found", status: 404, current: "none", content: <NotFound /> };
}

/** The step checkout should open on: the first one whose fields aren't filled yet. */
function firstOpenStep(visitor: Visitor): Step {
	let draft = visitor.draft;
	let ships = visitor.lines.some(isPhysical);
	if (
		draft.email === "" ||
		(ships &&
			(draft.name === "" || draft.line1 === "" || draft.city === "" || draft.postcode === ""))
	)
		return "information";
	return "payment";
}

/** The page path without the one-time toast, which the shell's forms return to. */
function backOf(request: DemoAppRequest): string {
	let clean = new URL(mainSource(request.url), request.url);
	return `${request.page}${clean.search}`;
}

/** Routes an `account/...` path. */
function accountScreen(
	parts: string[],
	request: DemoAppRequest,
	visitor: Visitor,
	now: number,
): HangwellScreen {
	let [, second, third, fourth, extra] = parts;
	if (extra !== undefined) return notFound();
	if (second === "orders" && third !== undefined && fourth === "return") {
		let order = visitor.orders.find((entry) => entry.id === third);
		if (order === undefined || !isDelivered(order, now) || !order.lines.some(isPhysical))
			return notFound();
		return {
			title: `Return from ${order.number}`,
			current: "account",
			content: <ReturnPage order={order} url={request.url} now={now} />,
		};
	}
	if (second === "returns" && third !== undefined && fourth === undefined) {
		let entry = visitor.returns.find((item) => item.id === third);
		let order = visitor.orders.find((item) => item.id === entry?.order);
		if (entry === undefined || order === undefined) return notFound();
		return {
			title: `Return ${entry.id}`,
			current: "account",
			content: <ReturnLabel entry={entry} order={order} />,
		};
	}
	if (third !== undefined) return notFound();
	let tab: AccountTab | undefined =
		second === undefined
			? "overview"
			: (["orders", "library", "addresses", "wishlist"] as const).find((id) => id === second);
	if (tab === undefined) return notFound();
	let edit = request.url.searchParams.get("edit") ?? undefined;
	let titles: Record<AccountTab, string> = {
		overview: "Account",
		orders: "Orders",
		library: "Library",
		addresses: "Addresses",
		wishlist: "Wishlist",
	};
	return {
		title: titles[tab],
		current: "account",
		content: <AccountPage tab={tab} visitor={visitor} now={now} editing={edit} />,
	};
}

/** Picks the screen a page path names; a path Hangwell lacks gets its own 404. */
function route(request: DemoAppRequest, now: number): HangwellScreen {
	let visitor = readVisitor(request.cookie, now);
	let parts = request.page.split("/");
	let [first = "", second, third, extra] = parts;
	let back = backOf(request);
	if (first === "account") return accountScreen(parts, request, visitor, now);
	if (extra !== undefined) return notFound();
	if (first === "")
		return {
			title: "Posters, prints and frames",
			current: "home",
			content: <Home visitor={visitor} />,
		};
	if (first === "shop" && third === undefined) {
		let collection = second === undefined ? null : (findCollection(second) ?? undefined);
		if (collection === undefined) return notFound();
		let query = readShopQuery(collection, request.url.searchParams);
		return {
			title: collection?.name ?? "All posters",
			current: "shop",
			content: <ShopPage query={query} url={request.url} visitor={visitor} back={back} />,
		};
	}
	if (first === "p" && second !== undefined) {
		let poster = findPoster(second);
		if (poster === undefined) return notFound();
		if (third === "review")
			return {
				title: `Review ${poster.title}`,
				current: "shop",
				content: <ReviewForm poster={poster} />,
			};
		if (third !== undefined) return notFound();
		let variant = readVariant(request.url.searchParams);
		let image = request.url.searchParams.get("image");
		return {
			title: poster.title,
			current: "shop",
			content: <ProductPage poster={poster} url={request.url} visitor={visitor} back={back} />,
			frames: {
				[BUY_FRAME]: (
					<BuyBox
						poster={poster}
						variant={variant}
						image={image}
						visitor={visitor}
						now={now}
						back={back}
					/>
				),
				[REVIEWS_FRAME]: <Reviews poster={poster} url={request.url} />,
			},
		};
	}
	if (third !== undefined) return notFound();
	if (first === "artists") {
		if (second === undefined)
			return { title: "Artists", current: "artists", content: <ArtistsPage /> };
		let artist = findArtist(second);
		return artist === undefined
			? notFound()
			: {
					title: artist.name,
					current: "artists",
					content: <ArtistPage artist={artist} visitor={visitor} />,
				};
	}
	if (first === "orders" && second !== undefined) {
		let order = visitor.orders.find((entry) => entry.id === second);
		return order === undefined
			? notFound()
			: {
					title: `Order ${order.number}`,
					current: "account",
					content: <OrderPage order={order} visitor={visitor} now={now} />,
				};
	}
	if (first === "checkout") {
		if (visitor.lines.length === 0)
			return {
				title: "Your bag",
				current: "bag",
				content: <CartPage visitor={visitor} url={request.url} />,
			};
		let steps = stepsFor(visitor.lines);
		let asked: Step =
			second === undefined
				? "information"
				: (steps.find((step) => step === second) ?? "information");
		if (second !== undefined && !steps.includes(second as Step)) return notFound();
		let open = firstOpenStep(visitor);
		let step = asked !== "information" && open === "information" ? "information" : asked;
		return {
			title: "Checkout",
			current: "bag",
			content: <CheckoutPage visitor={visitor} step={step} />,
		};
	}
	if (second !== undefined) {
		if (first === "help" && second === "shipping")
			return { title: "Shipping", current: "none", content: <ShippingHelp /> };
		return notFound();
	}
	if (first === "frames")
		return {
			title: "Frames and sizes",
			current: "frames",
			content: <FramesPage url={request.url} />,
		};
	if (first === "search") {
		let query = request.url.searchParams.get("q") ?? "";
		return {
			title: query === "" ? "Search" : `Search: ${query}`,
			current: "shop",
			content: <SearchPage query={query} visitor={visitor} />,
		};
	}
	if (first === "cart")
		return {
			title: "Your bag",
			current: "bag",
			content: <CartPage visitor={visitor} url={request.url} />,
		};
	if (first === "track")
		return {
			title: "Track an order",
			current: "none",
			content: <TrackPage visitor={visitor} url={request.url} now={now} />,
		};
	return notFound();
}

/** The toast an address names, when it names one of Hangwell's. */
function toastOf(url: URL) {
	let key = url.searchParams.get(DEMO_APP_TOAST_PARAM)?.split(".")[0];
	return key !== undefined && Object.hasOwn(TOASTS, key) ? TOASTS[key] : undefined;
}

/** A screen inside the shell, as the main frame shows it. */
function inMain(request: DemoAppRequest, screen: HangwellScreen, now: number): RemixNode {
	let visitor = readVisitor(request.cookie, now);
	return (
		<MainScreen
			title={`${screen.title} · Hangwell`}
			nav={screen.current}
			url={request.url}
			toast={toastOf(request.url)}
		>
			<HangwellShell
				visitor={visitor}
				current={screen.current}
				back={backOf(request)}
				query={
					request.page === "search" ? (request.url.searchParams.get("q") ?? undefined) : undefined
				}
			>
				{screen.content}
			</HangwellShell>
		</MainScreen>
	);
}

/** A screen a post answers with, such as a form shown again with its errors, whole and in `main`. */
function answer(
	request: DemoAppRequest,
	page: string,
	content: RemixNode,
	title: string,
	current: Destination,
): DemoAppScreen {
	let url = new URL(href(page), request.url);
	let shown: DemoAppRequest = { ...request, page: page.split("?")[0] ?? "", url };
	let body = inMain(shown, { title, current, content }, Date.now());
	return { title, status: 400, body, frames: { [MAIN_FRAME]: body } };
}

/** A form field as trimmed text, `""` when missing or a file. */
function text(form: FormData, name: string, max = 200): string {
	let value = form.get(name);
	return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** The page a post returns to, or `fallback` for one that would leave Hangwell. */
function returnPage(form: FormData, fallback: string): string {
	let back = text(form, "back", 400);
	return RETURN_PAGES.test(back) ? back : fallback;
}

/** Adds a variant of a poster to the bag, refusing one that's sold out. */
function addToBag(form: FormData, visitor: Visitor): DemoAppRedirect | null {
	let poster = findPoster(text(form, "poster"));
	if (poster === undefined) return null;
	let format = text(form, "format") as Format;
	let variant: Variant = {
		format,
		size: format === "digital" ? null : text(form, "size") || null,
		frame: format === "framed" ? text(form, "frame") || null : null,
		mount: format === "framed" && text(form, "mount") === "1",
	};
	if (!["digital", "print", "framed"].includes(format) || !validVariant(variant)) return null;
	let back = returnPage(form, `p/${poster.id}`);
	let lines = addLine(visitor.lines, { poster: poster.id, variant, qty: 1 });
	if (unavailableLine(lines) !== undefined) return { page: back, toast: "sold-out" };
	return { page: back, toast: "added", cookies: [cartCookie(lines)] };
}

/** Changes a line's count; zero removes it. */
function changeLine(form: FormData, visitor: Visitor): DemoAppRedirect | null {
	let index = Number(text(form, "line"));
	let qty = Number(text(form, "qty"));
	let back = returnPage(form, "cart");
	if (!Number.isInteger(index) || visitor.lines[index] === undefined) return { page: back };
	if (!Number.isInteger(qty) || qty < 0 || qty > MAX_QTY) return null;
	let lines =
		qty === 0
			? visitor.lines.filter((_, at) => at !== index)
			: visitor.lines.map((line, at) => (at === index ? { ...line, qty } : line));
	return { page: back, toast: qty === 0 ? "removed" : "updated", cookies: [cartCookie(lines)] };
}

/** Whether an email looks deliverable enough for a demo receipt. */
function isEmail(value: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Checks the details step: an email, and a full address when something ships. */
function checkInformation(
	form: FormData,
	visitor: Visitor,
): { draft: CheckoutDraft; errors: Record<string, string> } {
	let draft: CheckoutDraft = {
		...visitor.draft,
		email: text(form, "email"),
		name: text(form, "name"),
		line1: text(form, "line1"),
		line2: text(form, "line2"),
		city: text(form, "city"),
		postcode: text(form, "postcode", 12),
		country: COUNTRIES.some((country) => country.id === text(form, "country"))
			? text(form, "country")
			: "PT",
	};
	let errors: Record<string, string> = {};
	if (!isEmail(draft.email)) errors.email = "Enter an email like maya@example.com.";
	if (visitor.lines.some(isPhysical)) {
		if (draft.name === "") errors.name = "Enter the name on the door.";
		if (draft.line1 === "") errors.line1 = "Enter a street and number.";
		if (draft.city === "") errors.city = "Enter a city.";
		if (!/^[A-Za-z0-9 -]{3,10}$/.test(draft.postcode))
			errors.postcode = "Enter a postcode like 4050-174.";
	}
	return { draft, errors };
}

/** Places the bag as an order, after checking it can still be made and paid for. */
function placeOrder(request: DemoAppRequest, visitor: Visitor): DemoAppRedirect | DemoAppScreen {
	if (visitor.lines.length === 0) return { page: "cart", toast: "empty-bag" };
	if (firstOpenStep(visitor) === "information") return { page: "checkout" };
	if (unavailableLine(visitor.lines) !== undefined) return { page: "cart", toast: "sold-out" };
	let id = generateRecordId();
	let order: Order = {
		id,
		number: `HW-${String(Number.parseInt(id.replace(/-/g, "").slice(-6), 16) % 100000).padStart(5, "0")}`,
		placedAt: Date.now(),
		lines: visitor.lines,
		promo: visitor.promo,
		draft:
			visitor.draft.shipping === "" ? { ...visitor.draft, shipping: "standard" } : visitor.draft,
	};
	return {
		page: `orders/${order.id}`,
		toast: "placed",
		cookies: [
			ordersCookie(request.cookie, order),
			cartCookie([]),
			promoCookie(""),
			draftCookie(null),
		],
	};
}

/** Why the demo gift card can't pay for an order, or `undefined` when it can. */
function giftError(code: string, total: number): string | undefined {
	if (code.toUpperCase() !== "HANG-GIFT-50")
		return "That isn't the demo gift card. Use HANG-GIFT-50.";
	return total > 5000
		? "The gift card holds €50.00, less than this order. Pick Demo card or Demo Pay."
		: undefined;
}

/** Answers a checkout step's post: saves what was typed and moves on, or shows the errors. */
function submitCheckout(
	step: string,
	form: FormData,
	request: DemoAppRequest,
	visitor: Visitor,
): DemoAppRedirect | DemoAppScreen | null {
	if (visitor.lines.length === 0) return { page: "cart", toast: "empty-bag" };
	let steps = stepsFor(visitor.lines);
	let next = (from: Step) => stepPage(steps[steps.indexOf(from) + 1] ?? "review");
	let fail = (current: Step, errors: StepErrors) =>
		answer(
			request,
			stepPage(current),
			<CheckoutPage visitor={visitor} step={current} errors={errors} />,
			"Checkout",
			"bag",
		);
	if (step === "information") {
		let { draft, errors } = checkInformation(form, visitor);
		if (Object.keys(errors).length > 0)
			return fail("information", { fields: errors, values: draft });
		return { page: next("information"), cookies: [draftCookie(draft)] };
	}
	if (step === "use-address") {
		let address = visitor.addresses.find((entry) => entry.id === text(form, "address"));
		if (address === undefined) return null;
		let draft = { ...visitor.draft, ...address, email: visitor.draft.email };
		return { page: "checkout", cookies: [draftCookie({ ...EMPTY_DRAFT, ...draft })] };
	}
	if (step === "express") {
		let home = visitor.addresses[0];
		let draft: CheckoutDraft = {
			...visitor.draft,
			email: visitor.draft.email || "maya@example.com",
			payment: "demo-wallet",
		};
		if (home !== undefined && visitor.draft.line1 === "")
			Object.assign(draft, {
				name: home.name,
				line1: home.line1,
				line2: home.line2,
				city: home.city,
				postcode: home.postcode,
				country: home.country,
			});
		return { page: "checkout/review", cookies: [draftCookie(draft)] };
	}
	if (step === "shipping") {
		let method = findShipping(text(form, "shipping"));
		if (method === undefined) return null;
		return {
			page: next("shipping"),
			cookies: [draftCookie({ ...visitor.draft, shipping: method.id })],
		};
	}
	if (step === "payment") {
		let payment = findPayment(text(form, "payment"));
		if (payment === undefined) return null;
		let draft = {
			...visitor.draft,
			payment: payment.id,
			gift: text(form, "gift", 40),
			note: text(form, "note"),
		};
		if (payment.id === "gift") {
			let total = priceCart(visitor.lines, visitor.promo, draft.shipping).total;
			let error = giftError(draft.gift, total);
			if (error !== undefined) return fail("payment", { fields: { gift: error }, values: draft });
		}
		return { page: "checkout/review", cookies: [draftCookie(draft)] };
	}
	if (step === "place") return placeOrder(request, visitor);
	return null;
}

/** Answers an address post: add, edit, make default or delete. */
function submitAddress(
	parts: string[],
	form: FormData,
	request: DemoAppRequest,
	visitor: Visitor,
): DemoAppRedirect | DemoAppScreen | null {
	let [, , id, action, extra] = parts;
	if (id === undefined || extra !== undefined) return null;
	if (action === "delete")
		return {
			page: "account/addresses",
			toast: "address-deleted",
			cookies: [addressesCookie(visitor.addresses.filter((entry) => entry.id !== id))],
		};
	if (action === "default") {
		let chosen = visitor.addresses.find((entry) => entry.id === id);
		if (chosen === undefined) return null;
		return {
			page: "account/addresses",
			toast: "address-default",
			cookies: [addressesCookie([chosen, ...visitor.addresses.filter((entry) => entry.id !== id)])],
		};
	}
	if (action !== undefined) return null;
	let address: Address = {
		id: id === "new" ? generateUUID().slice(0, 8) : id,
		name: text(form, "name"),
		line1: text(form, "line1"),
		line2: text(form, "line2"),
		city: text(form, "city"),
		postcode: text(form, "postcode", 12),
		country: COUNTRIES.some((country) => country.id === text(form, "country"))
			? text(form, "country")
			: "PT",
	};
	let fields: Record<string, string> = {};
	if (address.name === "") fields.name = "Enter a name.";
	if (address.line1 === "") fields.line1 = "Enter a street and number.";
	if (address.city === "") fields.city = "Enter a city.";
	if (!/^[A-Za-z0-9 -]{3,10}$/.test(address.postcode))
		fields.postcode = "Enter a postcode like 4050-174.";
	if (Object.keys(fields).length > 0) {
		return answer(
			request,
			`account/addresses?edit=${id}`,
			<AccountPage
				tab="addresses"
				visitor={visitor}
				now={Date.now()}
				editing={id}
				addressErrors={{ fields, values: address }}
			/>,
			"Addresses",
			"account",
		);
	}
	if (id === "new") {
		if (visitor.addresses.length >= 4) return { page: "account/addresses" };
		return {
			page: "account/addresses",
			toast: "address-added",
			cookies: [addressesCookie([...visitor.addresses, address])],
		};
	}
	if (!visitor.addresses.some((entry) => entry.id === id)) return null;
	return {
		page: "account/addresses",
		toast: "address-saved",
		cookies: [
			addressesCookie(visitor.addresses.map((entry) => (entry.id === id ? address : entry))),
		],
	};
}

/** What a return form is missing, or `undefined` when it is complete. */
function returnError(lines: number[], reason: string, missingDay: boolean): string | undefined {
	if (lines.length === 0) return "Choose at least one print or frame to send back.";
	if (!RETURN_REASONS.some((entry) => entry.id === reason))
		return "Choose a reason, so the studio knows what to fix.";
	return missingDay ? "Choose a day for the courier." : undefined;
}

/** Starts a return for the chosen physical lines of a delivered order. */
function submitReturn(
	orderId: string,
	form: FormData,
	request: DemoAppRequest,
	visitor: Visitor,
): DemoAppRedirect | DemoAppScreen | null {
	let order = visitor.orders.find((entry) => entry.id === orderId);
	let now = Date.now();
	if (order === undefined || !isDelivered(order, now)) return null;
	let lines = form
		.getAll("line")
		.map((value) => Number(value))
		.filter((index) => order!.lines[index] !== undefined && isPhysical(order!.lines[index]!));
	let reason = text(form, "reason");
	let method = text(form, "method") === "pickup" ? "pickup" : "dropoff";
	let day = text(form, "day");
	let params = new URLSearchParams();
	for (let index of lines) params.append("line", String(index));
	params.set("reason", reason);
	params.set("method", method);
	if (day !== "") params.set("day", day);
	let page = `account/orders/${order.id}/return?${params}`;
	let error = returnError(lines, reason, method === "pickup" && !pickupDays(now).includes(day));
	if (error !== undefined) {
		let shown = new URL(href(page), request.url);
		return answer(
			request,
			page,
			<ReturnPage order={order} url={shown} now={now} error={error} />,
			"Start a return",
			"account",
		);
	}
	let entry = {
		id: `RT-${generateUUID().slice(0, 6).toUpperCase()}`,
		order: order.id,
		lines,
		reason,
		method: method as "pickup" | "dropoff",
		day: method === "pickup" ? day : "",
		startedAt: now,
	};
	return {
		page: `account/returns/${entry.id}`,
		toast: "return-started",
		cookies: [returnsCookie(request.cookie, entry)],
	};
}

/** Answers a product page's posts: notify, ask, helpful and the review form. */
function submitProduct(
	posterId: string,
	action: string,
	form: FormData,
	request: DemoAppRequest,
): DemoAppRedirect | DemoAppScreen | null {
	let poster = findPoster(posterId);
	if (poster === undefined) return null;
	let back = returnPage(form, `p/${poster.id}`);
	if (action === "notify")
		return isEmail(text(form, "email")) ? { page: back, toast: "notify" } : { page: back };
	if (action === "ask")
		return text(form, "question").length >= 10
			? { page: `p/${poster.id}`, hash: "questions", toast: "asked" }
			: { page: `p/${poster.id}`, hash: "questions" };
	if (action === "helpful") return { page: back, hash: "reviews", toast: "helpful" };
	if (action === "review") {
		let values = {
			rating: text(form, "rating"),
			title: text(form, "title", 80),
			body: text(form, "body", 2000),
			name: text(form, "name", 40),
		};
		let errors: Record<string, string> = {};
		if (!["1", "2", "3", "4", "5"].includes(values.rating))
			errors.rating = "Choose from one to five stars.";
		if (values.body.length < 20)
			errors.body = "Write at least 20 characters, so others learn something.";
		if (values.name === "") errors.name = "Enter the name to show.";
		if (Object.keys(errors).length > 0)
			return answer(
				request,
				`p/${poster.id}/review`,
				<ReviewForm poster={poster} errors={errors} values={values} />,
				`Review ${poster.title}`,
				"shop",
			);
		return { page: `p/${poster.id}`, hash: "reviews", toast: "reviewed" };
	}
	return null;
}

/** Every screen a visitor reaches by clicking, so a test can walk them all. */
const SCREENS = [
	"",
	"shop",
	"shop/geometric",
	"shop/kitchen",
	"shop?color=ochre&color=teal&sort=price-asc",
	"shop?price_min=25&ready=1",
	"shop?sale=1",
	"shop?artist=zz",
	"shop?style=travel&color=rose&orientation=landscape",
	...POSTERS.slice(0, 6).map((poster) => `p/${poster.id}`),
	"p/ninefold-sun?format=print&size=a3",
	"p/ninefold-sun?format=digital",
	"p/port-anselm?format=framed&size=70x100&frame=walnut&mount=1&image=room",
	"p/fern-study?stars=4&review_sort=helpful",
	"p/fern-study/review",
	"artists",
	"artists/hana-ishikura",
	"frames",
	"search",
	"search?q=moon",
	"search?q=botanicl",
	"cart",
	"checkout",
	"track",
	"track?order=HW-40312&email=maya@example.com",
	"help/shipping",
	"account",
	"account/orders",
	"account/library",
	"account/addresses",
	"account/addresses?edit=new",
	"account/wishlist",
	"orders/0190a1b2-0000-7000-8000-000000000101",
	"orders/0190a1b2-0000-7000-8000-000000000102",
	"account/orders/0190a1b2-0000-7000-8000-000000000101/return",
];

export default {
	name: "Hangwell",
	kind: "Online store",
	tagline: "Art worth a nail in the wall.",
	artDirection: "Gallery white, soft black, one vermilion ink; posters drawn from code.",
	description:
		"Hangwell, an invented poster shop: collections with facet filters, product pages with format, size and frame pickers and a room preview, a bag, a checkout that adapts to print files, order tracking, downloads and returns.",
	theme: { brand: BRAND, neutral: NEUTRAL, tokens: TOKENS },
	thumbnail: () => <HangwellThumbnail />,
	screens: SCREENS,
	cookies: [],
	isPersonal,
	toasts: TOASTS,
	async file(part, request) {
		let [kind, orderId, name, extra] = part.split("/");
		if (
			kind !== "orders" ||
			orderId === undefined ||
			name === undefined ||
			extra !== undefined ||
			!name.endsWith(".svg")
		)
			return null;
		let visitor = readVisitor(request.cookie);
		let order = visitor.orders.find((entry) => entry.id === orderId);
		let poster = findPoster(name.slice(0, -4));
		if (order === undefined || poster === undefined) return null;
		if (!order.lines.some((line) => line.poster === poster.id && !isPhysical(line))) return null;
		let svg = await printFile(poster, (node) => renderToString(node));
		return new Response(svg, {
			headers: {
				"Content-Type": "image/svg+xml; charset=utf-8",
				"Content-Disposition": `attachment; filename="${poster.id}.svg"`,
				"Cache-Control": "private, no-store",
			},
		});
	},
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
		let now = Date.now();
		let screen = route(request, now);
		if (name === MAIN_FRAME) return inMain(request, screen, now);
		return screen.frames?.[name] ?? null;
	},
	submit(page, form, request) {
		let visitor = readVisitor(request.cookie);
		let parts = page.split("/");
		let [first, second, third, fourth, extra] = parts;
		if (page === "reset")
			return { page: "", toast: "reset", cookies: resetCookies(request.cookie) };
		if (page === "newsletter")
			return isEmail(text(form, "email")) ? { page: "", toast: "subscribed" } : { page: "" };
		if (page === "wishlist") {
			let poster = findPoster(text(form, "poster"));
			if (poster === undefined) return null;
			let saved = visitor.wish.includes(poster.id);
			let wish = saved
				? visitor.wish.filter((id) => id !== poster.id)
				: [poster.id, ...visitor.wish];
			return {
				page: returnPage(form, ""),
				toast: saved ? "unsaved" : "saved",
				cookies: [wishCookie(wish)],
			};
		}
		if (page === "cart/add") return addToBag(form, visitor);
		if (page === "cart/line") return changeLine(form, visitor);
		if (page === "cart/save") {
			let index = Number(text(form, "line"));
			let line = visitor.lines[index];
			if (line === undefined) return { page: "cart" };
			let wish = visitor.wish.includes(line.poster) ? visitor.wish : [line.poster, ...visitor.wish];
			return {
				page: "cart",
				toast: "saved-later",
				cookies: [cartCookie(visitor.lines.filter((_, at) => at !== index)), wishCookie(wish)],
			};
		}
		if (page === "cart/promo") {
			let code = text(form, "code", 40);
			let check = checkPromo(code, visitor.lines);
			if (!check.ok)
				return answer(
					request,
					"cart",
					<CartPage
						visitor={visitor}
						url={new URL(href("cart"), request.url)}
						promoError={{ code, message: check.message }}
					/>,
					"Your bag",
					"bag",
				);
			return {
				page: returnPage(form, "cart"),
				toast: "promo",
				cookies: [promoCookie(check.promo.code)],
			};
		}
		if (page === "cart/promo/remove")
			return { page: returnPage(form, "cart"), toast: "promo-removed", cookies: [promoCookie("")] };
		if (first === "checkout" && second !== undefined && third === undefined)
			return submitCheckout(second, form, request, visitor);
		if (first === "orders" && third === "reorder" && fourth === undefined) {
			let order = visitor.orders.find((entry) => entry.id === second);
			if (order === undefined) return null;
			let lines = order.lines.reduce((all, line) => addLine(all, line), visitor.lines);
			return { page: "cart", toast: "reordered", cookies: [cartCookie(lines)] };
		}
		if (first === "p" && second !== undefined && third !== undefined && fourth === undefined)
			return submitProduct(second, third, form, request);
		if (first === "account" && second === "addresses")
			return submitAddress(parts, form, request, visitor);
		if (
			first === "account" &&
			second === "orders" &&
			third !== undefined &&
			fourth === "return" &&
			extra === undefined
		)
			return submitReturn(third, form, request, visitor);
		return null;
	},
} satisfies DemoApp;

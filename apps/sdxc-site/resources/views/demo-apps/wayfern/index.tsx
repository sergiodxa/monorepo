/**
 * Wayfern, an invented travel app: stays, flights, cars and packages from one search, results on
 * a real map of an invented coast, checkout with fake saved cards, and one itinerary of trips
 * that exports to calendars. Fern green on warm sand; every picture is drawn, trips live in cookies.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";

import type { DemoApp, DemoAppRequest, DemoAppScreen } from "~/resources/views/demo-apps";

import { DEMO_APP_TOAST_PARAM } from "~/resources/views/demo-apps";
import {
	MAIN_FRAME,
	MainFrame,
	MainScreen,
	mainSource,
} from "~/resources/views/demo-apps/main-frame";
import { MainFrameSync } from "~/resources/views/demo-apps/main-frame-sync";

import type { CheckoutDraft } from "./checkout";
import type { Screen } from "./screen";
import type { Destination } from "./shell";
import type { Trip } from "./state";

import { bookCar, bookFlights, bookPackage, icsFile } from "./bookings";
import CarsPage, { CarCheckout, offerFor } from "./cars-view";
import Checkout from "./checkout";
import { STAYS, actionHref, findCard, findPlace, findStay, href } from "./data";
import { today as todayKey } from "./days";
import { addDays as plusDays, today as todayOf } from "./days";
import FlightsPage, { FareCalendarPage, FaresPage, SeatsPage } from "./flights-view";
import Home from "./home";
import { itemsOf } from "./itinerary";
import PackagesPage, { PackagePage, dealFor, originOf } from "./packages-view";
import { Page, Title } from "./parts";
import { checkRequest } from "./pricing";
import { readSearch } from "./query";
import Results from "./results";
import { SearchPill, SearchSheet } from "./search";
import WayfernShell, { LoadingBar } from "./shell";
import {
	heldNights,
	isPersonal,
	readTraveller,
	resetCookies,
	savedCookie,
	tripCode,
	tripsCookie,
} from "./state";
import StayPage from "./stay";
import { WayfernThumbnail } from "./thumbnail";
import Trips, { TripPage } from "./trips";
import Wishlists, { WishlistPage, wishlists } from "./wishlists";

/** Fern green at hue 155: a leaf in shade, calm enough for a whole interface. */
const BRAND = [
	"oklch(0.975 0.018 150)",
	"oklch(0.945 0.038 151)",
	"oklch(0.895 0.066 152)",
	"oklch(0.815 0.094 153)",
	"oklch(0.705 0.115 154)",
	"oklch(0.6 0.118 155)",
	"oklch(0.5 0.105 156)",
	"oklch(0.42 0.088 157)",
	"oklch(0.345 0.07 158)",
	"oklch(0.275 0.052 158)",
	"oklch(0.195 0.035 160)",
] as const;

/** Warm sand neutrals, so white space reads like paper in the sun. */
const NEUTRAL = [
	"oklch(0.988 0.005 85)",
	"oklch(0.966 0.009 85)",
	"oklch(0.922 0.012 83)",
	"oklch(0.862 0.015 80)",
	"oklch(0.72 0.018 78)",
	"oklch(0.582 0.018 75)",
	"oklch(0.47 0.016 72)",
	"oklch(0.38 0.014 70)",
	"oklch(0.29 0.012 68)",
	"oklch(0.21 0.01 66)",
	"oklch(0.152 0.008 65)",
] as const;

/** A rounded sans for the interface, a soft serif for places, 12px cards and a coral heart. */
const TOKENS = {
	"--ui-font-sans":
		"ui-rounded, 'SF Pro Rounded', 'Nunito', 'Segoe UI Variable Text', 'Segoe UI', system-ui, -apple-system, sans-serif",
	"--ui-font-serif":
		"'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif",
	"--ui-radius-sm": "0.375rem",
	"--ui-radius-md": "0.5rem",
	"--ui-radius-lg": "0.75rem",
	"--wf-heart": "oklch(0.64 0.17 32)",
} as const;

/** The pages a save or cancel may return to, so a post can never send the visitor elsewhere. */
const RETURN_PAGES =
	/^(|s|trips|wishlists|stay\/[a-z-]+|wishlists\/[a-z]+|trips\/WF-[A-Z0-9]{5})(\?[\w=&%.+-]*)?$/;

/** A heart post: where to return, and whether the stay goes on or comes off the list. */
const SAVE_FORM = f.object({
	back: f.field(s.defaulted(s.string(), "")),
	on: f.field(s.enum_(["true", "false"])),
});

/** A checkout post: the trip and the saved card it is paid with. */
const BOOK_FORM = f.object({
	checkin: f.field(s.string()),
	checkout: f.field(s.string()),
	adults: f.field(s.defaulted(s.string(), "2")),
	children: f.field(s.defaulted(s.string(), "0")),
	card: f.field(s.defaulted(s.string(), "")),
	message: f.field(s.defaulted(s.string(), "")),
});

/** Every toast a Wayfern redirect can name: saves with Undo, a booking, a cancel with Undo. */
const TOASTS: DemoApp["toasts"] = Object.fromEntries([
	...STAYS.flatMap((stay) => [
		[
			`saved-${stay.id}`,
			{
				color: "neutral",
				title: `Saved ${stay.name}`,
				action: {
					label: "Undo",
					form: {
						action: actionHref(`saved/${stay.id}`),
						fields: { on: "false", back: `stay/${stay.id}` },
					},
				},
			},
		],
		[
			`unsaved-${stay.id}`,
			{
				color: "neutral",
				title: `Removed ${stay.name} from Saved`,
				action: {
					label: "Undo",
					form: {
						action: actionHref(`saved/${stay.id}`),
						fields: { on: "true", back: `stay/${stay.id}` },
					},
				},
			},
		],
	]),
	[
		"booked",
		{
			color: "success",
			title: "Trip booked",
			description: "The confirmation is below. Nothing was charged.",
		},
	],
	[
		"cancelled",
		{
			color: "neutral",
			title: "Trip cancelled",
			action: { label: "Undo", form: { action: actionHref("trips/restore"), fields: {} } },
		},
	],
	["restored", { color: "neutral", title: "Trip restored" }],
	[
		"reset",
		{
			color: "neutral",
			title: "Demo reset",
			description: "Saved stays and trips are back to how they started.",
		},
	],
]);

/** One Wayfern screen: its title, status and destination, and the shell's search and width. */
interface WayfernScreen {
	title: string;
	status?: number;
	current: Destination;
	/** Shows the compact search pill in the top bar. */
	search?: boolean;
	/** Drops the footer for a screen that fills the window, such as results beside a map. */
	bleed?: boolean;
	content: RemixNode;
}

/** What every screen reads from a request. */
function screenOf(request: DemoAppRequest): Screen {
	let today = todayKey();
	let source = mainSource(request.url);
	let query = source.includes("?") ? source.slice(source.indexOf("?")) : "";
	return {
		today,
		traveller: readTraveller(request.cookie, today),
		url: request.url,
		page: request.page,
		back: `${request.page}${query}`,
		base: source,
	};
}

/** The app's own 404, inside its frame. */
function NotFound() {
	return () => (
		<Page narrow>
			<Title>This stay isn't on Wayfern</Title>
			<p mix={[raw({ margin: "1rem 0", color: "var(--ui-neutral-fg-muted)" })]}>
				It may have been taken off the site, or the address has a typo.
			</p>
			<a href={href()} mix={[raw({ fontWeight: "650", color: "var(--ui-brand-fg-emphasis)" })]}>
				Back to home
			</a>
		</Page>
	);
}

/** The screen for a page path, with the checkout draft a refused post re-renders. */
function route(request: DemoAppRequest, draft?: CheckoutDraft): WayfernScreen {
	let ctx = screenOf(request);
	let [first = "", second, extra] = request.page.split("/");
	let found: WayfernScreen | undefined;
	if (extra === undefined && second === undefined) {
		if (first === "")
			found = {
				title: "Stays along the Lowmere coast",
				current: "explore",
				content: <Home ctx={ctx} />,
			};
		if (first === "s") {
			let search = readSearch(request.url.searchParams);
			let place = search.place === undefined ? undefined : findPlace(search.place)?.name;
			found = {
				title: place === undefined ? "Stays" : `Stays in ${place}`,
				current: "explore",
				search: true,
				bleed: true,
				content: <Results ctx={ctx} />,
			};
		}
		if (first === "trips")
			found = { title: "Trips", current: "trips", content: <Trips ctx={ctx} /> };
		if (first === "flights")
			found = { title: "Flights", current: "explore", content: <FlightsPage ctx={ctx} /> };
		if (first === "cars")
			found = { title: "Car rental", current: "explore", content: <CarsPage ctx={ctx} /> };
		if (first === "packages")
			found = { title: "Packages", current: "explore", content: <PackagesPage ctx={ctx} /> };
		if (first === "wishlists")
			found = { title: "Wishlists", current: "wishlists", content: <Wishlists ctx={ctx} /> };
	} else if (extra === undefined && second !== undefined) {
		let stay = findStay(second);
		if (first === "stay" && stay !== undefined)
			found = {
				title: stay.name,
				current: "explore",
				search: true,
				content: <StayPage stay={stay} ctx={ctx} />,
			};
		if (first === "book" && stay !== undefined)
			found = {
				title: `Book ${stay.name}`,
				status: draft === undefined ? undefined : 400,
				current: "explore",
				content: <Checkout stay={stay} ctx={ctx} draft={draft} />,
			};
		if (first === "flights" && second === "calendar")
			found = {
				title: "Fare calendar",
				current: "explore",
				content: <FareCalendarPage ctx={ctx} />,
			};
		if (first === "flights" && second === "fares")
			found = { title: "Choose your fare", current: "explore", content: <FaresPage ctx={ctx} /> };
		if (first === "flights" && second === "seats")
			found = {
				title: "Seats and passengers",
				current: "explore",
				content: <SeatsPage ctx={ctx} />,
			};
		let offer = first === "cars" ? offerFor(second, request.url.searchParams) : undefined;
		if (offer !== undefined)
			found = {
				title: `${offer.car.name} from ${offer.company.name}`,
				current: "explore",
				content: <CarCheckout ctx={ctx} offer={offer} />,
			};
		let deal =
			first === "packages" && stay !== undefined
				? dealFor(
						stay,
						originOf(request.url.searchParams),
						readSearch(request.url.searchParams),
						ctx.today,
						heldNights(ctx.traveller, stay.id),
					)
				: undefined;
		if (deal !== undefined)
			found = {
				title: `${deal.stay.name} package`,
				current: "explore",
				content: <PackagePage ctx={ctx} deal={deal} />,
			};
		let trip = ctx.traveller.trips.find((entry) => entry.id === second);
		if (first === "trips" && trip !== undefined)
			found = {
				title: `Trip ${trip.id}`,
				current: "trips",
				content: <TripPage ctx={ctx} trip={trip} />,
			};
		let list = wishlists(ctx.traveller.saved).find((entry) => entry.id === second);
		if (first === "wishlists" && list !== undefined)
			found = {
				title: list.name,
				current: "wishlists",
				bleed: true,
				content: <WishlistPage ctx={ctx} list={list} />,
			};
	}
	return found ?? { title: "Not found", status: 404, current: "none", content: <NotFound /> };
}

/** The screen inside its shell, with the search sheet every screen can open. */
function Framed(handle: Handle<{ screen: WayfernScreen; request: DemoAppRequest }>) {
	return () => {
		let { request, screen } = handle.props;
		let ctx = screenOf(request);
		let search = readSearch(request.url.searchParams);
		return (
			<WayfernShell
				current={screen.current}
				bleed={screen.bleed}
				search={screen.search === true ? <SearchPill search={search} /> : undefined}
			>
				{screen.content}
				<SearchSheet search={search} today={ctx.today} base={ctx.base} />
			</WayfernShell>
		);
	};
}

/** The screen a post answers with, rendered whole and in `main`, for a checkout that can't book. */
function screenFor(request: DemoAppRequest, screen: WayfernScreen): DemoAppScreen {
	let body = (
		<MainScreen title={screen.title} nav={screen.current} url={request.url}>
			<Framed screen={screen} request={request} />
		</MainScreen>
	);
	return { title: screen.title, status: screen.status, body, frames: { [MAIN_FRAME]: body } };
}

/** A departure a month ahead, which the sample flight, car and package screens search for. */
const SAMPLE_DAY = plusDays(todayOf(), 30);

/** Every screen a visitor reaches by clicking, so a test can walk them all. */
const SCREENS = [
	"",
	"s",
	"s?where=merrow-bay",
	"s?where=tallow-pines&type=cabin",
	"s?amenity=hot-tub&min=150",
	"s?sort=price-low",
	"s?where=nowhere-at-all",
	"s?view=map",
	...STAYS.map((stay) => `stay/${stay.id}`),
	"stay/the-canopy?photo=2",
	"trips",
	"trips/WF-7M3QK",
	"trips/WF-2D9LX",
	"wishlists",
	"wishlists/saved",
	"wishlists/lakes",
	"wishlists/family",
	"flights",
	`flights?from=SRL&to=MRW&depart=${SAMPLE_DAY}&return=${plusDays(SAMPLE_DAY, 5)}`,
	`flights?trip=one&from=KSH&to=VLS&depart=${SAMPLE_DAY}&stops=0`,
	`flights/calendar?from=SRL&to=MRW&depart=${SAMPLE_DAY}&return=${plusDays(SAMPLE_DAY, 5)}`,
	"cars",
	`cars?pickup=MRW&pickupday=${SAMPLE_DAY}&dropoffday=${plusDays(SAMPLE_DAY, 4)}`,
	"packages",
	`packages?where=tallow-pines&checkin=${SAMPLE_DAY}&checkout=${plusDays(SAMPLE_DAY, 3)}`,
	"trips/WF-8F2TL",
	"trips/WF-3CRV9",
];

export default {
	name: "Wayfern",
	kind: "Travel booking",
	tagline: "Somewhere quieter, booked in a minute.",
	artDirection: "Fern green on warm sand, drawn landscapes.",
	description:
		"Wayfern, an invented travel app: stays, flights, cars and packages from one search, results on a real map, seat maps and boarding passes, and one itinerary of trips that exports to calendars.",
	theme: { brand: BRAND, neutral: NEUTRAL, tokens: TOKENS },
	thumbnail: () => <WayfernThumbnail />,
	screens: SCREENS,
	cookies: [],
	isPersonal,
	toasts: TOASTS,
	render(request) {
		let screen = route(request);
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
		let screen = route(request);
		let key = request.url.searchParams.get(DEMO_APP_TOAST_PARAM);
		return (
			<MainScreen
				title={screen.title}
				nav={screen.current}
				url={request.url}
				toast={key !== null && Object.hasOwn(TOASTS, key) ? TOASTS[key] : undefined}
			>
				<Framed screen={screen} request={request} />
			</MainScreen>
		);
	},
	submit(page, form, request) {
		let today = todayKey();
		let traveller = readTraveller(request.cookie, today);
		if (page === "reset")
			return { page: "", toast: "reset", cookies: resetCookies(request.cookie) };
		let [first, second, third, extra] = page.split("/");
		if (extra !== undefined || second === undefined) return null;
		if (first === "saved" && third === undefined) {
			let stay = findStay(second);
			let parsed = s.parseSafe(SAVE_FORM, form);
			if (stay === undefined || !parsed.success) return null;
			let save = parsed.value.on === "true";
			let back = RETURN_PAGES.test(parsed.value.back) ? parsed.value.back : `stay/${stay.id}`;
			return {
				page: back,
				toast: `${save ? "saved" : "unsaved"}-${stay.id}`,
				cookies: [savedCookie(traveller, stay.id, save)],
			};
		}
		if (first === "trips" && second === "restore" && third === undefined) {
			let now = Date.now();
			let cancelled = traveller.trips.find(
				(trip) => trip.status === "cancelled" && itemsOf(trip).some((item) => item.ends > now),
			);
			if (cancelled === undefined) return { page: "trips" };
			let trips = traveller.trips.map((trip) =>
				trip === cancelled ? { ...trip, status: "confirmed" as const } : trip,
			);
			return { page: `trips/${cancelled.id}`, toast: "restored", cookies: [tripsCookie(trips)] };
		}
		if (first === "trips" && third === "cancel") {
			let trip = traveller.trips.find((entry) => entry.id === second);
			if (trip === undefined) return null;
			let rest = traveller.trips.filter((entry) => entry !== trip);
			return {
				page: `trips/${trip.id}`,
				toast: "cancelled",
				cookies: [tripsCookie([{ ...trip, status: "cancelled" }, ...rest])],
			};
		}
		if (first === "book" && third === undefined) {
			let stay = findStay(second);
			let parsed = s.parseSafe(BOOK_FORM, form);
			if (stay === undefined || !parsed.success) return null;
			let fields = parsed.value;
			let params = new URLSearchParams({
				checkin: fields.checkin,
				checkout: fields.checkout,
				adults: fields.adults,
				children: fields.children,
			});
			let search = readSearch(params);
			let problems: CheckoutDraft["problems"] = checkRequest(
				stay,
				search,
				today,
				heldNights(traveller, stay.id),
			);
			if (findCard(fields.card) === undefined)
				problems.push({ kind: "card", message: "Choose a saved card to pay with." });
			if (problems.length > 0) {
				let url = new URL(request.url);
				url.search = `?${params}`;
				let retry = { ...request, page, url };
				return screenFor(
					retry,
					route(retry, { card: fields.card, message: fields.message, problems }),
				);
			}
			let trip: Trip = {
				kind: "stay",
				id: tripCode(Date.now() + traveller.trips.length * 7919),
				stay: stay.id,
				start: search.start!,
				end: search.end!,
				adults: search.adults,
				children: search.children,
				card: fields.card,
				status: "confirmed" as const,
			};
			return {
				page: `trips/${trip.id}`,
				toast: "booked",
				cookies: [tripsCookie([trip, ...traveller.trips])],
			};
		}
		if (first === "flights" && second === "book" && third === undefined)
			return bookFlights(form, request, traveller);
		if (first === "cars" && third === "book") return bookCar(second, form, traveller);
		if (first === "packages" && third === "book")
			return bookPackage(second, form, traveller, today);
		return null;
	},
	file(part, request) {
		let match = /^(journey|booking)\/(WF-[A-Z0-9]{5})\.ics$/.exec(part);
		return match === null
			? null
			: icsFile(match[1] as "journey" | "booking", match[2]!, request.cookie);
	},
} satisfies DemoApp;

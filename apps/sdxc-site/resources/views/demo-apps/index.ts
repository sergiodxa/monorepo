/**
 * The demo apps `/demo/apps/:app` serves, discovered from
 * `resources/views/demo-apps/<app>/index.tsx` and each loaded only when one of its own
 * screens is asked for, so a demo app never weighs on another request.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Toast } from "@sdxc/ui/app";
import type { RemixNode } from "remix/component";

import type { DemoPalette } from "~/resources/components/demo-theme";

import routes from "~/routes/web";

/** The query parameter a form's redirect carries, naming the toast the screen shows once. */
export const DEMO_APP_TOAST_PARAM = "toast";

/**
 * Splits a `toast` parameter into the app's toast key and the redirect's one-time suffix
 * (`archived-2041.9f3a1c2e`), so a reload of the same address keeps one toast id and shows
 * nothing new, while each post mints a new one.
 *
 * @param value The parameter as the address carries it.
 * @returns The key the app declares, and the id the toast takes on the page.
 */
export function readToastParam(value: string): { key: string; id: string } {
	let dot = value.lastIndexOf(".");
	let key = dot === -1 ? value : value.slice(0, dot);
	return { key, id: `demo-toast-${value}` };
}

/** What a screen reads from the request it renders for. */
export interface DemoAppRequest {
	/** The screen's path under the app, such as `services/checkout-api`; `""` on the home screen. */
	page: string;
	/** The whole address, for the filters, sort, density and selection a screen keeps in it. */
	url: URL;
	/** The request's `Cookie` header, for the sidebar and split widths the visitor left. */
	cookie: string | null;
}

/** One rendered screen: its document title and the app's whole frame around it. */
export interface DemoAppScreen {
	title: string;
	body: RemixNode;
	/** `404` for the app's own not-found screen. Default: `200`. */
	status?: number;
}

/** Where a form post sends the visitor, and which of the app's toasts greets them there. */
export interface DemoAppRedirect {
	/** A page path under the app, with its query string when it keeps one. */
	page: string;
	/** A key of the app's {@link DemoApp.toasts}. */
	toast?: string;
}

/** One demo app: its invented product, its art direction and every screen it answers. */
export interface DemoApp {
	/** The product's name, which the shell, the titles and the gallery card name. */
	name: string;
	/** Which kind of app the demo shows ("Ops dashboard"), for the gallery card. */
	kind: string;
	/** A few words on what the invented product is, for the gallery card. */
	tagline: string;
	/** A few words on the palette, type and shapes the app commits to, for the gallery card. */
	artDirection: string;
	/** One sentence for the meta description. */
	description: string;
	/** The palettes and tokens the whole app is themed with. */
	theme: DemoPalette;
	/** The app in miniature for the gallery card, drawn inside a stage themed by {@link theme}. */
	thumbnail: () => RemixNode;
	/**
	 * Every screen a visitor reaches by clicking, as page paths with their query strings, so
	 * a test can walk them all; `""` is the home screen.
	 */
	screens: string[];
	/**
	 * The cookies a screen reads, such as the sidebar's collapse state, so a cached copy is
	 * kept per combination of their values and never serves one visitor's layout to another.
	 */
	cookies: readonly string[];
	/** The toasts a redirect may name, keyed by what {@link DemoAppRedirect.toast} carries. */
	toasts: Record<string, Omit<Toast.Flash, "id">>;
	/**
	 * Renders one secondary part of a screen, the content of a {@link DemoAppFrame}: `part` is
	 * its path (`overview/stats`), and the request's address carries the screen state it needs
	 * as its query. `null` answers the frame route's `404`.
	 */
	frame?: (part: string, request: DemoAppRequest) => RemixNode | null | Promise<RemixNode | null>;
	/** Renders a screen, or the app's own 404 screen with `status: 404` for a path it lacks. */
	render: (request: DemoAppRequest) => DemoAppScreen | Promise<DemoAppScreen>;
	/**
	 * Answers a form post on `page`; a demo keeps nothing, so it picks where to go next, or
	 * answers a screen (a form re-rendered with what was typed and its issues, status `400`).
	 * `null` rejects the post as unreadable.
	 */
	submit: (
		page: string,
		form: FormData,
		request: DemoAppRequest,
	) => DemoAppRedirect | DemoAppScreen | null | Promise<DemoAppRedirect | DemoAppScreen | null>;
}

/** One demo app as a page linking to it lists it. */
export interface DemoAppSummary {
	slug: string;
	name: string;
	kind: string;
	description: string;
	tagline: string;
	artDirection: string;
}

/**
 * Every demo app folder's entry, keyed by its path relative to this file. A new demo is one
 * folder holding an `index.tsx`; its folder name is its slug.
 */
const APP_MODULES = import.meta.glob<DemoApp>("./*/index.tsx", { import: "default" });

/**
 * Loads the demo app a slug names.
 *
 * @param slug The `:app` the request carried.
 * @returns The app, or `null` for a slug no folder answers to.
 */
export async function findDemoApp(slug: string): Promise<DemoApp | null> {
	let key = `./${slug}/index.tsx`;
	if (!Object.hasOwn(APP_MODULES, key)) return null;
	return (await APP_MODULES[key]?.()) ?? null;
}

/**
 * The slugs `/demo/apps/:app` answers, in folder-name order.
 *
 * @returns One slug per demo app folder.
 */
export function listDemoAppSlugs(): string[] {
	return Object.keys(APP_MODULES)
		.map((key) => key.slice(2, -"/index.tsx".length))
		.sort();
}

/**
 * Every demo app with the name, kind and description its own module declares, so a page
 * linking to the demos lists a new one as soon as its folder exists.
 *
 * @returns One summary per demo app, in slug order.
 */
export async function listDemoApps(): Promise<DemoAppSummary[]> {
	let apps = await Promise.all(
		listDemoAppSlugs().map(async (slug) => {
			let app = await findDemoApp(slug);
			return app === null
				? null
				: {
						slug,
						name: app.name,
						kind: app.kind,
						description: app.description,
						tagline: app.tagline,
						artDirection: app.artDirection,
					};
		}),
	);
	return apps.filter((app): app is DemoAppSummary => app !== null);
}

/**
 * Builds the addresses of one demo app, so its nav, rows and forms name its screens by their
 * path under the app.
 *
 * @param slug The demo's folder name.
 * @returns A function from a page path (none for the home screen) to its address; a query
 *   string on the path is kept.
 * @example demoAppHref("pulse")("services?status=down") // "/demo/apps/pulse/services?status=down"
 */
export function demoAppHref(slug: string): (page?: string) => string {
	return (page) => {
		if (page === undefined || page === "") return routes.demoApps.show.href({ app: slug });
		let [path = "", query] = page.split("?", 2);
		let href =
			path === ""
				? routes.demoApps.show.href({ app: slug })
				: routes.demoApps.show.href({ app: slug, page: path });
		return query === undefined ? href : `${href}?${query}`;
	};
}

/**
 * Builds the addresses of one demo app's frames, so a screen names each part by its path
 * and passes the screen state the part needs as its query.
 *
 * @param slug The demo's folder name.
 * @returns A function from a part path, with its query string when it keeps one, to its address.
 * @example demoAppFrameHref("pulse")("overview/stats?range=7d") // "/demo/frames/apps/pulse/overview/stats?range=7d"
 */
export function demoAppFrameHref(slug: string): (part: string) => string {
	return (part) => {
		let [path = "", query] = part.split("?", 2);
		let href = routes.demoFrames.app.href({ app: slug, part: path });
		return query === undefined || query === "" ? href : `${href}?${query}`;
	};
}

/**
 * The address a screen's forms post to, which answers by redirecting back.
 *
 * @param slug The demo's folder name.
 * @returns A function from the page path the form acts on to the action's address.
 */
export function demoAppActionHref(slug: string): (page: string) => string {
	return (page) => routes.demoApps.action.href({ app: slug, page });
}

/**
 * Every demo app as a card linking to its home screen, headed by the kind of app it shows.
 *
 * @returns One card per demo app, in slug order.
 */
export async function demoAppLinks(): Promise<
	Array<{ href: string; title: string; description: string; eyebrow: string }>
> {
	return (await listDemoApps()).map((app) => ({
		href: demoAppHref(app.slug)(),
		title: app.name,
		description: app.description,
		eyebrow: app.kind,
	}));
}

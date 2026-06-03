import type { Handle, RemixNode, VirtualRoot, VirtualRootOptions } from "remix/ui";

import { createMultiMatcher, type MatchParams } from "remix/route-pattern/match";
import { Route, type RouteMap } from "remix/routes";
import { createElement } from "remix/ui";
import { createRoot as createRemixRoot } from "remix/ui";

const DEFAULT_BASE_URL = "http://localhost/";

/**
 * URL input accepted by matching, rendering, and navigation methods.
 */
export type RouterInput = string | URL | { url: string | URL };

/**
 * A single route value accepted by `router.map`.
 */
export type RouteTarget<pattern extends string = string> = string | Route<any, pattern>;

/**
 * Value that may be available immediately or after route data loading completes.
 */
export type Awaitable<value> = value | Promise<value>;

/**
 * Extracts the route-pattern source string from a route target.
 */
export type RoutePatternSource<route> =
	route extends Route<any, infer pattern extends string>
		? pattern
		: route extends string
			? route
			: never;

/**
 * Client-side route handler context passed to mapped view handlers.
 */
export interface Context<
	params extends Record<string, string | undefined> = Record<string, string | undefined>,
	route extends RouteTarget = RouteTarget,
> {
	/** Fully resolved URL for the current render. */
	url: URL;
	/** Decoded params from the matched route pattern. */
	params: params;
	/** The route target that produced this match. */
	route: route;
	/** Signal aborted when a mounted render is replaced or disposed. */
	signal: AbortSignal;
	/** Navigate to another URL and refresh mounted router roots. */
	navigate(to: RouterInput, options?: NavigateOptions): Promise<void>;
}

/**
 * Context passed to the default element when no route matches.
 */
export interface NotFoundContext {
	/** Fully resolved URL that failed to match a mapped route. */
	url: URL;
	/** Signal aborted when a mounted render is replaced or disposed. */
	signal: AbortSignal;
	/** Navigate to another URL and refresh mounted router roots. */
	navigate(to: RouterInput, options?: NavigateOptions): Promise<void>;
}

/**
 * Function that renders UI for a matched route.
 */
export interface ViewHandler<route extends RouteTarget = RouteTarget> {
	/**
	 * Render UI for the matched route.
	 *
	 * @param ctx Matched URL, params, route, signal, and navigation helpers.
	 * @returns Remix UI node to render for the current route.
	 */
	(ctx: Context<MatchParams<RoutePatternSource<route>>, route>): Awaitable<RemixNode>;
}

/**
 * Router and current match data provided through Remix UI context.
 */
export interface RouterProviderValue extends UIRouter {
	/** Route context used to render the current UI tree. */
	context: Context | NotFoundContext;
	/** Current route match, or `null` when rendering the default element. */
	match: RouteMatch | null;
	/** Fully resolved URL used for the current render. */
	url: URL;
	/** Current route params, or an empty object for default renders. */
	params: Record<string, string | undefined>;
	/** Current route target, or `undefined` for default renders. */
	route?: RouteTarget;
}

/**
 * Props accepted by the internal router provider component.
 */
export interface RouterProviderProps {
	/** Router and route context value exposed to descendant components. */
	value: RouterProviderValue;
	/** Route UI rendered under the provider. */
	children?: RemixNode;
}

/**
 * Controller object for direct leaf routes in a route map branch.
 */
export type UIController<routes extends RouteMap> = {
	[name in keyof routes as routes[name] extends Route<any, any>
		? name
		: never]: routes[name] extends Route<any, any> ? ViewHandler<routes[name]> : never;
};

/**
 * Defines a route view handler with params inferred from a route target.
 *
 * @param route Route target used only to infer handler context types.
 * @param handler View handler for the route target.
 * @returns The same handler function.
 */
export function createAction<route extends RouteTarget, handler extends ViewHandler<route>>(
	_route: route,
	handler: handler,
): handler {
	return handler;
}

/**
 * Defines route-map handlers with params inferred from direct route leaves.
 *
 * @param routes Route map used only to infer handler context types.
 * @param controller Controller handlers for the direct route leaves.
 * @returns The same controller object.
 */
export function createController<routes extends RouteMap, controller extends UIController<routes>>(
	_routes: routes,
	controller: controller,
): controller {
	return controller;
}

/**
 * Matched route data returned by `router.match`.
 */
export interface RouteMatch<route extends RouteTarget = RouteTarget> {
	/** Fully resolved URL that matched the route. */
	url: URL;
	/** The route target registered with the router. */
	route: route;
	/** Decoded params from the matched pattern. */
	params: MatchParams<RoutePatternSource<route>>;
}

/**
 * Browser window surface used by the mounted router.
 */
export interface RouterWindow {
	/** Current browser location. */
	readonly location: Location;
	/** Browser history used for programmatic navigation. */
	readonly history: History;
	/** Browser Navigation API used when available. */
	readonly navigation?: RouterNavigation;
	/** Subscribe to browser events such as `popstate`. */
	addEventListener(
		type: string,
		listener: EventListener,
		options?: boolean | AddEventListenerOptions,
	): void;
	/** Unsubscribe from browser events such as `popstate`. */
	removeEventListener(
		type: string,
		listener: EventListener,
		options?: boolean | EventListenerOptions,
	): void;
}

/** Browser Navigation API surface used by the router. */
export interface RouterNavigation {
	/** Programmatically navigate through the browser Navigation API. */
	navigate(url: string, options?: RouterNavigationOptions): RouterNavigationResult;
	/** Subscribe to Navigation API events. */
	addEventListener(type: string, listener: EventListener): void;
	/** Unsubscribe from Navigation API events. */
	removeEventListener(type: string, listener: EventListener): void;
}

/** Options accepted by the browser Navigation API. */
export interface RouterNavigationOptions {
	/** Browser history behavior for the new navigation entry. */
	history?: "push" | "replace";
	/** Entry state stored with the navigation. */
	state?: unknown;
}

/** Result returned by the browser Navigation API. */
export interface RouterNavigationResult {
	/** Resolves after the new entry is committed. */
	committed: Promise<unknown>;
	/** Resolves after intercepted navigation work finishes. */
	finished: Promise<unknown>;
}

/** Navigation API event shape consumed by mounted routers. */
interface RouterNavigationEvent extends Event {
	canIntercept?: boolean;
	navigationType?: "push" | "replace" | "reload" | "traverse";
	destination: {
		url: string;
		getState(): unknown;
	};
	intercept(options: { handler(): Awaitable<void> }): void;
}

/**
 * Router configuration for matching and mounting.
 */
export interface RouterOptions {
	/** Base URL used to resolve relative inputs outside a browser. */
	baseURL?: string | URL;
	/** Rendered when no mapped route matches the current URL. */
	defaultElement?: (ctx: NotFoundContext) => Awaitable<RemixNode>;
	/** Root factory override, primarily for tests. */
	createRoot?: (container: HTMLElement, options?: VirtualRootOptions) => VirtualRoot;
	/** Options forwarded to `remix/ui` `createRoot`. */
	rootOptions?: VirtualRootOptions;
	/** Current location reader override, primarily for tests. */
	getLocation?: () => RouterInput;
	/** Browser window adapter override, primarily for tests. */
	window?: RouterWindow;
	/** Intercept same-origin anchor clicks from mounted containers. Defaults to `true`. */
	interceptLinks?: boolean;
}

/**
 * Programmatic navigation options.
 */
export interface NavigateOptions {
	/** URL shown in browser history while rendering the `to` URL. */
	mask?: RouterInput;
	/** Replace the current history entry instead of pushing a new one. */
	replace?: boolean;
	/** Optional state stored in browser history. */
	state?: unknown;
}

/**
 * Controller returned from a mounted router root.
 */
export interface MountedRouter {
	/** Render a URL into this mounted root. */
	render(input?: RouterInput): Promise<RemixNode>;
	/** Navigate and refresh all mounted roots for this router. */
	navigate(to: RouterInput, options?: NavigateOptions): Promise<void>;
	/** Flush queued Remix UI updates synchronously. */
	flush(): void;
	/** Dispose DOM listeners, abort active render work, and dispose the Remix root. */
	dispose(): void;
}

/**
 * Client-side router that maps Remix route contracts to Remix UI renderers.
 */
export interface UIRouter {
	/** Map one route target to a view handler. */
	map<route extends RouteTarget>(route: route, handler: ViewHandler<route>): UIRouter;
	/** Map the direct leaf routes in a route map to view handlers. */
	map<routes extends RouteMap>(routes: routes, controller: UIController<routes>): UIRouter;
	/** Find the most specific registered route for a URL. */
	match(input?: RouterInput): RouteMatch | null;
	/** Render the matching route handler without mounting into the DOM. */
	render(input?: RouterInput): Promise<RemixNode>;
	/** Navigate and refresh mounted roots. */
	navigate(to: RouterInput, options?: NavigateOptions): Promise<void>;
	/** Mount the router into a DOM container using Remix UI. */
	mount(container: HTMLElement): MountedRouter;
}

/** Stores the route target and handler attached to a matcher entry. */
interface RouteEntry<route extends RouteTarget = RouteTarget> {
	route: route;
	handler: ViewHandler<route>;
}

/** Internal mount record used to refresh all active roots after navigation. */
interface MountedRoot {
	render(input?: RouterInput): Promise<RemixNode>;
	navigate(to: RouterInput, options?: NavigateOptions): Promise<void>;
	flush(): void;
	dispose(): void;
}

/** Browser history state shape used to restore masked render URLs on popstate. */
interface RouterHistoryState {
	__r3UIRouter?: {
		renderURL: string;
		visibleURL: string;
	};
	userState?: unknown;
}

/**
 * Provides the current router and route context to Remix UI descendants.
 *
 * @param handle Component handle carrying the provider value and children.
 * @returns The current route UI after refreshing the context value.
 */
export function RouterProvider(handle: Handle<RouterProviderProps, RouterProviderValue>) {
	return () => {
		handle.context.set(handle.props.value);
		return handle.props.children ?? null;
	};
}

/**
 * Create a client-side router for Remix UI route rendering.
 *
 * @param options Matching, rendering, and mounting options.
 * @returns A router that maps Remix route definitions to UI handlers.
 */
export function createRouter(options: RouterOptions = {}): UIRouter {
	let matcher = createMultiMatcher<RouteEntry>();
	let mountedRoots = new Set<MountedRoot>();
	let baseURL = normalizeBaseURL(options.baseURL, getRouterWindow(options)?.location.href);
	let createRoot = options.createRoot ?? createRemixRoot;
	let interceptLinks = options.interceptLinks ?? true;

	let router: UIRouter = {
		map(target: RouteTarget | RouteMap, handler: ViewHandler | UIController<RouteMap>) {
			if (isRouteTarget(target)) {
				registerRoute(matcher, target, handler as ViewHandler);
				return router;
			}

			for (let name in target) {
				let route = target[name];
				let routeHandler = (handler as Record<string, unknown>)[name];

				if (route instanceof Route && typeof routeHandler === "function") {
					registerRoute(matcher, route, routeHandler as ViewHandler);
				}
			}

			return router;
		},

		match(input) {
			let url = resolveURL(input ?? getCurrentLocation(options, baseURL), baseURL);
			let match = matcher.match(url);

			if (!match) return null;

			return {
				url: match.url,
				route: match.data.route,
				params: match.params,
			};
		},

		render(input) {
			return renderURL(input ?? getCurrentLocation(options, baseURL), new AbortController().signal);
		},

		async navigate(to, navigationOptions) {
			let url = resolveURL(to, baseURL);
			let visibleURL = navigationOptions?.mask ? resolveURL(navigationOptions.mask, baseURL) : url;
			let routerWindow = getRouterWindow(options);

			if (routerWindow && visibleURL.origin === routerWindow.location.origin) {
				if (routerWindow.navigation) {
					let state = createNavigationState(navigationOptions?.state, url, visibleURL);
					let result = routerWindow.navigation.navigate(visibleURL.href, {
						history: navigationOptions?.replace ? "replace" : "push",
						state,
					});

					await result.finished;
					return;
				}

				let state = createHistoryState(navigationOptions?.state, url, visibleURL);

				if (navigationOptions?.replace) {
					routerWindow.history.replaceState(state, "", visibleURL);
				} else {
					routerWindow.history.pushState(state, "", visibleURL);
				}
			}

			await renderMountedRoots(url);
		},

		mount(container) {
			let root = createRoot(container, options.rootOptions);
			let routerWindow = getRouterWindow(options);
			let activeController = new AbortController();
			let renderVersion = 0;

			let mounted: MountedRoot = {
				async render(input) {
					activeController.abort();
					activeController = new AbortController();
					let version = ++renderVersion;
					let signal = activeController.signal;

					let node = await renderURL(input ?? getCurrentLocation(options, baseURL), signal);

					if (!signal.aborted && version === renderVersion) {
						root.render(node);
					}

					return node;
				},

				navigate(to, navigationOptions) {
					return router.navigate(to, navigationOptions);
				},

				flush() {
					root.flush();
				},

				dispose() {
					renderVersion++;
					activeController.abort();
					mountedRoots.delete(mounted);

					if (routerWindow?.navigation) {
						routerWindow.navigation.removeEventListener("navigate", handleNavigation);
					} else if (routerWindow) {
						routerWindow.removeEventListener("popstate", handlePopState);
					}

					if (interceptLinks) {
						container.removeEventListener("click", handleClick);
					}

					root.dispose();
				},
			};

			function handlePopState(event: PopStateEvent) {
				void mounted.render(getHistoryRenderURL(event.state) ?? undefined);
			}

			function handleNavigation(event: Event) {
				if (!isRouterNavigationEvent(event)) return;

				let url = resolveURL(event.destination.url, baseURL);

				if (!routerWindow || url.origin !== routerWindow.location.origin) return;

				let state = readRouterState(event.destination.getState());
				let shouldIntercept =
					interceptLinks || event.navigationType === "traverse" || Boolean(state);

				if (!shouldIntercept || event.canIntercept === false) return;

				event.intercept({
					async handler() {
						await renderMountedRoots(state?.__r3UIRouter.renderURL ?? url);
					},
				});
			}

			function handleClick(event: MouseEvent) {
				let link = getNavigableLink(event, routerWindow);

				if (!link) return;

				event.preventDefault();
				void router.navigate(link.href);
			}

			mountedRoots.add(mounted);

			if (routerWindow?.navigation) {
				routerWindow.navigation.addEventListener("navigate", handleNavigation);
			} else if (routerWindow) {
				routerWindow.addEventListener("popstate", handlePopState);
			}

			if (interceptLinks && !routerWindow?.navigation) {
				container.addEventListener("click", handleClick);
			}

			void mounted.render();

			return mounted;
		},
	};

	async function renderURL(input: RouterInput, signal: AbortSignal): Promise<RemixNode> {
		let url = resolveURL(input, baseURL);
		let match = matcher.match(url);

		if (!match) {
			let context: NotFoundContext = {
				url,
				signal,
				navigate: router.navigate,
			};
			let node = (await options.defaultElement?.(context)) ?? null;

			return createElement(
				RouterProvider,
				{
					value: createRouterProviderValue(router, context, null),
				},
				node,
			);
		}

		let routeMatch: RouteMatch = {
			url: match.url,
			route: match.data.route,
			params: match.params,
		};
		let context = {
			url: routeMatch.url,
			params: routeMatch.params,
			route: match.data.route,
			signal,
			navigate: router.navigate,
		} as Context;
		let node = await match.data.handler(context);

		return createElement(
			RouterProvider,
			{
				value: createRouterProviderValue(router, context, routeMatch),
			},
			node,
		);
	}

	function renderMountedRoots(input: RouterInput): Promise<Array<RemixNode>> {
		return Promise.all(Array.from(mountedRoots, (mountedRoot) => mountedRoot.render(input)));
	}

	return router;
}

/** Creates the value exposed through `RouterProvider` for the current render. */
function createRouterProviderValue(
	router: UIRouter,
	context: Context | NotFoundContext,
	match: RouteMatch | null,
): RouterProviderValue {
	return {
		...router,
		context,
		match,
		url: context.url,
		params: match?.params ?? {},
		route: match?.route,
	};
}

/** Stores the unmasked render URL only when it differs from the visible URL. */
function createHistoryState(userState: unknown, renderURL: URL, visibleURL: URL): unknown {
	if (renderURL.href === visibleURL.href) return userState;

	return {
		__r3UIRouter: {
			renderURL: renderURL.href,
			visibleURL: visibleURL.href,
		},
		userState,
	} satisfies RouterHistoryState;
}

/** Stores router navigation metadata so Navigation API events can render masked URLs. */
function createNavigationState(
	userState: unknown,
	renderURL: URL,
	visibleURL: URL,
): RouterHistoryState {
	return {
		__r3UIRouter: {
			renderURL: renderURL.href,
			visibleURL: visibleURL.href,
		},
		userState,
	};
}

/** Reads the unmasked render URL from a popstate event when available. */
function getHistoryRenderURL(state: unknown): string | undefined {
	if (!isRouterHistoryState(state)) return undefined;

	return state.__r3UIRouter?.renderURL;
}

/** Reads router metadata from Navigation API destination state. */
function readRouterState(state: unknown): RouterHistoryState | undefined {
	if (!isRouterHistoryState(state)) return undefined;

	return state;
}

/** Checks whether browser history state contains router masking metadata. */
function isRouterHistoryState(state: unknown): state is RouterHistoryState {
	if (!state || typeof state !== "object") return false;
	if (!("__r3UIRouter" in state)) return false;

	let routerState = state.__r3UIRouter;

	if (!routerState || typeof routerState !== "object") return false;
	if (!("renderURL" in routerState)) return false;

	return typeof routerState.renderURL === "string";
}

/** Checks whether a browser event is a Navigation API event. */
function isRouterNavigationEvent(event: Event): event is RouterNavigationEvent {
	if (!("destination" in event)) return false;
	if (!("intercept" in event)) return false;

	let destination = (event as { destination: unknown }).destination;

	if (!destination || typeof destination !== "object") return false;
	if (!("url" in destination) || !("getState" in destination)) return false;

	return typeof destination.url === "string" && typeof destination.getState === "function";
}

/** Registers one route target with the shared route-pattern matcher. */
function registerRoute<route extends RouteTarget>(
	matcher: ReturnType<typeof createMultiMatcher<RouteEntry>>,
	route: route,
	handler: ViewHandler<route>,
) {
	matcher.add(getRoutePattern(route), { route, handler });
}

/** Checks whether a value can be registered as a single route target. */
function isRouteTarget(value: unknown): value is RouteTarget {
	return typeof value === "string" || value instanceof Route;
}

/** Returns the route-pattern source string used by the matcher. */
function getRoutePattern(route: RouteTarget): string {
	if (route instanceof Route) return route.pattern.toString();
	return route;
}

/** Resolves the current location from explicit options, browser state, or the base URL. */
function getCurrentLocation(options: RouterOptions, baseURL: URL): RouterInput {
	if (options.getLocation) return options.getLocation();

	let routerWindow = getRouterWindow(options);

	if (routerWindow) return routerWindow.location.href;

	return baseURL;
}

/** Returns the configured browser adapter or the global browser window. */
function getRouterWindow(options: RouterOptions): RouterWindow | undefined {
	if (options.window) return options.window;

	if (typeof window !== "undefined") return window;

	return undefined;
}

/** Normalizes an optional base URL without surfacing URL parser errors. */
function normalizeBaseURL(baseURL: string | URL | undefined, fallbackURL: string | undefined): URL {
	if (baseURL instanceof URL) return baseURL;

	let value = baseURL ?? fallbackURL ?? DEFAULT_BASE_URL;

	if (URL.canParse(value)) return new URL(value);

	return new URL(DEFAULT_BASE_URL);
}

/** Resolves router inputs against the normalized base URL. */
function resolveURL(input: RouterInput, baseURL: URL): URL {
	let value = input instanceof URL ? input.href : typeof input === "string" ? input : input.url;
	let url = value instanceof URL ? value.href : value;

	if (URL.canParse(url, baseURL)) return new URL(url, baseURL);

	return new URL(baseURL);
}

/** Returns a same-origin anchor that should be handled by client navigation. */
function getNavigableLink(
	event: MouseEvent,
	routerWindow: RouterWindow | undefined,
): HTMLAnchorElement | null {
	if (!routerWindow) return null;
	if (event.defaultPrevented || event.button !== 0) return null;
	if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return null;
	if (typeof Element === "undefined") return null;
	if (!(event.target instanceof Element)) return null;

	let anchor = event.target.closest("a[href]");

	if (!(anchor instanceof HTMLAnchorElement)) return null;
	if (anchor.target && anchor.target !== "_self") return null;
	if (anchor.hasAttribute("download")) return null;
	if (!URL.canParse(anchor.href, routerWindow.location.href)) return null;

	let url = new URL(anchor.href, routerWindow.location.href);

	if (url.origin !== routerWindow.location.origin) return null;

	return anchor;
}

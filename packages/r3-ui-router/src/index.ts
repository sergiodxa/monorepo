import type { Handle, MixinDescriptor, RemixNode, VirtualRoot, VirtualRootOptions } from "remix/ui";

import { createMultiMatcher, type MatchParams } from "remix/route-pattern/match";
import { Route, type RouteMap } from "remix/routes";
import { createElement, createMixin, TypedEventTarget } from "remix/ui";
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
	/** Fetch request represented by this route action. */
	request: Request;
	/** Fully resolved URL for the current render. */
	url: URL;
	/** Request method used for the current route action. */
	method: string;
	/** Decoded params from the matched route pattern. */
	params: params;
	/** The route target that produced this match. */
	route: route;
	/** Signal aborted when a mounted render is replaced or disposed. */
	signal: AbortSignal;
	/** Navigate to another URL and refresh mounted router roots. */
	navigate(to: RouterInput, options?: NavigateOptions): Promise<void>;
	/** Submit data through a route action, then navigate like a normal form submission. */
	submit<data = unknown>(target: SubmitTarget, options?: SubmitOptions): Promise<data | undefined>;
	/** Re-run the current route action for mounted roots. */
	revalidate(): Promise<void>;
	/** Return a shared or unique fetcher for background submissions. */
	getFetcher<data = unknown>(name?: string): Fetcher<data>;
}

/**
 * Context passed to the default element when no route matches.
 */
export interface NotFoundContext {
	/** Fetch request represented by this default render. */
	request: Request;
	/** Fully resolved URL that failed to match a mapped route. */
	url: URL;
	/** Request method used for the default render. */
	method: string;
	/** Signal aborted when a mounted render is replaced or disposed. */
	signal: AbortSignal;
	/** Navigate to another URL and refresh mounted router roots. */
	navigate(to: RouterInput, options?: NavigateOptions): Promise<void>;
	/** Submit data through a route action, then navigate like a normal form submission. */
	submit<data = unknown>(target: SubmitTarget, options?: SubmitOptions): Promise<data | undefined>;
	/** Re-run the current route action for mounted roots. */
	revalidate(): Promise<void>;
	/** Return a shared or unique fetcher for background submissions. */
	getFetcher<data = unknown>(name?: string): Fetcher<data>;
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
	(ctx: Context<MatchParams<RoutePatternSource<route>>, route>): Awaitable<unknown>;
}

/** State exposed by fetchers while a route action is running or revalidating. */
export type FetcherState = "idle" | "submitting" | "loading";

/** Accepted targets for route submissions. */
export type SubmitTarget =
	| HTMLFormElement
	| HTMLButtonElement
	| HTMLInputElement
	| FormData
	| URLSearchParams
	| Record<string, unknown>
	| null
	| undefined;

/** Options used to submit data through a route action. */
export interface SubmitOptions {
	/** URL submitted to. Defaults to the current location or form action. */
	action?: RouterInput;
	/** HTTP method used for the request. Defaults to the form method or GET. */
	method?: string;
	/** Encoding type used for form submissions. */
	encType?: string;
	/** Submitter button/input whose overrides should be applied. */
	submitter?: HTMLElement | null;
	/** Re-run the current route after non-GET fetcher submissions. Defaults to true. */
	revalidate?: boolean;
}

/** Options passed to form mixins. */
export interface FormMixinOptions {
	/** Re-run the current route after non-GET fetcher submissions. */
	revalidate?: boolean;
}

/** Events dispatched by fetchers when their public state changes. */
export interface FetcherEvents {
	change: Event;
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
export type UIControllerActions<routes extends RouteMap> = {
	[name in keyof routes as routes[name] extends Route<any, any>
		? name
		: never]: routes[name] extends Route<any, any> ? ViewHandler<routes[name]> : never;
};

/** Controller object for direct leaf routes in a route map branch. */
export interface UIController<routes extends RouteMap> {
	/** Route actions for direct leaf routes in the route map. */
	actions: UIControllerActions<routes>;
}

/** Bare controller action map retained for small apps and existing call sites. */
export type UIControllerInput<routes extends RouteMap> =
	| UIController<routes>
	| UIControllerActions<routes>;

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
export function createController<
	routes extends RouteMap,
	controller extends UIControllerInput<routes>,
>(_routes: routes, controller: controller): controller {
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
	/** Submit data through a route action, then navigate like a normal form submission. */
	submit<data = unknown>(target: SubmitTarget, options?: SubmitOptions): Promise<data | undefined>;
	/** Return a shared named fetcher or a unique unnamed fetcher. */
	getFetcher<data = unknown>(name?: string): Fetcher<data>;
	/** Re-run mounted roots for the latest rendered URL. */
	revalidate(): Promise<void>;
	/** Mixin that makes a form submit through router navigation submissions. */
	form(options?: FormMixinOptions): MixinDescriptor<HTMLFormElement>;
	/** Mount the router into a DOM container using Remix UI. */
	mount(container: HTMLElement): MountedRouter;
}

/** Stores the route target and handler attached to a matcher entry. */
interface RouteEntry<route extends RouteTarget = RouteTarget> {
	route: route;
	handler: ViewHandler<route>;
	method: string;
}

/** Internal contract used by fetchers to execute submissions. */
interface FetcherExecutor {
	baseURL: URL;
	getLocation(): RouterInput;
	run(request: Request, signal: AbortSignal): Promise<unknown>;
	navigate(to: RouterInput, options?: NavigateOptions): Promise<void>;
	revalidate(): Promise<void>;
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

/** Runs route submissions and exposes React Router-style fetcher state. */
export class Fetcher<data = unknown> extends TypedEventTarget<FetcherEvents> {
	/** Stable fetcher registry key. */
	readonly key: string;
	/** Current fetcher lifecycle state. */
	state: FetcherState = "idle";
	/** Most recent action result. */
	data: data | undefined;
	/** Most recent submitted form data. */
	formData: FormData | undefined;
	/** Most recent request sent through this fetcher. */
	request: Request | undefined;

	#controller: AbortController | undefined;
	#executor: FetcherExecutor;

	/**
	 * Creates a fetcher bound to one router executor.
	 *
	 * @param key Stable fetcher key used for sharing named fetchers.
	 * @param executor Router execution hooks used by the fetcher.
	 */
	constructor(key: string, executor: FetcherExecutor) {
		super();
		this.key = key;
		this.#executor = executor;
	}

	/** Loads a GET route action without changing the current URL. */
	async load(href: RouterInput): Promise<void> {
		let request = new Request(resolveURL(href, this.#executor.baseURL), {
			method: "GET",
		});

		await this.#run(request, false, "loading");
	}

	/** Submits data through the matching route action. */
	async submit(target: SubmitTarget, options: SubmitOptions = {}): Promise<void> {
		let submission = createSubmission(target, options, this.#executor);
		let method = submission.request.method.toUpperCase();

		this.formData = submission.formData;

		await this.#run(submission.request, options.revalidate ?? method !== "GET", "submitting");
	}

	/** Returns a mixin that submits forms through this fetcher. */
	form(options: FormMixinOptions = {}): MixinDescriptor<HTMLFormElement> {
		return fetcherFormMixin(this, options);
	}

	/** Aborts active work and returns to idle state. */
	dispose() {
		this.#controller?.abort();
		this.#controller = undefined;
		this.state = "idle";
		this.dispatchEvent(new Event("change"));
	}

	async #run(request: Request, revalidate: boolean, initialState: FetcherState): Promise<void> {
		this.#controller?.abort();
		this.#controller = new AbortController();
		this.request = request;
		this.state = initialState;
		this.dispatchEvent(new Event("change"));

		let result = await this.#executor.run(
			cloneRequestWithSignal(request, this.#controller.signal),
			this.#controller.signal,
		);

		this.data = result as data;

		if (isRedirectResponse(result)) {
			this.state = "loading";
			this.dispatchEvent(new Event("change"));
			await this.#executor.navigate(result.headers.get("Location")!);
			this.state = "idle";
			this.dispatchEvent(new Event("change"));
			return;
		}

		if (revalidate) {
			this.state = "loading";
			this.dispatchEvent(new Event("change"));
			await this.#executor.revalidate();
		}

		this.state = "idle";
		this.dispatchEvent(new Event("change"));
	}
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
	let fetchers = new Map<string, Fetcher>();
	let baseURL = normalizeBaseURL(options.baseURL, getRouterWindow(options)?.location.href);
	let createRoot = options.createRoot ?? createRemixRoot;
	let interceptLinks = options.interceptLinks ?? true;
	let lastRenderURL: URL | undefined;
	let fetcherId = 0;
	let executor: FetcherExecutor = {
		baseURL,
		getLocation() {
			return getCurrentLocation(options, baseURL);
		},
		run(request, signal) {
			return runRequest(request, signal);
		},
		navigate(to, navigationOptions) {
			return router.navigate(to, navigationOptions);
		},
		revalidate() {
			return router.revalidate();
		},
	};

	let router: UIRouter = {
		map(target: RouteTarget | RouteMap, handler: ViewHandler | UIControllerInput<RouteMap>) {
			if (isRouteTarget(target)) {
				registerRoute(matcher, target, handler as ViewHandler);
				return router;
			}

			let actions = getControllerActions(handler);

			for (let name in target) {
				let route = target[name];
				let routeHandler = actions[name];

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
			let url = resolveURL(input ?? getCurrentLocation(options, baseURL), baseURL);
			return renderURL(url, new AbortController().signal);
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

		async submit<data = unknown>(target: SubmitTarget, submitOptions: SubmitOptions = {}) {
			let fetcher = new Fetcher<data>(createFetcherKey("router", fetcherId++), executor);

			await fetcher.submit(target, { ...submitOptions, revalidate: false });

			if (!fetcher.request) return fetcher.data;
			if (isRedirectResponse(fetcher.data)) return fetcher.data;

			let url = new URL(fetcher.request.url);
			let currentURL = lastRenderURL ?? resolveURL(getCurrentLocation(options, baseURL), baseURL);

			if (url.href === currentURL.href) {
				await router.revalidate();
			} else {
				await router.navigate(url);
			}

			return fetcher.data;
		},

		getFetcher<data = unknown>(name?: string) {
			let key = name ?? createFetcherKey("fetcher", fetcherId++);
			let fetcher = fetchers.get(key);

			if (!fetcher) {
				fetcher = new Fetcher(key, executor);
				fetchers.set(key, fetcher);
			}

			return fetcher as Fetcher<data>;
		},

		revalidate() {
			return renderMountedRoots(lastRenderURL ?? getCurrentLocation(options, baseURL)).then(
				() => undefined,
			);
		},

		form(formOptions) {
			return routerFormMixin(router, formOptions ?? {});
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
		lastRenderURL = url;
		let request = createRequest(url, "GET", signal);
		let match = matchRequest(request);

		if (!match) {
			let context: NotFoundContext = {
				request,
				url,
				method: request.method,
				signal,
				navigate: router.navigate,
				submit: router.submit,
				revalidate: router.revalidate,
				getFetcher: router.getFetcher,
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
			request,
			url: routeMatch.url,
			method: request.method,
			params: routeMatch.params,
			route: match.data.route,
			signal,
			navigate: router.navigate,
			submit: router.submit,
			revalidate: router.revalidate,
			getFetcher: router.getFetcher,
		} as Context;
		let node = (await match.data.handler(context)) as RemixNode;

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

	function matchRequest(request: Request) {
		return (
			matcher
				.matchAll(request.url)
				.find((match) => routeMatchesMethod(match.data.method, request.method)) ?? null
		);
	}

	async function runRequest(request: Request, signal: AbortSignal): Promise<unknown> {
		let match = matchRequest(request);

		if (!match) return null;

		let context = {
			request,
			url: match.url,
			method: request.method,
			params: match.params,
			route: match.data.route,
			signal,
			navigate: router.navigate,
			submit: router.submit,
			revalidate: router.revalidate,
			getFetcher: router.getFetcher,
		} as Context;

		return match.data.handler(context);
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

/** Creates a stable fetcher key with an incrementing suffix. */
function createFetcherKey(prefix: string, id: number): string {
	return `${prefix}:${id}`;
}

/** Checks whether a route entry can handle an HTTP method. */
function routeMatchesMethod(routeMethod: string, requestMethod: string): boolean {
	return routeMethod === "ANY" || routeMethod.toUpperCase() === requestMethod.toUpperCase();
}

/** Creates a GET request for route rendering. */
function createRequest(url: URL, method: string, signal: AbortSignal): Request {
	return new Request(url, { method, signal });
}

/** Copies a request while replacing its abort signal. */
function cloneRequestWithSignal(request: Request, signal: AbortSignal): Request {
	return new Request(request, { signal });
}

/** Checks whether an action result is a redirect response. */
function isRedirectResponse(value: unknown): value is Response {
	return (
		value instanceof Response &&
		value.status >= 300 &&
		value.status < 400 &&
		value.headers.has("Location")
	);
}

/** Returns the direct route actions from supported controller shapes. */
function getControllerActions(controller: unknown): Record<string, unknown> {
	if (isControllerObject(controller)) return controller.actions;

	return controller as Record<string, unknown>;
}

/** Checks for the fetch-router-style controller shape. */
function isControllerObject(value: unknown): value is { actions: Record<string, unknown> } {
	if (!value || typeof value !== "object") return false;
	if (!("actions" in value)) return false;

	let actions = value.actions;

	return Boolean(actions) && typeof actions === "object";
}

/** Mixin that submits forms through router navigation submissions. */
const routerFormMixin = createMixin<HTMLFormElement, [router: UIRouter, options: FormMixinOptions]>(
	(handle) => {
		return (router, options) => {
			handle.queueTask((node, signal) => {
				node.addEventListener(
					"submit",
					(submitEvent) => {
						let event = submitEvent as SubmitEvent;

						if (!shouldHandleFormSubmit(event)) return;

						event.preventDefault();
						void router.submit(event.currentTarget as HTMLFormElement, {
							submitter: event.submitter,
							revalidate: options.revalidate,
						});
					},
					{ signal },
				);
			});
		};
	},
);

/** Mixin that submits forms through one fetcher. */
const fetcherFormMixin = createMixin<
	HTMLFormElement,
	[fetcher: Fetcher, options: FormMixinOptions]
>((handle) => {
	return (fetcher, options) => {
		handle.queueTask((node, signal) => {
			node.addEventListener(
				"submit",
				(submitEvent) => {
					let event = submitEvent as SubmitEvent;

					if (!shouldHandleFormSubmit(event)) return;

					event.preventDefault();
					void fetcher.submit(event.currentTarget as HTMLFormElement, {
						submitter: event.submitter,
						revalidate: options.revalidate,
					});
				},
				{ signal },
			);
		});
	};
});

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

/** Normalized submission produced from a form, submitter, or imperative target. */
interface Submission {
	request: Request;
	formData: FormData | undefined;
}

/** Creates a request from a form target or imperative submit data. */
function createSubmission(
	target: SubmitTarget,
	options: SubmitOptions,
	executor: FetcherExecutor,
): Submission {
	let form = getTargetForm(target);
	let submitter = options.submitter ?? (isSubmitter(target) ? target : null);
	let action = getSubmissionAction(form, submitter, options, executor);
	let method = getSubmissionMethod(form, submitter, options);
	let encType = getSubmissionEncType(form, submitter, options);
	let formData = createSubmissionFormData(target, submitter);
	let bodyMethod = method;

	if (formData) bodyMethod = getMethodOverride(formData) ?? method;

	let url = resolveURL(action, executor.baseURL);

	if (bodyMethod === "GET") {
		appendFormData(url, formData);
		return {
			request: new Request(url, { method: "GET" }),
			formData,
		};
	}

	return {
		request: new Request(url, {
			method: bodyMethod,
			headers: createSubmissionHeaders(encType),
			body: createSubmissionBody(formData, encType),
		}),
		formData,
	};
}

/** Returns whether a submit event should be handled by the router. */
function shouldHandleFormSubmit(event: SubmitEvent): boolean {
	if (event.defaultPrevented) return false;
	if (!(event.currentTarget instanceof HTMLFormElement)) return false;

	let target = getSubmitterTarget(event.submitter) ?? event.currentTarget.target;

	return !target || target === "_self";
}

/** Finds the form associated with a submit target. */
function getTargetForm(target: SubmitTarget): HTMLFormElement | null {
	if (typeof HTMLFormElement !== "undefined" && target instanceof HTMLFormElement) return target;
	if (isSubmitter(target)) return target.form;

	return null;
}

/** Checks whether a target is a button/input submitter. */
function isSubmitter(target: unknown): target is HTMLButtonElement | HTMLInputElement {
	if (typeof HTMLButtonElement !== "undefined" && target instanceof HTMLButtonElement) return true;
	if (typeof HTMLInputElement !== "undefined" && target instanceof HTMLInputElement) return true;

	return false;
}

/** Resolves a submission action URL from overrides, form attributes, or current location. */
function getSubmissionAction(
	form: HTMLFormElement | null,
	submitter: HTMLElement | null,
	options: SubmitOptions,
	executor: FetcherExecutor,
): RouterInput {
	if (options.action) return options.action;

	let submitterAction = getSubmitterAction(submitter);

	if (submitterAction) return submitterAction;
	if (form?.action) return form.action;

	return executor.getLocation();
}

/** Resolves a submission method from overrides, form attributes, or GET. */
function getSubmissionMethod(
	form: HTMLFormElement | null,
	submitter: HTMLElement | null,
	options: SubmitOptions,
): string {
	return (options.method ?? getSubmitterMethod(submitter) ?? form?.method ?? "GET").toUpperCase();
}

/** Resolves a submission encoding type from overrides, form attributes, or urlencoded. */
function getSubmissionEncType(
	form: HTMLFormElement | null,
	submitter: HTMLElement | null,
	options: SubmitOptions,
): string {
	return (
		options.encType ??
		getSubmitterEncType(submitter) ??
		form?.enctype ??
		"application/x-www-form-urlencoded"
	);
}

/** Creates form data from supported submission targets. */
function createSubmissionFormData(
	target: SubmitTarget,
	submitter: HTMLElement | null,
): FormData | undefined {
	if (target == null) return undefined;
	if (target instanceof FormData) return target;

	let form = getTargetForm(target);

	if (form) return createFormData(form, submitter);
	if (target instanceof URLSearchParams) return formDataFromSearchParams(target);
	if (typeof target === "object") return formDataFromObject(target as Record<string, unknown>);

	return undefined;
}

/** Creates browser FormData while preserving submitter button values. */
function createFormData(form: HTMLFormElement, submitter: HTMLElement | null): FormData {
	if (submitter && isFormDataSubmitter(submitter)) return new FormData(form, submitter);

	return new FormData(form);
}

/** Checks whether a submitter can be passed to the FormData constructor. */
function isFormDataSubmitter(
	submitter: HTMLElement,
): submitter is HTMLButtonElement | HTMLInputElement {
	return isSubmitter(submitter);
}

/** Converts URLSearchParams to FormData. */
function formDataFromSearchParams(searchParams: URLSearchParams): FormData {
	let formData = new FormData();

	for (let [name, value] of searchParams) formData.append(name, value);

	return formData;
}

/** Converts plain object submit data to FormData. */
function formDataFromObject(object: Record<string, unknown>): FormData {
	let formData = new FormData();

	for (let name in object) appendFormValue(formData, name, object[name]);

	return formData;
}

/** Appends one object field to FormData. */
function appendFormValue(formData: FormData, name: string, value: unknown) {
	if (value == null) return;
	if (Array.isArray(value)) {
		for (let item of value) appendFormValue(formData, name, item);
		return;
	}
	if (value instanceof Blob) {
		formData.append(name, value);
		return;
	}

	formData.append(name, String(value));
}

/** Applies FormData fields to a GET submission URL. */
function appendFormData(url: URL, formData: FormData | undefined) {
	if (!formData) return;

	for (let [name, value] of formData) {
		url.searchParams.append(name, typeof value === "string" ? value : value.name);
	}
}

/** Creates request headers for one form encoding type. */
function createSubmissionHeaders(encType: string): Headers | undefined {
	if (encType === "application/x-www-form-urlencoded") {
		return new Headers({ "Content-Type": encType });
	}

	return undefined;
}

/** Creates the request body for one form encoding type. */
function createSubmissionBody(formData: FormData | undefined, encType: string): BodyInit | null {
	if (!formData) return null;
	if (encType === "application/x-www-form-urlencoded")
		return new URLSearchParams(formData as never);

	return formData;
}

/** Reads a method override value from form data. */
function getMethodOverride(formData: FormData): string | undefined {
	let method = formData.get("_method");

	if (typeof method !== "string" || !method) return undefined;

	return method.toUpperCase();
}

/** Reads submitter action override attributes. */
function getSubmitterAction(submitter: HTMLElement | null): string | undefined {
	if (!submitter || !("formAction" in submitter)) return undefined;

	let action = submitter.formAction;

	return typeof action === "string" && action ? action : undefined;
}

/** Reads submitter method override attributes. */
function getSubmitterMethod(submitter: HTMLElement | null): string | undefined {
	if (!submitter || !("formMethod" in submitter)) return undefined;

	let method = submitter.formMethod;

	return typeof method === "string" && method ? method : undefined;
}

/** Reads submitter encoding override attributes. */
function getSubmitterEncType(submitter: HTMLElement | null): string | undefined {
	if (!submitter || !("formEnctype" in submitter)) return undefined;

	let encType = submitter.formEnctype;

	return typeof encType === "string" && encType ? encType : undefined;
}

/** Reads submitter target override attributes. */
function getSubmitterTarget(submitter: HTMLElement | null): string | undefined {
	if (!submitter || !("formTarget" in submitter)) return undefined;

	let target = submitter.formTarget;

	return typeof target === "string" && target ? target : undefined;
}

/** Registers one route target with the shared route-pattern matcher. */
function registerRoute<route extends RouteTarget>(
	matcher: ReturnType<typeof createMultiMatcher<RouteEntry>>,
	route: route,
	handler: ViewHandler<route>,
) {
	matcher.add(getRoutePattern(route), { route, handler, method: getRouteMethod(route) });
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

/** Returns the HTTP method declared by a route target. */
function getRouteMethod(route: RouteTarget): string {
	if (route instanceof Route) return String(route.method).toUpperCase();

	return "ANY";
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

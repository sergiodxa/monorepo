import { describe, expect, test } from "bun:test";

import type { RemixElement, RemixNode, VirtualRoot } from "remix/ui";

import { route } from "remix/routes";

import {
	createAction,
	createController,
	createRouter,
	RouterProvider,
	type RouterProviderValue,
	type UIController,
	type ViewHandler,
} from "./index";

interface ProviderRender {
	value: RouterProviderValue;
	children: RemixNode;
}

function readProviderRender(node: RemixNode): ProviderRender {
	expect(isRemixElement(node)).toBe(true);

	let element = node as RemixElement;

	expect(element.type).toBe(RouterProvider);

	return {
		value: element.props.value as RouterProviderValue,
		children: readSingleChild(element.props.children as RemixNode),
	};
}

function isRemixElement(node: RemixNode): node is RemixElement {
	return typeof node === "object" && node !== null && "$rmx" in node;
}

function readSingleChild(node: RemixNode): RemixNode {
	if (Array.isArray(node) && node.length === 1) return node[0];
	return node;
}

describe(createRouter.name, () => {
	test("renders the handler for the most specific matching route", async () => {
		let routes = route({
			post: "/posts/:id",
			settings: "/posts/settings",
		});

		let router = createRouter();

		router.map(routes.post, (ctx) => `post:${ctx.params.id}`);
		router.map(routes.settings, () => "settings");

		expect(readProviderRender(await router.render("/posts/hello")).children).toBe("post:hello");
		expect(readProviderRender(await router.render("/posts/settings")).children).toBe("settings");
	});

	test("returns decoded params from match", () => {
		let routes = route({ post: "/posts/:id" });
		let router = createRouter();

		router.map(routes.post, () => null);

		let match = router.match("/posts/hello%20world?draft=true");

		expect(match?.url.pathname).toBe("/posts/hello%20world");
		expect(match?.url.searchParams.get("draft")).toBe("true");
		expect(match?.params.id).toBe("hello world");
	});

	test("renders async handlers", async () => {
		let routes = route({ post: "/posts/:id" });
		let router = createRouter();

		router.map(routes.post, async (ctx) => {
			await Promise.resolve();
			return `post:${ctx.params.id}`;
		});

		let rendered = readProviderRender(await router.render("/posts/async"));

		expect(rendered.children).toBe("post:async");
		expect(rendered.value.params.id).toBe("async");
		expect(rendered.value.match?.params.id).toBe("async");
		expect(rendered.value.context.url.pathname).toBe("/posts/async");
		expect(rendered.value.navigate).toBe(router.navigate);
	});

	test("maps direct route-map leaves", async () => {
		let routes = route({
			posts: {
				index: "/posts",
				show: "/posts/:id",
			},
		});

		let router = createRouter();

		router.map(routes.posts, {
			index: () => "index",
			show: (ctx) => `show:${ctx.params.id}`,
		});

		expect(readProviderRender(await router.render("/posts")).children).toBe("index");
		expect(readProviderRender(await router.render("/posts/123")).children).toBe("show:123");
	});

	test("createAction returns the same handler with route params inferred", () => {
		let routes = route({ post: "/posts/:id" });
		let original = ((ctx) => `post:${ctx.params.id}`) satisfies ViewHandler<typeof routes.post>;
		let handler = createAction(routes.post, original);

		expect(handler).toBe(original);
	});

	test("createController returns the same controller object", () => {
		let routes = route({
			posts: {
				index: "/posts",
				show: "/posts/:id",
			},
		});
		let controller = {
			index: () => "index",
			show: (ctx) => `show:${ctx.params.id}`,
		} satisfies UIController<typeof routes.posts>;
		let wrapped = createController(routes.posts, controller);

		expect(wrapped).toBe(controller);
	});

	test("maps fetch-router-style controller actions", async () => {
		let routes = route({
			contact: {
				index: { method: "GET", pattern: "/contact" },
				action: { method: "POST", pattern: "/contact" },
			},
		});
		let router = createRouter();

		router.map(
			routes.contact,
			createController(routes.contact, {
				actions: {
					index(ctx) {
						return `index:${ctx.request.method}:${ctx.method}`;
					},
					async action(ctx) {
						let formData = await ctx.request.formData();

						return { message: formData.get("message") };
					},
				},
			}),
		);

		let fetcher = router.getFetcher<{ message: FormDataEntryValue | null }>("contact");

		expect(readProviderRender(await router.render("/contact")).children).toBe("index:GET:GET");

		await fetcher.submit(
			{ message: "hello" },
			{
				method: "POST",
				action: "/contact",
				revalidate: false,
			},
		);

		expect(fetcher.data).toEqual({ message: "hello" });
		expect(fetcher.state).toBe("idle");
	});

	test("fetcher submissions revalidate mounted roots", async () => {
		let routes = route({
			contact: {
				index: { method: "GET", pattern: "/contact" },
				action: { method: "POST", pattern: "/contact" },
			},
		});
		let renders = 0;
		let rendered: RemixNode[] = [];
		let root: VirtualRoot = {
			addEventListener() {},
			removeEventListener() {},
			dispatchEvent() {
				return true;
			},
			render(node) {
				rendered.push(readProviderRender(node).children);
			},
			dispose() {},
			flush() {},
		};
		let router = createRouter({
			interceptLinks: false,
			getLocation() {
				return "/contact";
			},
			createRoot() {
				return root;
			},
		});

		router.map(routes.contact, {
			actions: {
				index() {
					renders++;
					return `render:${renders}`;
				},
				action() {
					return { ok: true };
				},
			},
		});

		let mounted = router.mount({} as HTMLElement);
		await mounted.render();

		let fetcher = router.getFetcher<{ ok: boolean }>();
		let renderCount = rendered.length;

		await fetcher.submit(null, { method: "POST", action: "/contact" });

		expect(fetcher.data).toEqual({ ok: true });
		expect(rendered).toHaveLength(renderCount + 1);
		expect(rendered.at(-1)).toBe(`render:${renders}`);

		mounted.dispose();
	});

	test("router submit navigates to redirect responses", async () => {
		let routes = route({
			save: { method: "POST", pattern: "/save" },
			done: { method: "GET", pattern: "/done" },
		});
		let rendered: RemixNode[] = [];
		let root: VirtualRoot = {
			addEventListener() {},
			removeEventListener() {},
			dispatchEvent() {
				return true;
			},
			render(node) {
				rendered.push(readProviderRender(node).children);
			},
			dispose() {},
			flush() {},
		};
		let router = createRouter({
			interceptLinks: false,
			getLocation() {
				return "/done";
			},
			createRoot() {
				return root;
			},
		});

		router.map(
			routes.save,
			() => new Response(null, { status: 302, headers: { Location: "/done" } }),
		);
		router.map(routes.done, () => "done");

		let mounted = router.mount({} as HTMLElement);
		await mounted.render();

		await router.submit(null, { method: "POST", action: "/save" });

		expect(rendered).toEqual(["done", "done"]);

		mounted.dispose();
	});

	test("renders the default element when no route matches", async () => {
		let router = createRouter({
			async defaultElement(ctx) {
				return `not-found:${ctx.url.pathname}`;
			},
		});
		let rendered = readProviderRender(await router.render("/missing"));

		expect(router.match("/missing")).toBeNull();
		expect(rendered.children).toBe("not-found:/missing");
		expect(rendered.value.match).toBeNull();
		expect(rendered.value.params).toEqual({});
		expect(rendered.value.context.url.pathname).toBe("/missing");
	});

	test("mount renders current location and responds to navigation", async () => {
		let routes = route({
			home: "/",
			post: "/posts/:id",
		});
		let rendered: RemixNode[] = [];
		let disposed = false;
		let flushed = false;
		let location = "http://localhost/";
		let root: VirtualRoot = {
			addEventListener() {},
			removeEventListener() {},
			dispatchEvent() {
				return true;
			},
			render(node) {
				rendered.push(readProviderRender(node).children);
			},
			dispose() {
				disposed = true;
			},
			flush() {
				flushed = true;
			},
		};
		let router = createRouter({
			interceptLinks: false,
			getLocation() {
				return location;
			},
			createRoot() {
				return root;
			},
		});

		router.map(routes.home, () => "home");
		router.map(routes.post, (ctx) => `post:${ctx.params.id}`);

		let mounted = router.mount({} as HTMLElement);
		await mounted.render();

		expect(rendered).toEqual(["home"]);

		await router.navigate("/posts/abc");

		expect(rendered).toEqual(["home", "post:abc"]);

		location = "http://localhost/posts/def";
		await mounted.render();

		expect(rendered).toEqual(["home", "post:abc", "post:def"]);

		mounted.flush();
		mounted.dispose();

		expect(flushed).toBe(true);
		expect(disposed).toBe(true);
	});

	test("aborts the previous mounted render signal", async () => {
		let routes = route({ home: "/", post: "/posts/:id" });
		let signals: AbortSignal[] = [];
		let root: VirtualRoot = {
			addEventListener() {},
			removeEventListener() {},
			dispatchEvent() {
				return true;
			},
			render() {},
			dispose() {},
			flush() {},
		};
		let router = createRouter({
			interceptLinks: false,
			getLocation() {
				return "/";
			},
			createRoot() {
				return root;
			},
		});

		router.map(routes.home, (ctx) => {
			signals.push(ctx.signal);
			return "home";
		});
		router.map(routes.post, (ctx) => {
			signals.push(ctx.signal);
			return `post:${ctx.params.id}`;
		});

		let mounted = router.mount({} as HTMLElement);
		await Promise.resolve();

		await mounted.render("/posts/123");

		expect(signals[0]?.aborted).toBe(true);
		expect(signals[1]?.aborted).toBe(false);

		mounted.dispose();

		expect(signals[1]?.aborted).toBe(true);
	});

	test("does not commit stale async mounted renders", async () => {
		let routes = route({ home: "/", post: "/posts/:id" });
		let rendered: RemixNode[] = [];
		let resolveHome: ((value: RemixNode) => void) | undefined;
		let root: VirtualRoot = {
			addEventListener() {},
			removeEventListener() {},
			dispatchEvent() {
				return true;
			},
			render(node) {
				rendered.push(readProviderRender(node).children);
			},
			dispose() {},
			flush() {},
		};
		let router = createRouter({
			interceptLinks: false,
			getLocation() {
				return "/";
			},
			createRoot() {
				return root;
			},
		});

		router.map(routes.home, () => {
			return new Promise<RemixNode>((resolve) => {
				resolveHome = resolve;
			});
		});
		router.map(routes.post, async (ctx) => `post:${ctx.params.id}`);

		let mounted = router.mount({} as HTMLElement);

		await mounted.render("/posts/123");

		expect(rendered).toEqual(["post:123"]);

		resolveHome?.("home");
		await Promise.resolve();

		expect(rendered).toEqual(["post:123"]);

		mounted.dispose();
	});

	test("renders an internal URL while masking the browser URL", async () => {
		let routes = route({ album: "/album/:id", photo: "/photo/:id" });
		let rendered: RemixNode[] = [];
		let historyState: unknown;
		let visibleURL = "http://localhost:3000/album/1";
		let popstateListener: EventListener | undefined;
		let root: VirtualRoot = {
			addEventListener() {},
			removeEventListener() {},
			dispatchEvent() {
				return true;
			},
			render(node) {
				rendered.push(readProviderRender(node).children);
			},
			dispose() {},
			flush() {},
		};
		let router = createRouter({
			interceptLinks: false,
			getLocation() {
				return visibleURL;
			},
			createRoot() {
				return root;
			},
			window: {
				location: {
					href: visibleURL,
					origin: "http://localhost:3000",
				} as Location,
				history: {
					pushState(state, _unused, url) {
						historyState = state;
						visibleURL = new URL(String(url), visibleURL).href;
					},
					replaceState() {},
				} as History,
				addEventListener(type, listener) {
					if (type === "popstate") popstateListener = listener;
				},
				removeEventListener() {},
			},
		});

		router.map(routes.album, (ctx) => {
			return `album:${ctx.params.id}:photo:${ctx.url.searchParams.get("photoId")}`;
		});
		router.map(routes.photo, (ctx) => `photo:${ctx.params.id}`);

		let mounted = router.mount({} as HTMLElement);
		await mounted.render();

		await router.navigate("/album/1?photoId=7", { mask: "/photo/7" });

		expect(visibleURL).toBe("http://localhost:3000/photo/7");
		expect(rendered).toEqual(["album:1:photo:null", "album:1:photo:7"]);

		popstateListener?.({ state: historyState } as PopStateEvent);
		await Promise.resolve();
		await Promise.resolve();

		expect(rendered).toEqual(["album:1:photo:null", "album:1:photo:7", "album:1:photo:7"]);

		mounted.dispose();
	});

	test("uses the Navigation API when available", async () => {
		let routes = route({ album: "/album/:id" });
		let rendered: RemixNode[] = [];
		let visibleURL = "http://localhost:3000/album/1";
		let navigateListener: EventListener | undefined;
		let removedNavigateListener: EventListener | undefined;
		let navigationOptions: unknown;
		let historyUsed = false;
		let root: VirtualRoot = {
			addEventListener() {},
			removeEventListener() {},
			dispatchEvent() {
				return true;
			},
			render(node) {
				rendered.push(readProviderRender(node).children);
			},
			dispose() {},
			flush() {},
		};
		let router = createRouter({
			interceptLinks: false,
			getLocation() {
				return visibleURL;
			},
			createRoot() {
				return root;
			},
			window: {
				location: {
					href: visibleURL,
					origin: "http://localhost:3000",
				} as Location,
				history: {
					pushState() {
						historyUsed = true;
					},
					replaceState() {
						historyUsed = true;
					},
				} as History,
				navigation: {
					navigate(url, options) {
						navigationOptions = options;
						visibleURL = url;

						let intercepted = Promise.resolve();
						let event = {
							canIntercept: true,
							navigationType: options?.history ?? "push",
							destination: {
								url,
								getState() {
									return options?.state;
								},
							},
							intercept(interceptOptions: { handler(): Promise<void> | void }) {
								intercepted = Promise.resolve(interceptOptions.handler());
							},
						} as Event;

						navigateListener?.(event);

						return {
							committed: Promise.resolve(),
							finished: intercepted,
						};
					},
					addEventListener(type, listener) {
						if (type === "navigate") navigateListener = listener;
					},
					removeEventListener(type, listener) {
						if (type === "navigate") removedNavigateListener = listener;
					},
				},
				addEventListener() {},
				removeEventListener() {},
			},
		});

		router.map(routes.album, (ctx) => {
			return `album:${ctx.params.id}:photo:${ctx.url.searchParams.get("photoId")}`;
		});

		let mounted = router.mount({} as HTMLElement);
		await mounted.render();

		await router.navigate("/album/1?photoId=7", { mask: "/photo/7" });

		expect(historyUsed).toBe(false);
		expect(visibleURL).toBe("http://localhost:3000/photo/7");
		expect(navigationOptions).toEqual(
			expect.objectContaining({
				history: "push",
			}),
		);
		expect(rendered).toEqual(["album:1:photo:null", "album:1:photo:7"]);

		mounted.dispose();

		expect(removedNavigateListener).toBe(navigateListener);
	});
});

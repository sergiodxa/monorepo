import type { RemixElement, RemixNode, VirtualRoot, VirtualRootOptions } from "remix/ui";

import { route } from "remix/routes";
import { describe, expect, test } from "vitest";

import {
	createAction,
	createContextKey,
	createController,
	createRouter,
	RouterProvider,
	type RouterProviderValue,
	type UIControllerActions,
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
		} satisfies UIControllerActions<typeof routes.posts>;
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

	test("submits nested submit data as JSON instead of [object Object]", async () => {
		let routes = route({
			search: { method: "POST", pattern: "/search" },
		});
		let router = createRouter();

		router.map(routes.search, async (ctx) => {
			let formData = await ctx.request.formData();

			return { filter: formData.get("filter") };
		});

		let fetcher = router.getFetcher<{ filter: FormDataEntryValue | null }>("search");

		await fetcher.submit(
			{ filter: { tag: "remix", draft: false } },
			{ method: "POST", action: "/search", revalidate: false },
		);

		expect(fetcher.data).toEqual({ filter: `{"tag":"remix","draft":false}` });
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
			reconcile() {},
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

	test("form submissions ignore default submitter action without an override attribute", async () => {
		let routes = route({
			album: "/album/:id",
			likePhoto: { method: "POST", pattern: "/album/:albumId/photos/:photoId/like" },
		});
		let originalHTMLFormElement = globalThis.HTMLFormElement;
		let originalHTMLButtonElement = globalThis.HTMLButtonElement;
		let originalFormData = globalThis.FormData;

		class TestFormElement {
			action = "http://localhost/album/14/photos/651/like";
			method = "post";
			enctype = "application/x-www-form-urlencoded";
		}

		class TestButtonElement {
			form = new TestFormElement();
			formAction = "http://localhost/album/14";
			formMethod = "";
			formEnctype = "";
			formTarget = "";

			hasAttribute() {
				return false;
			}
		}

		class TestFormData {
			fields: [string, string][] = [["intent", "like"]];

			get(name: string) {
				return this.fields.find(([fieldName]) => fieldName === name)?.[1] ?? null;
			}

			*[Symbol.iterator]() {
				yield* this.fields;
			}
		}

		try {
			globalThis.HTMLFormElement = TestFormElement as never;
			globalThis.HTMLButtonElement = TestButtonElement as never;
			globalThis.FormData = TestFormData as never;

			let router = createRouter();

			router.map(routes.album, () => "album");
			router.map(routes.likePhoto, (ctx) => `like:${ctx.params.albumId}:${ctx.params.photoId}`);

			let submitter = new TestButtonElement();
			let fetcher = router.getFetcher<string>();

			await fetcher.submit(submitter.form as never, {
				submitter: submitter as never,
				revalidate: false,
			});

			expect(fetcher.data).toBe("like:14:651");
		} finally {
			globalThis.HTMLFormElement = originalHTMLFormElement;
			globalThis.HTMLButtonElement = originalHTMLButtonElement;
			globalThis.FormData = originalFormData;
		}
	});

	test("fetcher form mixin submits inserted forms", async () => {
		let routes = route({
			likePhoto: { method: "POST", pattern: "/album/:albumId/photos/:photoId/like" },
		});
		let originalHTMLFormElement = globalThis.HTMLFormElement;
		let originalHTMLButtonElement = globalThis.HTMLButtonElement;
		let originalFormData = globalThis.FormData;

		class TestFormElement {
			action = "http://localhost/album/14/photos/651/like";
			method = "post";
			enctype = "application/x-www-form-urlencoded";
			target = "";
			listener: ((event: SubmitEvent) => void) | undefined;

			addEventListener(_type: string, listener: (event: SubmitEvent) => void) {
				this.listener = listener;
			}

			removeEventListener(_type: string, listener: (event: SubmitEvent) => void) {
				if (this.listener === listener) this.listener = undefined;
			}
		}

		class TestButtonElement {
			form: TestFormElement;
			formAction = "http://localhost/album/14";
			formMethod = "";
			formEnctype = "";
			formTarget = "";

			constructor(form: TestFormElement) {
				this.form = form;
			}

			hasAttribute() {
				return false;
			}
		}

		class TestFormData {
			fields: [string, string][] = [["intent", "like"]];

			get(name: string) {
				return this.fields.find(([fieldName]) => fieldName === name)?.[1] ?? null;
			}

			*[Symbol.iterator]() {
				yield* this.fields;
			}
		}

		try {
			globalThis.HTMLFormElement = TestFormElement as never;
			globalThis.HTMLButtonElement = TestButtonElement as never;
			globalThis.FormData = TestFormData as never;

			let router = createRouter();
			let form = new TestFormElement();
			let submitter = new TestButtonElement(form);
			let insertListener: ((event: { node: TestFormElement }) => void) | undefined;
			let removeListener: (() => void) | undefined;

			router.map(routes.likePhoto, (ctx) => `like:${ctx.params.albumId}:${ctx.params.photoId}`);

			let fetcher = router.getFetcher<string>();
			let descriptor = fetcher.form() as unknown as {
				type(handle: unknown): (...args: unknown[]) => unknown;
				args: unknown[];
			};
			let apply = descriptor.type({
				element: form,
				addEventListener(type: string, listener: unknown) {
					if (type === "insert") insertListener = listener as typeof insertListener;
					if (type === "remove") removeListener = listener as typeof removeListener;
				},
			});
			let submitted = new Promise<void>((resolve) => {
				fetcher.addEventListener("change", () => {
					if (fetcher.state === "idle" && fetcher.data) resolve();
				});
			});
			let defaultPrevented = false;

			apply(...descriptor.args);
			insertListener?.({ node: form });
			form.listener?.({
				currentTarget: form,
				defaultPrevented: false,
				submitter,
				preventDefault() {
					defaultPrevented = true;
				},
			} as never);

			await submitted;

			expect(defaultPrevented).toBe(true);
			expect(fetcher.data).toBe("like:14:651");

			removeListener?.();

			expect(form.listener).toBeUndefined();
		} finally {
			globalThis.HTMLFormElement = originalHTMLFormElement;
			globalThis.HTMLButtonElement = originalHTMLButtonElement;
			globalThis.FormData = originalFormData;
		}
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
			reconcile() {},
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

	test("runs router, controller, and action middleware in order", async () => {
		let routes = route({
			admin: {
				show: "/admin/:id",
			},
		});
		let User = createContextKey<{ id: string }>();
		let calls: string[] = [];
		let router = createRouter({
			middleware: [
				async (ctx, next) => {
					calls.push("router:before");
					ctx.set(User, { id: "root" });
					let result = await next();
					calls.push("router:after");
					return result;
				},
			],
		});

		router.map(
			routes.admin,
			createController(routes.admin, {
				middleware: [
					(ctx, next) => {
						calls.push(`controller:${ctx.get(User)?.id}`);
						ctx.set(User, { id: "controller" });
						return next();
					},
				],
				actions: {
					show: {
						middleware: [
							(ctx, next) => {
								calls.push(`action:${ctx.params.id}`);
								return next();
							},
						],
						handler(ctx) {
							calls.push("handler");
							return `user:${ctx.get(User)?.id}`;
						},
					},
				},
			}),
		);

		expect(readProviderRender(await router.render("/admin/123")).children).toBe("user:controller");
		expect(calls).toEqual([
			"router:before",
			"controller:root",
			"action:123",
			"handler",
			"router:after",
		]);
	});

	test("middleware can short-circuit route actions", async () => {
		let routes = route({ secret: "/secret" });
		let router = createRouter();

		router.map(
			routes.secret,
			createAction(routes.secret, {
				middleware: [() => "blocked"],
				handler() {
					return "secret";
				},
			}),
		);

		expect(readProviderRender(await router.render("/secret")).children).toBe("blocked");
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
			reconcile() {},
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
			reconcile() {},
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
			reconcile() {},
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
			reconcile() {},
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
				},
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
		await new Promise((resolve) => setTimeout(resolve, 0));

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
			reconcile() {},
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
				},
				navigation: {
					navigate(url, options) {
						navigationOptions = options;
						visibleURL = url;

						let intercepted = Promise.resolve();
						let event = Object.assign(new Event("navigate"), {
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
						});

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

	test("mount configures frames to render router routes", async () => {
		let routes = route({ home: "/", sidebar: "/sidebar" });
		let rootOptions: VirtualRootOptions | undefined;
		let root: VirtualRoot = {
			addEventListener() {},
			removeEventListener() {},
			dispatchEvent() {
				return true;
			},
			render() {},
			reconcile() {},
			dispose() {},
			flush() {},
		};
		let router = createRouter({
			interceptLinks: false,
			getLocation() {
				return "http://localhost/";
			},
			createRoot(_container, options) {
				rootOptions = options;
				return root;
			},
		});

		router.map(routes.home, () => "home");
		router.map(routes.sidebar, (ctx) => `sidebar:${ctx.request.method}`);

		let mounted = router.mount({} as HTMLElement);
		let frameNode = await rootOptions?.frameInit?.resolveFrame("/sidebar");

		expect(rootOptions?.frameInit?.src).toBe("http://localhost/");
		expect(readProviderRender(frameNode as RemixNode).children).toBe("sidebar:GET");

		mounted.dispose();
	});

	test("preserves custom frame resolvers", async () => {
		let rootOptions: VirtualRootOptions | undefined;
		let root: VirtualRoot = {
			addEventListener() {},
			removeEventListener() {},
			dispatchEvent() {
				return true;
			},
			render() {},
			reconcile() {},
			dispose() {},
			flush() {},
		};
		let router = createRouter({
			interceptLinks: false,
			rootOptions: {
				frameInit: {
					src: "/custom",
					resolveFrame(src) {
						return `custom:${src}`;
					},
				},
			},
			createRoot(_container, options) {
				rootOptions = options;
				return root;
			},
		});

		let mounted = router.mount({} as HTMLElement);

		expect(await rootOptions?.frameInit?.resolveFrame("/frame")).toBe("custom:/frame");

		mounted.dispose();
	});
});

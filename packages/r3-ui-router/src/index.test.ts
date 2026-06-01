import { describe, expect, test } from "bun:test";

import type { RemixElement, RemixNode, VirtualRoot } from "remix/ui";

import { route } from "remix/routes";

import { createRouter, RouterProvider, type RouterProviderValue } from "./index";

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
});

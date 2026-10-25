/**
 * Tests the lazy frame against a real document: what the worker sends, the crossings that
 * load it or move the address bar, and the containers whose opening loads it. A layout
 * engine is the one thing this document lacks, so crossings are reported by hand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { RenderResult } from "remix/component/test";

import { http, HttpResponse } from "msw";
import { setupWorker } from "msw/browser";
import { renderToString } from "remix/component/server";
import { render } from "remix/component/test";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import { LazyFrame } from "./ui.js";

/** The band the frames report the reader's place through. */
const READING_BAND = "0px 0px -90% 0px";

/** Every observer the frames made, by the band each watches. */
const OBSERVED = new Map<
	string,
	{ callback: IntersectionObserverCallback; targets: Set<Element> }
>();

/** An observer that reports only the crossings a test announces through {@link cross}. */
class ReportedObserver {
	readonly targets = new Set<Element>();

	constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit = {}) {
		OBSERVED.set(options.rootMargin ?? "", { callback, targets: this.targets });
	}

	observe(target: Element): void {
		this.targets.add(target);
	}

	unobserve(target: Element): void {
		this.targets.delete(target);
	}

	disconnect(): void {
		this.targets.clear();
	}
}

/**
 * Reports `node` crossing into or out of the band `rootMargin` names, as the browser would.
 * A node that band's observer stopped watching hears nothing.
 */
function cross(rootMargin: string, node: Element, isIntersecting: boolean): void {
	let observed = OBSERVED.get(rootMargin);
	if (!observed?.targets.has(node)) return;
	let entry = { target: node, isIntersecting } as IntersectionObserverEntry;
	observed.callback([entry], {} as IntersectionObserver);
}

let mounted: RenderResult | undefined;

/** Mounts `node` with frames resolving to a paragraph naming the address asked for. */
function mount(node: RemixNode): RenderResult {
	mounted = render(node, {
		frameInit: { resolveFrame: async (src) => `<p data-loaded>${src}</p>` },
	});
	return mounted;
}

/** The frame's host, which is what the observers watch. */
function host(result: RenderResult): Element {
	let element = result.container.firstElementChild;
	if (element === null) throw new Error("nothing mounted");
	return element;
}

/** Waits for the frame's content to land, then returns what it holds. */
async function loaded(result: RenderResult): Promise<string | null | undefined> {
	await vi.waitFor(() => expect(result.$("[data-loaded]")).not.toBeNull());
	return result.$("[data-loaded]")?.textContent;
}

beforeAll(() => {
	vi.stubGlobal("IntersectionObserver", ReportedObserver);
});

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	history.replaceState(null, "", "/");
});

describe("on the server", () => {
	test("renders the children and names the island the browser loads", async () => {
		let html = await renderToString(
			<LazyFrame src="/posts?page=2">
				<a href="/posts?page=2">Older posts</a>
			</LazyFrame>,
		);

		expect(html).toContain('<a href="/posts?page=2">Older posts</a>');
		expect(html).toContain('"moduleUrl":"@sdxc/lazy-frame/ui"');
		expect(html).toContain('"exportName":"LazyFrame"');
	});
});

describe('loadOn="approach"', () => {
	test("keeps the children until the frame nears the viewport, then loads it", async () => {
		let result = mount(
			<LazyFrame src="/posts?page=2">
				<a href="/posts?page=2">Older posts</a>
			</LazyFrame>,
		);

		expect(result.$("a")?.textContent).toBe("Older posts");

		cross("320px 0px", host(result), false);
		expect(result.$("[data-loaded]")).toBeNull();

		cross("320px 0px", host(result), true);
		expect(await loaded(result)).toBe("/posts?page=2");
	});

	test("watches the band `rootMargin` names", async () => {
		let result = mount(<LazyFrame src="/article" rootMargin="100% 0px" />);

		cross("100% 0px", host(result), true);
		expect(await loaded(result)).toBe("/article");
	});

	test("waits for a frame above the content to be left and come back to", async () => {
		let result = mount(
			<LazyFrame src="/posts?page=1" sitsAbove>
				<a href="/posts?page=1">Newer posts</a>
			</LazyFrame>,
		);

		cross("320px 0px", host(result), true);
		await result.act(() => {});
		expect(result.$("[data-loaded]")).toBeNull();

		cross("320px 0px", host(result), false);
		cross("320px 0px", host(result), true);
		expect(await loaded(result)).toBe("/posts?page=1");
	});

	test("carries the page the reader is in in the address bar", async () => {
		let result = mount(
			<LazyFrame src="/posts?page=2&frame" url="/posts?page=2" parentUrl="/posts" />,
		);

		cross(READING_BAND, host(result), true);
		expect(location.pathname + location.search).toBe("/posts?page=2");

		cross(READING_BAND, host(result), false);
		expect(location.pathname + location.search).toBe("/posts");
	});

	test("leaves the address bar alone without both addresses", () => {
		let result = mount(<LazyFrame src="/posts?page=2&frame" url="/posts?page=2" />);

		cross(READING_BAND, host(result), true);
		expect(location.pathname + location.search).toBe("/");
	});
});

describe('loadOn="open"', () => {
	test("loads the first time the dialog around it opens", async () => {
		let result = mount(
			<dialog>
				<LazyFrame src="/jobs/1" loadOn="open" fallback="Loading">
					<a href="/jobs/1">Read</a>
				</LazyFrame>
			</dialog>,
		);

		let dialog = result.$("dialog") as HTMLDialogElement;
		expect(result.$("a")?.textContent).toBe("Read");

		dialog.dispatchEvent(new Event("toggle"));
		await result.act(() => {});
		expect(result.$("[data-loaded]")).toBeNull();

		dialog.showModal();
		dialog.dispatchEvent(new Event("toggle"));
		expect(await loaded(result)).toBe("/jobs/1");
	});

	test("loads at once inside a disclosure that is already open", async () => {
		let result = mount(
			<details open>
				<summary>More</summary>
				<LazyFrame src="/more" loadOn="open" />
			</details>,
		);

		expect(await loaded(result)).toBe("/more");
	});

	test("turns the opener link into the dialog's control", async () => {
		let result = mount(
			<div>
				<a id="job-1" href="/jobs/1">
					Open
				</a>
				<dialog>
					<LazyFrame src="/jobs/1" loadOn="open" opener="job-1" />
				</dialog>
			</div>,
		);

		let click = new MouseEvent("click", { bubbles: true, cancelable: true });
		result.$("#job-1")?.dispatchEvent(click);

		expect(click.defaultPrevented).toBe(true);
		expect((result.$("dialog") as HTMLDialogElement).open).toBe(true);
	});

	test("keeps the children outside any container", async () => {
		let result = mount(
			<LazyFrame src="/jobs/1" loadOn="open">
				<a href="/jobs/1">Read</a>
			</LazyFrame>,
		);

		await result.act(() => {});
		expect(result.$("a")?.textContent).toBe("Read");
		expect(result.$("[data-loaded]")).toBeNull();
	});
});

/** Where the runtime can intercept navigations, which is where it fetches frames ahead. */
class InterceptableNavigateEvent extends Event {
	get sourceElement(): Element | null {
		return null;
	}
}

describe("prefetch", () => {
	/**
	 * Every request for a frame source, in the order it arrived. Each test mounts its own
	 * source, so a request one test started that lands during the next is told apart.
	 */
	let fetched: Array<{ path: string; headers: Headers }> = [];

	/** How many openers this suite has mounted, which numbers each one's source. */
	let mounts = 0;

	let worker = setupWorker(
		http.get("*/jobs/:id", ({ request }) => {
			fetched.push({ path: new URL(request.url).pathname, headers: request.headers });
			return HttpResponse.html("<p>Job</p>");
		}),
	);

	beforeAll(async () => {
		await worker.start({ onUnhandledRequest: "bypass", quiet: true });
		vi.stubGlobal("navigation", new EventTarget());
		vi.stubGlobal("NavigateEvent", InterceptableNavigateEvent);
	});

	afterEach(() => {
		fetched = [];
		Reflect.deleteProperty(navigator, "connection");
	});

	afterAll(() => worker.stop());

	/**
	 * Mounts a dialog its opener opens, fetching its frame ahead as `prefetch` says, under a
	 * source no other test uses.
	 */
	function mountOpener(prefetch: boolean): { opener: HTMLElement; src: string } {
		mounts += 1;
		let id = `job-${mounts}`;
		let src = `/jobs/${mounts}`;
		let result = mount(
			<div>
				<a id={id} href={src}>
					Open
				</a>
				<dialog>
					<LazyFrame src={src} loadOn="open" opener={id} prefetch={prefetch} />
				</dialog>
			</div>,
		);
		return { opener: result.$(`#${id}`) as HTMLElement, src };
	}

	/** The headers of each request for `src` so far, with every other source's requests left out. */
	function requestsFor(src: string): Headers[] {
		return fetched.filter((request) => request.path === src).map((request) => request.headers);
	}

	/** Lets `ms` pass on the real clock the intent delay runs on. */
	function pause(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/** Moves a mouse onto or off `opener`. */
	function point(opener: Element, type: "pointerover" | "pointerout"): void {
		opener.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: "mouse" }));
	}

	test("fetches the frame ahead once a mouse rests on the opener", async () => {
		let { opener, src } = mountOpener(true);

		point(opener, "pointerover");
		expect(requestsFor(src)).toHaveLength(0);

		await vi.waitFor(() => expect(requestsFor(src)).toHaveLength(1));
		expect(requestsFor(src)[0]?.get("accept")).toBe("text/html");
		expect(requestsFor(src)[0]?.get("x-remix-frame")).toBe("true");
	});

	test("skips a mouse that leaves before the delay", async () => {
		let { opener, src } = mountOpener(true);

		point(opener, "pointerover");
		point(opener, "pointerout");
		await pause(150);

		expect(requestsFor(src)).toHaveLength(0);
	});

	test("fetches ahead once focus rests on the opener", async () => {
		let { opener, src } = mountOpener(true);

		opener.focus();

		await vi.waitFor(() => expect(requestsFor(src)).toHaveLength(1));
	});

	test("fetches at once on a press, and once per opener", async () => {
		let { opener, src } = mountOpener(true);

		opener.dispatchEvent(
			new PointerEvent("pointerdown", { bubbles: true, button: 0, isPrimary: true }),
		);
		await vi.waitFor(() => expect(requestsFor(src)).toHaveLength(1));

		opener.focus();
		await pause(150);
		expect(requestsFor(src)).toHaveLength(1);
	});

	test("leaves a visitor saving data alone", async () => {
		Object.defineProperty(navigator, "connection", {
			configurable: true,
			value: { saveData: true },
		});
		let { opener, src } = mountOpener(true);

		opener.focus();
		await pause(150);

		expect(requestsFor(src)).toHaveLength(0);
	});

	test("fetches nothing ahead unless asked", async () => {
		let { opener, src } = mountOpener(false);

		opener.focus();
		point(opener, "pointerover");
		await pause(150);

		expect(requestsFor(src)).toHaveLength(0);
	});
});

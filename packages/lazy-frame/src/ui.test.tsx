// @vitest-environment happy-dom

/**
 * Tests the lazy frame against a real document: what the server sends, the crossings that
 * load it or move the address bar, and the containers whose opening loads it. A layout
 * engine is the one thing this document lacks, so crossings are reported by hand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { RenderResult } from "remix/component/test";

import { renderToString } from "remix/component/server";
import { render } from "remix/component/test";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

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

	/**
	 * This document's stylesheet parser rejects the cascade layers mixins write into; no
	 * assertion here reads a style, so the rules are accepted and dropped.
	 */
	vi.spyOn(CSSStyleSheet.prototype, "insertRule").mockImplementation(() => 0);
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

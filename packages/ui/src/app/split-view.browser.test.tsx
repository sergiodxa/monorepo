/**
 * Drives SplitView in a real browser: three panes from 64rem with a remembered split, the
 * sidebar as a rail when collapsed and a sheet below 64rem, one pane per route below 48rem
 * with a back link, the empty detail slot, and j/k stepping while the list keeps its scroll.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, onTestFinished, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import {
	SPLIT_VIEW_ITEM_ATTRIBUTE,
	SplitView,
	SplitViewToggle,
	readSplitViewLayout,
} from "./split-view.js";

import "../reset.css";
import "../theme.css";

const LABELS: SplitView.Labels = {
	resizeSidebar: "Resize folders",
	resizeList: "Resize conversations",
	back: "Inbox",
};

/** Forty conversations, the twentieth selected. */
const CONVERSATIONS = Array.from({ length: 40 }, (_, index) => index + 1);

/** Props the test inbox takes. */
interface InboxProps {
	selected?: number;
	active?: SplitView.Pane;
	layout?: SplitView.Layout;
	sidebar?: boolean;
	keys?: "page" | "view";
}

/** An inbox: folders | conversations | conversation. */
function Inbox(handle: { props: InboxProps }) {
	return () => {
		let { selected, active, layout, sidebar = true, keys } = handle.props;

		return (
			<SplitView
				id="inbox"
				sidebar={
					sidebar ? (
						<nav aria-label="Folders">
							<SplitViewToggle viewId="inbox" pane="sidebar" label="Toggle folders" />
							<a href="#folder-open">Open</a>
						</nav>
					) : undefined
				}
				rail={<span data-testid="rail">R</span>}
				list={
					<ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
						{CONVERSATIONS.map((n) => (
							<li key={n}>
								<a
									href={`#sel-${n}`}
									{...{ [SPLIT_VIEW_ITEM_ATTRIBUTE]: "" }}
									aria-current={n === selected ? "page" : undefined}
									style={{ display: "block", height: "40px" }}
								>
									Conversation {n}
								</a>
							</li>
						))}
					</ul>
				}
				detail={selected ? <article>Conversation {selected}</article> : null}
				empty={<p>No conversation selected</p>}
				active={active}
				backHref="#inbox"
				layout={layout}
				keys={keys}
				labels={LABELS}
			/>
		);
	};
}

/** Every inbox mounted by the running test, unmounted after it so no listener outlives it. */
let mounted: RenderResult[] = [];

/** Mounts the inbox in a host `width` × 600 pixels. */
function mount(props: InboxProps, width = 1280): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	host.style.height = "600px";
	document.body.appendChild(host);
	mounted.push(render(<Inbox {...props} />, { container: host }));
	return host;
}

/** A pane by name. */
function pane(name: SplitView.Pane): HTMLElement {
	return document.getElementById(`inbox-${name}`)!;
}

/** Whether `element` takes up room on the page. */
function shown(element: Element | null): boolean {
	return element !== null && element.getClientRects().length > 0;
}

/** The divider before `name`. */
function divider(name: "sidebar" | "list"): HTMLElement {
	return document.querySelector<HTMLElement>(`[data-resizable-handle][data-pane="${name}"]`)!;
}

beforeEach(async () => {
	await page.viewport(1400, 800);
});

/** Unmounts every inbox mounted so far and empties the page. */
function unmount(): void {
	for (let result of mounted) result.cleanup();
	mounted = [];
	document.body.replaceChildren();
}

afterEach(() => {
	unmount();
	document.cookie = "ui-split-view=; path=/; max-age=0";
	history.replaceState(null, "", location.pathname + location.search);
	sessionStorage.clear();
});

describe("SplitView", () => {
	test("sets sidebar, list and detail side by side at their default widths", () => {
		mount({ selected: 3 });
		let [sidebar, list, detail] = (["sidebar", "list", "detail"] as const).map((name) =>
			pane(name).getBoundingClientRect(),
		);

		expect(sidebar!.width).toBeCloseTo(256, 0);
		expect(list!.width).toBeCloseTo(320, 0);
		expect(list!.left).toBeGreaterThanOrEqual(sidebar!.right);
		expect(detail!.left).toBeGreaterThanOrEqual(list!.right);
		expect(detail!.right).toBeCloseTo(1280, 0);
		expect(divider("sidebar").getAttribute("role")).toBe("separator");
		expect(divider("list").getAttribute("aria-label")).toBe("Resize conversations");
	});

	test("draws the remembered split from the cookie's layout", () => {
		let layout = readSplitViewLayout("theme=dark; ui-split-view=20%3A30%3A")!;
		mount({ selected: 3, layout });
		let group = pane("list").parentElement!.getBoundingClientRect();

		expect(layout).toEqual({ sidebar: 20, list: 30, collapsed: [] });
		expect(pane("sidebar").getBoundingClientRect().width).toBeCloseTo(group.width * 0.2, 0);
		expect(pane("list").getBoundingClientRect().width).toBeCloseTo(group.width * 0.3, 0);
	});

	test("persists a divider moved from the keyboard", async () => {
		mount({ selected: 3 });
		let before = pane("list").getBoundingClientRect().width;

		divider("list").focus();
		await userEvent.keyboard("{ArrowRight}");

		let after = pane("list").getBoundingClientRect().width;
		expect(after - before).toBeCloseTo(1280 * 0.02, -1);
		let stored = readSplitViewLayout(document.cookie)!;
		expect(stored.list).toBeCloseTo((after / 1280) * 100, 0);
		expect(stored.sidebar).toBeCloseTo((256 / 1280) * 100, 0);
	});

	test("persists a divider dragged with the pointer", async () => {
		mount({ selected: 3 });
		let handle = divider("list").getBoundingClientRect();
		let x = handle.left + handle.width / 2;
		let y = handle.top + 100;

		let node = divider("list");
		let pointer = {
			pointerId: 1,
			isPrimary: true,
			button: 0,
			buttons: 1,
			bubbles: true,
			clientY: y,
		};
		node.dispatchEvent(new PointerEvent("pointerdown", { ...pointer, clientX: x }));
		node.dispatchEvent(new PointerEvent("pointermove", { ...pointer, clientX: x + 64 }));
		node.dispatchEvent(new PointerEvent("pointerup", { ...pointer, buttons: 0, clientX: x + 64 }));

		expect(pane("list").getBoundingClientRect().width).toBeCloseTo(384, -1);
		expect(readSplitViewLayout(document.cookie)!.list).toBeCloseTo(30, 0);
	});

	test("snaps a collapsed sidebar to its rail", () => {
		mount({ selected: 3, layout: { collapsed: ["sidebar"] } });

		expect(pane("sidebar").getBoundingClientRect().width).toBeCloseTo(52, 0);
		expect(shown(document.querySelector('[data-testid="rail"]'))).toBe(true);
		expect(shown(pane("sidebar").querySelector("nav"))).toBe(false);
		expect(shown(divider("sidebar"))).toBe(false);
	});

	test("collapses the sidebar to its rail from its toggle, and remembers it", async () => {
		mount({ selected: 3 });
		let toggle = document.querySelector<HTMLButtonElement>('[data-split-view-toggle="inbox"]')!;

		await userEvent.click(toggle);

		expect(pane("sidebar").getBoundingClientRect().width).toBeCloseTo(52, 0);
		expect(pane("sidebar").matches(":popover-open")).toBe(false);
		expect(readSplitViewLayout(document.cookie)!.collapsed).toEqual(["sidebar"]);
	});

	test("collapses the pane before a divider on Enter", async () => {
		mount({ selected: 3 });
		divider("list").focus();
		await userEvent.keyboard("{Enter}");

		expect(shown(pane("list"))).toBe(false);
		expect(pane("detail").getBoundingClientRect().left).toBeCloseTo(
			pane("sidebar").getBoundingClientRect().right,
			-1,
		);
	});

	test("keeps three panes at 1024px and turns the sidebar into a sheet below it", async () => {
		mount({ selected: 3 }, 1024);
		expect(shown(pane("sidebar"))).toBe(true);
		unmount();

		let host = mount({ selected: 3 }, 1000);
		expect(shown(pane("sidebar"))).toBe(false);
		expect(shown(divider("sidebar"))).toBe(false);
		expect(pane("list").getBoundingClientRect().left).toBeCloseTo(
			host.getBoundingClientRect().left,
			0,
		);
		expect(shown(pane("detail"))).toBe(true);

		pane("sidebar").showPopover();
		let sheet = pane("sidebar").getBoundingClientRect();
		expect(sheet.left).toBe(0);
		expect(sheet.width).toBeCloseTo(288, 0);
		expect(sheet.height).toBe(window.innerHeight);
	});

	test("closes the sidebar sheet when one of its links is followed", async () => {
		mount({ selected: 3 }, 1000);
		pane("sidebar").showPopover();
		await userEvent.click(pane("sidebar").querySelector("a")!);

		expect(pane("sidebar").matches(":popover-open")).toBe(false);
	});

	test("keeps list and detail at 768px and shows one pane per route below it", () => {
		mount({ selected: 3 }, 768);
		expect(shown(pane("list"))).toBe(true);
		expect(shown(pane("detail"))).toBe(true);
		expect(shown(document.querySelector('[data-slot="split-view-back"]'))).toBe(false);
		unmount();

		mount({ selected: 3 }, 760);
		expect(shown(pane("list"))).toBe(false);
		expect(pane("detail").getBoundingClientRect().width).toBeCloseTo(760, 0);
		let back = document.querySelector<HTMLAnchorElement>('[data-slot="split-view-back"]')!;
		expect(shown(back)).toBe(true);
		expect(back.getAttribute("href")).toBe("#inbox");
		unmount();

		mount({ active: "list" }, 760);
		expect(shown(pane("detail"))).toBe(false);
		expect(pane("list").getBoundingClientRect().width).toBeCloseTo(760, 0);
	});

	test("fits a phone without scrolling the page sideways", async () => {
		await page.viewport(375, 812);
		mount({ selected: 3 }, 375);

		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
		expect(pane("detail").getBoundingClientRect().width).toBeCloseTo(375, 0);
	});

	test("fills the detail pane with the empty slot while nothing is selected", () => {
		mount({});
		let empty = pane("detail").querySelector('[data-slot="split-view-empty"]')!;

		expect(empty.textContent).toBe("No conversation selected");
		expect(empty.getBoundingClientRect().height).toBeGreaterThan(400);
	});

	test("lays out list and detail alone without a sidebar", () => {
		mount({ selected: 3, sidebar: false });

		expect(document.getElementById("inbox-sidebar")).toBeNull();
		expect(pane("list").getBoundingClientRect().left).toBeCloseTo(0, 0);
		expect(pane("detail").getBoundingClientRect().right).toBeCloseTo(1280, 0);
	});

	test("steps the selection with j and k while the list keeps its scroll", async () => {
		mount({ selected: 20 });
		let list = pane("list");
		list.scrollTop = 500;
		let scrolled = list.scrollTop;

		await userEvent.keyboard("j");
		expect(location.hash).toBe("#sel-21");
		expect(list.querySelector('[aria-current="page"]')?.textContent).toBe("Conversation 21");
		expect(list.scrollTop).toBe(scrolled);

		await userEvent.keyboard("k");
		await userEvent.keyboard("k");
		expect(location.hash).toBe("#sel-19");
		expect(list.scrollTop).toBe(scrolled);
	});

	test("puts the highlight back on the open item when the next one fails to load", async () => {
		mount({ selected: 20 });
		let list = pane("list");
		let marked = () => [...list.querySelectorAll("[aria-current]")].map((item) => item.textContent);
		let controller = new AbortController();
		onTestFinished(() => controller.abort());
		navigation.addEventListener(
			"navigate",
			(event) => event.intercept({ handler: () => Promise.reject(new Error("Offline")) }),
			{ signal: controller.signal },
		);

		await userEvent.keyboard("j");
		await userEvent.keyboard("j");

		await expect.poll(marked).toEqual(["Conversation 20"]);
	});

	test("answers j and k only from inside the view when scoped to it", async () => {
		mount({ selected: 3, keys: "view" });

		await userEvent.keyboard("j");
		expect(location.hash).toBe("");

		pane("list").querySelector<HTMLAnchorElement>('[aria-current="page"]')!.focus();
		await userEvent.keyboard("j");
		expect(location.hash).toBe("#sel-4");
	});
});

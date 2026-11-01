/**
 * Follows the reader through a page for an "On this page" list: marks every section on
 * screen, slides one marker over them, names the section being read and keeps it in view
 * inside a scrolling rail. The links stay plain anchors, so the list works before it loads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

import { revealInScroller } from "../utils/reveal-in-scroller.js";

/**
 * One list link and the heading it points at. A section runs from its heading to the next
 * heading in the list, so the last one runs to the end of the page.
 */
interface Section {
	link: HTMLAnchorElement;
	heading: Element;
}

/**
 * Watches the headings that the host's `a[href^="#"]` links point at. On every settled
 * scroll and resize it sets `data-active` on each link whose section is on screen
 * (`"lead"` on the first), moves the `[data-toc-marker]` element over them through
 * `--toc-marker-start` / `--toc-marker-size`, and on the closest `[data-toc]` writes the lead's
 * text into `[data-toc-reading]` and sets `--toc-progress` (0–1) for a progress ring. The top edge a section must pass is
 * the first heading's `scroll-margin-top`, so it matches where a jump to that heading lands.
 * A link followed inside a `<details>` closes it, so the section is not hidden under the list.
 *
 * @example
 * <nav><ul mix={[tocSpy()]}><li><a href="#install">Install</a></li></ul></nav>
 */
export const tocSpy: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
	HTMLElement,
	[],
	ElementProps
>((handle) => {
	let controller: AbortController | undefined;

	handle.addEventListener("insert", (event) => {
		controller?.abort();
		controller = new AbortController();
		watch(event.node, controller.signal);
	});

	handle.addEventListener("remove", () => {
		controller?.abort();
		controller = undefined;
	});
});

/**
 * Starts following the page for `host` until `signal` aborts. The sections are read again on
 * every recount, so a client-side navigation that keeps this list (new links, or new headings
 * under the same ids) is followed from its first scroll, and a page with none yet still arms.
 */
function watch(host: HTMLElement, signal: AbortSignal) {
	let view = host.ownerDocument.defaultView;
	if (!view) return;

	let frame = 0;

	/** One recount per frame, however many events the frame delivers. */
	function schedule() {
		view?.cancelAnimationFrame(frame);
		frame = view?.requestAnimationFrame(() => update(host)) ?? 0;
	}

	view.addEventListener("scroll", schedule, { passive: true, signal });
	view.addEventListener("resize", schedule, { passive: true, signal });
	view.addEventListener("hashchange", schedule, { signal });
	view.navigation?.addEventListener("navigatesuccess", schedule, { signal });
	host.closest("details")?.addEventListener("toggle", schedule, { signal });
	host.addEventListener("click", (click) => closeOnJump(host, click), { signal });

	let links = new MutationObserver(schedule);
	links.observe(host, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ["href"],
	});
	signal.addEventListener(
		"abort",
		() => {
			view?.cancelAnimationFrame(frame);
			links.disconnect();
		},
		{ once: true },
	);

	update(host);
	host.dataset.tocReady = "";
}

/** Pairs every in-page link inside `host` with the heading it points at, in list order. */
function collectSections(host: HTMLElement): Section[] {
	let sections: Section[] = [];
	for (let link of host.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
		let id = decodeURIComponent(link.hash.slice(1));
		let heading = id ? host.ownerDocument.getElementById(id) : null;
		if (heading) sections.push({ link, heading });
	}
	return sections;
}

/**
 * The indexes of the sections on screen. A reader scrolled to the bottom of the page is
 * credited with the last section even when its heading never reached the top edge.
 */
export function sectionsInView(
	starts: number[],
	viewport: { top: number; bottom: number },
	atBottom: boolean,
): number[] {
	let visible: number[] = [];
	for (let index = 0; index < starts.length; index++) {
		let start = starts[index]!;
		let end = starts[index + 1] ?? Number.POSITIVE_INFINITY;
		if (end > viewport.top + 1 && start < viewport.bottom) visible.push(index);
	}
	let last = starts.length - 1;
	if (atBottom && last >= 0 && !visible.includes(last)) visible.push(last);
	return visible;
}

/** Reads the list's sections afresh, works out which are on screen and moves the marks to match. */
function update(host: HTMLElement) {
	let sections = collectSections(host);
	let root = host.ownerDocument.documentElement;
	let first = sections[0]?.heading;
	let top = first ? Number.parseFloat(getComputedStyle(first).scrollMarginTop) || 0 : 0;
	let starts = sections.map((section) => section.heading.getBoundingClientRect().top);
	let atBottom =
		root.scrollHeight > root.clientHeight &&
		root.scrollTop + root.clientHeight >= root.scrollHeight - 2;
	let visible = sectionsInView(starts, { top, bottom: root.clientHeight }, atBottom);
	let lead = visible[0];

	for (let link of host.querySelectorAll<HTMLAnchorElement>("a[data-active]")) {
		if (!sections.some((section) => section.link === link)) link.removeAttribute("data-active");
	}
	for (let [index, section] of sections.entries()) {
		if (index === lead) section.link.dataset.active = "lead";
		else if (visible.includes(index)) section.link.dataset.active = "";
		else section.link.removeAttribute("data-active");
	}

	moveMarker(host, sections, visible);

	let scope = host.closest<HTMLElement>("[data-toc]") ?? host;
	let reading = scope.querySelector<HTMLElement>("[data-toc-reading]");
	let progressHost = scope;
	if (lead === undefined) {
		if (reading) reading.textContent = "";
		progressHost.style.setProperty("--toc-progress", "0");
		return;
	}

	let leadSection = sections[lead]!;
	if (reading) reading.textContent = leadSection.link.textContent ?? "";
	progressHost.style.setProperty("--toc-progress", String((lead + 1) / sections.length));
	revealInScroller(leadSection.link);
}

/**
 * Stretches the marker from the first marked link to the last, measured against the
 * marker's offset parent so the list's own padding and scroll position never skew it.
 */
function moveMarker(host: HTMLElement, sections: Section[], visible: number[]) {
	let marker = host.querySelector<HTMLElement>("[data-toc-marker]");
	if (!marker) return;
	let firstIndex = visible[0];
	let lastIndex = visible.at(-1);
	if (firstIndex === undefined || lastIndex === undefined) {
		marker.style.setProperty("--toc-marker-size", "0px");
		return;
	}
	let first = sections[firstIndex]!.link;
	let last = sections[lastIndex]!.link;
	let start = first.offsetTop;
	let size = last.offsetTop + last.offsetHeight - start;
	marker.style.setProperty("--toc-marker-start", `${start}px`);
	marker.style.setProperty("--toc-marker-size", `${size}px`);
}

/** Closes the `<details>` around the list once one of its links is followed. */
function closeOnJump(host: HTMLElement, click: MouseEvent) {
	if (!(click.target instanceof Element) || !click.target.closest("a[href]")) return;
	let details = host.closest("details");
	if (details) details.open = false;
}

/**
 * Renders the video catalogue pieces in a real browser: a card's link, art frame, badge and
 * watched bar; a shelf that scrolls sideways and pages with its buttons once its island runs;
 * and an episode list that sets its still beside the text when wide and above it when narrow.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { EpisodeList } from "./episode-list.js";
import { VideoCard, clampProgress } from "./video-card.js";
import { VideoShelf } from "./video-shelf.js";

import "../reset.css";
import "../theme.css";

/** A flat block of colour standing in for artwork. */
function Art() {
	return () => <span style={{ background: "rgb(40 30 60)" }} />;
}

/** Mounts `node` in a host `width` pixels wide and returns the host. */
function mount(width: number, node: JSX.Element): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	render(node, { container: host });
	return host;
}

/** Waits until `check` passes or a second goes by. */
async function until(check: () => boolean): Promise<void> {
	let deadline = performance.now() + 1000;
	while (!check() && performance.now() < deadline) {
		await new Promise((resolve) => setTimeout(resolve, 16));
	}
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("VideoCard", () => {
	test("is one link named by its title, with the art at the shape's proportions", () => {
		let host = mount(
			320,
			<VideoCard
				href="/title/tidewater"
				title="Tidewater"
				art={<Art />}
				meta="S1 · E3 · 44 min"
				badge="New"
				progress={0.4}
				progressLabel="40% watched"
			/>,
		);
		let link = host.querySelector("a")!;
		expect(link.getAttribute("href")).toBe("/title/tidewater");
		expect(link.textContent).toContain("Tidewater");
		expect(link.textContent).toContain("40% watched");
		let art = host.querySelector<HTMLElement>("[data-slot=video-card-art]")!;
		let box = art.getBoundingClientRect();
		expect(box.width / box.height).toBeCloseTo(16 / 9, 1);
		let fill = host.querySelector<HTMLElement>("[data-slot=video-card-progress] > span")!;
		expect(fill.getBoundingClientRect().width).toBeCloseTo(box.width * 0.4, 0);
		expect(host.querySelector("[data-slot=video-card-badge]")?.textContent).toBe("New");
	});

	test("sets the badge at the foot of the art when asked, clear of the watched bar", () => {
		let host = mount(
			320,
			<VideoCard
				href="/title/tidewater"
				title="Tidewater"
				art={<Art />}
				badge="New season"
				badgePlacement="bottom"
				progress={0.5}
				progressLabel="50% watched"
			/>,
		);
		let art = host.querySelector("[data-slot=video-card-art]")!.getBoundingClientRect();
		let badge = host.querySelector("[data-slot=video-card-badge]")!.getBoundingClientRect();
		let bar = host.querySelector("[data-slot=video-card-progress]")!.getBoundingClientRect();
		expect(badge.bottom).toBeLessThan(bar.top);
		expect(badge.top).toBeGreaterThan(art.top + art.height / 2);
	});

	test("draws a poster at 2:3 and leaves the bar out without progress", () => {
		let host = mount(
			200,
			<VideoCard shape="poster" href="/title/ember" title="Ember Line" art={<Art />} />,
		);
		let box = host.querySelector("[data-slot=video-card-art]")!.getBoundingClientRect();
		expect(box.width / box.height).toBeCloseTo(2 / 3, 1);
		expect(host.querySelector("[data-slot=video-card-progress]")).toBeNull();
	});

	test("clamps a share outside 0–1", () => {
		expect(clampProgress(1.4)).toBe(1);
		expect(clampProgress(-2)).toBe(0);
		expect(clampProgress(Number.NaN)).toBe(0);
	});
});

/** A shelf of `count` landscape cards. */
function Shelf(handle: Handle<{ count: number }>) {
	return () => (
		<VideoShelf
			id="trending"
			title="Trending now"
			action={<a href="/trending">See all</a>}
			labels={{ previous: "Previous titles", next: "Next titles" }}
		>
			{Array.from({ length: handle.props.count }, (_, index) => (
				<VideoShelf.Item>
					<VideoCard href={`/title/${index}`} title={`Title ${index}`} art={<Art />} />
				</VideoShelf.Item>
			))}
		</VideoShelf>
	);
}

describe("VideoShelf", () => {
	test("names its region by its heading and keeps every card on one row", () => {
		let host = mount(800, <Shelf count={8} />);
		let section = host.querySelector("section")!;
		let heading = host.querySelector("h2")!;
		expect(heading.textContent).toBe("Trending now");
		expect(section.getAttribute("aria-labelledby")).toBe(heading.id);
		let items = [...host.querySelectorAll("[data-slot=video-shelf-item]")];
		let tops = new Set(items.map((item) => Math.round(item.getBoundingClientRect().top)));
		expect(tops.size).toBe(1);
		let scroller = host.querySelector<HTMLElement>("[data-slot=video-shelf-scroller]")!;
		expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
	});

	test("reveals its paging buttons and steps forward and back a screenful", async () => {
		let host = mount(800, <Shelf count={10} />);
		let scroller = host.querySelector<HTMLElement>("[data-slot=video-shelf-scroller]")!;
		let previous = host.querySelector<HTMLButtonElement>("[aria-label='Previous titles']")!;
		let next = host.querySelector<HTMLButtonElement>("[aria-label='Next titles']")!;
		await until(() => !next.hidden);
		expect(next.hidden).toBe(false);
		expect(previous.disabled).toBe(true);
		scroller.style.scrollBehavior = "auto";
		next.click();
		await until(() => scroller.scrollLeft > 0);
		expect(scroller.scrollLeft).toBeGreaterThan(scroller.clientWidth / 2);
		await until(() => !previous.disabled);
		expect(previous.disabled).toBe(false);
		scroller.scrollLeft = scroller.scrollWidth;
		await until(() => next.disabled);
		expect(next.disabled).toBe(true);
	});

	test("keeps a card's hidden progress text inside the scroller, so the page never widens", () => {
		let host = mount(
			360,
			<VideoShelf id="resume" title="Continue watching" labels={{ previous: "Back", next: "More" }}>
				{Array.from({ length: 6 }, (_, index) => (
					<VideoShelf.Item>
						<VideoCard
							href={`/watch/${index}`}
							title={`Title ${index}`}
							art={<Art />}
							progress={0.5}
							progressLabel="50% watched"
						/>
					</VideoShelf.Item>
				))}
			</VideoShelf>,
		);
		host.style.overflow = "visible";
		for (let label of host.querySelectorAll("[data-slot=video-card] > span:last-child > span")) {
			expect(label.getBoundingClientRect().right).toBeLessThanOrEqual(
				label.closest("[data-slot=video-card]")!.getBoundingClientRect().right + 1,
			);
		}
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
	});

	test("leaves no paging button when every card fits", async () => {
		let host = mount(1400, <Shelf count={2} />);
		let next = host.querySelector<HTMLButtonElement>("[aria-label='Next titles']")!;
		await until(() => !next.hidden);
		expect(next.disabled).toBe(true);
	});
});

/** A two-episode season. */
function Season() {
	return () => (
		<EpisodeList aria-label="Season 1">
			<EpisodeList.Item
				href="/watch/1"
				number={1}
				title="Low Tide"
				still={<Art />}
				duration="52 min"
				synopsis="The ferry runs late, and nobody aboard admits why."
				progress={1}
				progressLabel="Watched"
			/>
			<EpisodeList.Item
				href="/watch/2"
				number={2}
				title="The Breakwater"
				still={<Art />}
				duration="47 min"
				current
			/>
		</EpisodeList>
	);
}

describe("EpisodeList", () => {
	test("is an ordered list of links, marking the current episode", () => {
		let host = mount(900, <Season />);
		expect(host.querySelector("ol")?.getAttribute("aria-label")).toBe("Season 1");
		let links = [...host.querySelectorAll("a")];
		expect(links.map((link) => link.getAttribute("href"))).toEqual(["/watch/1", "/watch/2"]);
		expect(links[1]?.getAttribute("aria-current")).toBe("true");
		expect(links[0]?.textContent).toContain("Watched");
	});

	test("sets the still beside the synopsis when wide and the synopsis under it when narrow", () => {
		let wide = mount(900, <Season />);
		let still = wide.querySelector("[data-slot=episode-still]")!.getBoundingClientRect();
		let title = wide.querySelector("[data-slot=episode-title]")!.getBoundingClientRect();
		expect(title.left).toBeGreaterThan(still.right);
		document.body.replaceChildren();
		let narrow = mount(360, <Season />);
		let narrowStill = narrow.querySelector("[data-slot=episode-still]")!.getBoundingClientRect();
		let synopsis = narrow.querySelector("a")!.lastElementChild!.getBoundingClientRect();
		expect(synopsis.top).toBeGreaterThanOrEqual(narrowStill.bottom);
		expect(narrow.scrollWidth).toBeLessThanOrEqual(360);
	});
});

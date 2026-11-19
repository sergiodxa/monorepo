/**
 * Renders the music kit in a real browser: a track table whose playing row shows its mark and
 * whose play button covers the row, narrowing to number, title and length; a tile whose play
 * button sits outside its link; the player bar's ranges and toggles; and the queue.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { Equalizer } from "./equalizer.js";
import { MediaTile } from "./media-tile.js";
import { PlayerBar } from "./player-bar.js";
import { QueueList } from "./queue-list.js";
import { TrackList } from "./track-list.js";

import "../reset.css";
import "../theme.css";

/** The table's strings. */
const LABELS: TrackList.Labels = {
	index: "#",
	title: "Title",
	album: "Album",
	added: "Date added",
	duration: "Duration",
	playing: "Now playing",
};

/** Mounts `node` in a host `width` pixels wide and returns the host. */
function mount(width: number, node: JSX.Element): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	render(node, { container: host });
	return host;
}

/** A small table of three tracks, the second playing. */
function Tracks() {
	return () => (
		<TrackList labels={LABELS} columns={{ album: true, added: true }}>
			{["Salt Glass", "Harbor Bells", "The Long Pier"].map((title, index) => (
				<TrackList.Row
					index={index + 1}
					title={title}
					artists={<a href="#artist">Lumen Harbor</a>}
					album={<a href="#album">Tidelight</a>}
					added="3 days ago"
					duration={178 + index}
					current={index === 1}
					play={<TrackList.PlayButton type="button" aria-label={`Play ${title}`} />}
				/>
			))}
		</TrackList>
	);
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("TrackList", () => {
	test("marks the playing row with its equalizer in place of the number", () => {
		let host = mount(900, <Tracks />);
		let rows = [...host.querySelectorAll("tbody tr")];
		let playing = rows[1]!;
		expect(playing.getAttribute("aria-current")).toBe("true");
		expect(getComputedStyle(playing.querySelector("[data-slot=track-list-index]")!).display).toBe(
			"none",
		);
		expect(
			getComputedStyle(playing.querySelector("[data-slot=track-list-playing]")!).display,
		).not.toBe("none");
		expect(
			getComputedStyle(rows[0]!.querySelector("[data-slot=track-list-playing]")!).display,
		).toBe("none");
		expect(rows[0]!.querySelector("[data-cell=duration]")?.textContent).toBe("2:58");
	});

	test("stacks the play button over the number, and its hit area covers the whole row", () => {
		let host = mount(900, <Tracks />);
		let row = host.querySelector("tbody tr")!;
		let button = row.querySelector("[data-slot=track-list-play]")!;
		let index = row.querySelector("[data-slot=track-list-index]")!;
		let rowBox = row.getBoundingClientRect();
		let hitBox = document.elementFromPoint(
			Math.min(rowBox.left + 200, innerWidth - 4),
			rowBox.top + rowBox.height / 2,
		);
		expect(
			Math.abs(button.getBoundingClientRect().top - index.getBoundingClientRect().top),
		).toBeLessThan(8);
		expect(hitBox === button || button.contains(hitBox)).toBe(true);
		let link = row.querySelector<HTMLElement>("[data-cell=album] a")!;
		let linkBox = link.getBoundingClientRect();
		expect(document.elementFromPoint(linkBox.left + 2, linkBox.top + linkBox.height / 2)).toBe(
			link,
		);
	});

	test("drops the album and date columns and the heading row in a narrow box", () => {
		let host = mount(360, <Tracks />);
		expect(getComputedStyle(host.querySelector("thead")!).display).toBe("none");
		expect(getComputedStyle(host.querySelector("td[data-cell=album]")!).display).toBe("none");
		expect(getComputedStyle(host.querySelector("td[data-cell=added]")!).display).toBe("none");
		expect(host.scrollWidth).toBeLessThanOrEqual(360);
	});
});

describe("Equalizer", () => {
	test("bounces while playing and holds still inside a paused ancestor", () => {
		let host = mount(
			200,
			<div>
				<Equalizer label="Now playing" />
				<div data-audio-paused="">
					<Equalizer label="Paused" />
				</div>
			</div>,
		);
		let [playing, paused] = [...host.querySelectorAll("[data-slot=equalizer] > [data-bar]")].filter(
			(_, index) => index === 0 || index === 4,
		);
		expect(getComputedStyle(playing!).animationPlayState).toBe("running");
		expect(getComputedStyle(paused!).animationPlayState).toBe("paused");
		expect(host.textContent).toContain("Now playing");
	});
});

describe("MediaTile", () => {
	test("is a link named by its title, with the play button outside it", () => {
		let host = mount(
			200,
			<MediaTile
				href="/album/tidelight"
				title="Tidelight"
				subtitle="2025 · Lumen Harbor"
				art={<span />}
				play={<button type="button">Play Tidelight</button>}
			/>,
		);
		let link = host.querySelector("a")!;
		expect(link.getAttribute("href")).toBe("/album/tidelight");
		expect(link.querySelector("button")).toBeNull();
		let art = host.querySelector("[data-slot=media-tile-art]")!.getBoundingClientRect();
		expect(Math.round(art.width)).toBe(Math.round(art.height));
		let play = host.querySelector("[data-slot=media-tile-play]")!.getBoundingClientRect();
		expect(play.bottom).toBeLessThanOrEqual(art.bottom + 1);
	});
});

describe("PlayerBar", () => {
	test("fills a range to its value, and reads a toggle's state", () => {
		let host = mount(
			1000,
			<PlayerBar
				label="Player"
				track={<PlayerBar.Track title="Salt Glass" subtitle="Lumen Harbor" />}
				controls={
					<>
						<PlayerBar.Button label="Disable shuffle" pressed>
							S
						</PlayerBar.Button>
						<PlayerBar.Seek aria-label="Seek" current={45} duration={180} />
					</>
				}
				extras={<PlayerBar.Range aria-label="Volume" value={70} />}
			/>,
		);
		expect(host.querySelector("section")?.getAttribute("aria-label")).toBe("Player");
		let seek = host.querySelector<HTMLInputElement>('input[aria-label="Seek"]')!;
		expect(seek.style.getPropertyValue("--ui-range-fill")).toBe("25.00%");
		expect(seek.getAttribute("aria-valuetext")).toBe("0:45 / 3:00");
		expect(host.querySelector('[aria-label="Disable shuffle"]')?.getAttribute("aria-pressed")).toBe(
			"true",
		);
		expect(host.querySelector("[data-slot=player-bar-duration]")?.textContent).toBe("3:00");
	});

	test("lets the mini player's play button take presses over its expand button", () => {
		let host = mount(
			360,
			<PlayerBar.Mini
				title="Salt Glass"
				subtitle="Lumen Harbor"
				progress={0.5}
				expand={<button type="button" aria-label="Open now playing" />}
				actions={<button type="button">Pause</button>}
			/>,
		);
		let pause = [...host.querySelectorAll("button")].find(
			(button) => button.textContent === "Pause",
		)!;
		let box = pause.getBoundingClientRect();
		expect(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)).toBe(
			pause,
		);
		let card = host.querySelector("[data-slot=player-bar-mini]")!.getBoundingClientRect();
		let expand = document.elementFromPoint(card.left + card.width / 2, card.top + card.height / 2);
		expect(expand?.getAttribute("aria-label")).toBe("Open now playing");
	});
});

describe("QueueList", () => {
	test("lists queued tracks in order, and names an empty section", () => {
		let host = mount(
			360,
			<div>
				<QueueList.Section title="Now playing">
					{[<QueueList.Item current title="Salt Glass" duration={178} />]}
				</QueueList.Section>
				<QueueList.Section title="Next up" empty="Nothing else queued">
					{[]}
				</QueueList.Section>
			</div>,
		);
		expect(host.querySelector('li[aria-current="true"]')?.textContent).toContain("2:58");
		expect(host.textContent).toContain("Nothing else queued");
	});
});

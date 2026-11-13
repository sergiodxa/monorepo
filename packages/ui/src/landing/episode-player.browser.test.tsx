/**
 * Plays {@link EpisodePlayer} in a real browser: every time is a media-fragment link a reader
 * can follow without script, and once the island runs a chapter or transcript link seeks the
 * player and marks what is playing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { describe, expect, test } from "vitest";

import { EpisodePlayer, formatEpisodeTime } from "./episode-player.js";

/** The address the mounted player plays. */
const SRC = "/audio/episode-63.mp3";

/** Mounts a player with three chapters and three transcript passages. */
function mountPlayer(): HTMLElement {
	let host = document.createElement("div");
	host.style.width = "600px";
	document.body.appendChild(host);
	return render(
		<EpisodePlayer
			src={SRC}
			type="audio/mpeg"
			captions={{ src: "/audio/episode-63.vtt", srclang: "en", label: "English" }}
			title="The pressure at the top of the hill"
			meta="No. 63 · 14:20"
			chapters={[
				{ start: 0, title: "Cold open" },
				{ start: 112, title: "What pressure means at a tap" },
				{ start: 3725, title: "Credits" },
			]}
			transcript={[
				{ start: 0, speaker: "Tove", text: "This is Undercurrent." },
				{ start: 115, speaker: "Rafi", text: "Pressure is height you can borrow." },
				{ start: 3730, text: "Thanks for listening." },
			]}
		/>,
		{ container: host },
	).container;
}

/** The mounted player's audio element. */
function audioOf(root: HTMLElement): HTMLAudioElement {
	return root.querySelector("audio")!;
}

/** The chapter links in playing order. */
function chapterLinks(root: HTMLElement): HTMLAnchorElement[] {
	return [...root.querySelectorAll<HTMLAnchorElement>('[data-slot="episode-player-chapters"] a')];
}

describe("EpisodePlayer", () => {
	test("writes times as m:ss under an hour and h:mm:ss from one", () => {
		expect(formatEpisodeTime(0)).toBe("0:00");
		expect(formatEpisodeTime(112.7)).toBe("1:52");
		expect(formatEpisodeTime(3725)).toBe("1:02:05");
	});

	test("links every chapter and passage to its moment in the file, playable without script", () => {
		let root = mountPlayer();
		expect(audioOf(root).controls).toBe(true);
		expect(chapterLinks(root).map((link) => link.getAttribute("href"))).toEqual([
			`${SRC}#t=0`,
			`${SRC}#t=112`,
			`${SRC}#t=3725`,
		]);
		expect(root.querySelector("nav")?.getAttribute("aria-label")).toBe("Chapters");
		let transcript = root.querySelector("details")!;
		expect(transcript.open).toBe(false);
		expect(transcript.querySelector("summary")?.textContent).toBe("Transcript");
		expect(transcript.querySelectorAll(`a[href="${SRC}#t=115"]`)).toHaveLength(1);
	});

	test("a chapter link seeks the player and becomes the current chapter", () => {
		let root = mountPlayer();
		let [, second] = chapterLinks(root);
		second!.click();
		expect(audioOf(root).currentTime).toBe(112);
		expect(second!.getAttribute("aria-current")).toBe("true");
		expect(chapterLinks(root).filter((link) => link.hasAttribute("aria-current"))).toHaveLength(1);
	});

	test("as the audio plays, the passage that has started is marked current", () => {
		let root = mountPlayer();
		let audio = audioOf(root);
		audio.currentTime = 120;
		audio.dispatchEvent(new Event("timeupdate"));
		let current = root.querySelectorAll('[data-slot="episode-player-cue"][aria-current="true"]');
		expect(current).toHaveLength(1);
		expect(current[0]?.textContent).toContain("Pressure is height you can borrow.");
	});

	test("a modified click leaves the link to open the file elsewhere", () => {
		let root = mountPlayer();
		let [, second] = chapterLinks(root);
		let click = new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true });
		document.addEventListener("click", (event) => event.preventDefault(), { once: true });
		second!.dispatchEvent(click);
		expect(audioOf(root).currentTime).toBe(0);
		expect(second!.hasAttribute("aria-current")).toBe(false);
	});
});

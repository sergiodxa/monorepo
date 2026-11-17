/**
 * Holds Vesper's server side to what a visitor relies on: the profile and My List survive in
 * cookies and a tampered one only loses entries, a post returns only to Vesper's own screens,
 * the Kids profile never reaches an older title, and a resumed episode starts where it was left.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";

import { TITLES, searchTitles, visibleTitles, findProfile, nextEpisode, findTitle } from "./data";
import { listCookie, readViewer } from "./state";

/** Posts a form to a Vesper action path with the given cookie. */
async function post(page: string, fields: Record<string, string>, cookie = "") {
	return await fetchApp(`/demo/apps/vesper/${page}`, {
		method: "POST",
		body: new URLSearchParams(fields),
		headers: cookie === "" ? {} : { Cookie: cookie },
		redirect: "manual",
	});
}

/** The `name=value` part of a response's first `Set-Cookie`. */
function cookieOf(response: Response): string {
	return (response.headers.get("Set-Cookie") ?? "").split(";")[0] ?? "";
}

describe("Vesper's visitor state", () => {
	test("watches as Noa with the starter list until a profile is picked", () => {
		let viewer = readViewer(null);
		expect(viewer.profile.id).toBe("noa");
		expect(viewer.picked).toBe(false);
		expect(viewer.list).toContain("ember-line");
	});

	test("drops unknown ids from a tampered list and unknown profiles from the cookie", () => {
		let viewer = readViewer("vesper.profile=nobody; vesper.list.noa=tidewater%2Cnot-a-title");
		expect(viewer.profile.id).toBe("noa");
		expect(viewer.list).toEqual(["tidewater"]);
	});

	test("puts an added title first and keeps an emptied list empty", () => {
		let viewer = readViewer(null);
		let added = listCookie(viewer, "tidewater", true).split(";")[0]!;
		expect(readViewer(added).list[0]).toBe("tidewater");
		let emptied = listCookie({ ...viewer, list: ["tidewater"] }, "tidewater", false).split(";")[0]!;
		expect(readViewer(emptied).list).toEqual([]);
	});
});

describe("Vesper's posts", () => {
	test("picking a profile sets its cookie and lands on home with a toast", async () => {
		let response = await post("profiles/theo", {});
		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toMatch(/^\/demo\/apps\/vesper\?toast=profile-theo\./);
		expect(cookieOf(response)).toBe("vesper.profile=theo");
		let home = await (
			await fetchApp("/demo/apps/vesper", { headers: { Cookie: "vesper.profile=theo" } })
		).text();
		expect(home).toContain("Continue watching for Theo");
	});

	test("My List returns to the page it came from, and never off Vesper", async () => {
		let back = await post("title/tidewater/list", { on: "true", back: "title/tidewater?season=2" });
		expect(back.headers.get("Location")).toMatch(
			/^\/demo\/apps\/vesper\/title\/tidewater\?season=2&toast=listed-tidewater\./,
		);
		expect(cookieOf(back)).toMatch(/^vesper\.list\.noa=tidewater%2C/);
		let away = await post("title/tidewater/list", { on: "true", back: "https://example.com" });
		expect(away.headers.get("Location")).toMatch(/^\/demo\/apps\/vesper\/title\/tidewater\?toast=/);
	});

	test("rejects a post for a title Vesper lacks or a list choice it cannot read", async () => {
		expect((await post("title/nope/list", { on: "true" })).status).toBe(400);
		expect((await post("title/tidewater/list", { on: "maybe" })).status).toBe(400);
		expect((await post("profiles/nobody", {})).status).toBe(400);
	});
});

describe("Vesper's catalogue", () => {
	test("keeps the Kids profile to titles rated for all ages, even by address", async () => {
		let kids = findProfile("kids")!;
		expect(visibleTitles(kids).every((title) => title.kids)).toBe(true);
		let response = await fetchApp("/demo/apps/vesper/title/ember-line", {
			headers: { Cookie: "vesper.profile=kids" },
		});
		expect(response.status).toBe(404);
	});

	test("ranks name matches before cast and genre matches", () => {
		let results = searchTitles("tide", TITLES).map((title) => title.id);
		expect(results[0]).toBe("tidewater");
		expect(searchTitles("   ", TITLES)).toEqual([]);
		expect(searchTitles("Adaeze", TITLES).map((title) => title.id)).toEqual(["tidewater"]);
	});

	test("crosses into the next season after a season's last episode", () => {
		let tidewater = findTitle("tidewater")!;
		expect(nextEpisode(tidewater, 1, 6)?.season.number).toBe(2);
		expect(nextEpisode(tidewater, 2, 6)).toBeUndefined();
	});

	test("resumes an episode at the time the profile left it, with a clip as long as it", async () => {
		let body = await (await fetchApp("/demo/apps/vesper/watch/tidewater/2-3")).text();
		let start = Math.round(0.42 * 50 * 60);
		expect(body).toContain(`/demos/video/vesper/50.webm#t=${start}`);
		expect(body).toContain(`/demos/video/vesper/50.mp4#t=${start}`);
		let fresh = await (await fetchApp("/demo/apps/vesper/watch/tidewater/1-1")).text();
		expect(fresh).toContain('/demos/video/vesper/52.webm"');
	});

	test("ships a clip for every running time in the catalogue", () => {
		let minutes = new Set(
			TITLES.flatMap((title) =>
				title.kind === "film"
					? [title.minutes ?? 0]
					: (title.seasons ?? []).flatMap((season) =>
							season.episodes.map((episode) => episode.minutes),
						),
			),
		);
		for (let length of minutes) {
			for (let kind of ["webm", "mp4"]) {
				let file = fileURLToPath(
					new URL(`../../../../public/demos/video/vesper/${length}.${kind}`, import.meta.url),
				);
				expect(existsSync(file), `${length}.${kind}`).toBe(true);
			}
		}
	});

	test("answers its own 404 for an episode a series lacks", async () => {
		expect((await fetchApp("/demo/apps/vesper/watch/tidewater/9-9")).status).toBe(404);
		expect((await fetchApp("/demo/apps/vesper/watch/the-quiet-hours/1-1")).status).toBe(404);
	});
});

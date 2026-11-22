/**
 * Holds Murmur's server side to what a listener relies on: the library and player survive in
 * cookies and a tampered one only loses entries, posts return only to Murmur's own screens,
 * the player renders what was last playing, and every track's sound is the same on every visit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderSong } from "@sdxc/synth";
import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";

import {
	ALBUMS,
	PLAYLISTS,
	SONG_SAMPLE_RATE,
	TRACKS,
	contextTracks,
	findTrack,
	searchCatalogue,
	songSpec,
} from "./data";
import { listCookie, nowCookie, parseNowPlaying, readListener } from "./state";

/** Posts a form to a Murmur action path with the given cookie. */
async function post(page: string, fields: Record<string, string>, cookie = "") {
	return await fetchApp(`/showcase/murmur/demo/${page}`, {
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

describe("Murmur's catalogue", () => {
	test("gives every track a unique id, a real album and a length of two to five minutes", () => {
		expect(new Set(TRACKS.map((track) => track.id)).size).toBe(TRACKS.length);
		for (let track of TRACKS) {
			expect(ALBUMS.some((album) => album.id === track.album)).toBe(true);
			expect(track.duration).toBeGreaterThanOrEqual(120);
			expect(track.duration).toBeLessThan(300);
		}
	});

	test("lists only catalogue tracks in every playlist, with a date for each", () => {
		for (let playlist of PLAYLISTS) {
			for (let id of playlist.tracks) expect(findTrack(id), `${playlist.id}: ${id}`).toBeDefined();
			expect(playlist.added).toHaveLength(playlist.tracks.length);
		}
	});

	test("resolves each play context to its tracks in playing order", () => {
		expect(contextTracks("album:tidelight", []).map((track) => track.id)[0]).toBe("tidelight-1");
		expect(contextTracks("liked", ["hinterland-2", "nope"]).map((track) => track.id)).toEqual([
			"hinterland-2",
		]);
		expect(
			contextTracks("artist:night-ferry", []).every((track) =>
				track.artists.includes("night-ferry"),
			),
		).toBe(true);
		expect(contextTracks("playlist:missing", [])).toEqual([]);
	});

	test("finds artists, albums and playlists by name or genre", () => {
		let found = searchCatalogue("night");
		expect(found.artists.map((artist) => artist.id)).toContain("night-ferry");
		expect(found.playlists.map((playlist) => playlist.id)).toContain("night-drive");
		expect(searchCatalogue("   ").tracks).toEqual([]);
	});
});

describe("Murmur's sound", () => {
	test("writes the same samples for the same track every time, and different ones per track", () => {
		let options = { sampleRate: SONG_SAMPLE_RATE };
		let spec = { ...songSpec(TRACKS[0]!), duration: 12 };
		let a = renderSong(spec, options);
		expect(a.length).toBe(12 * SONG_SAMPLE_RATE);
		expect(renderSong(spec, options)).toEqual(a);
		expect(renderSong({ ...songSpec(TRACKS[1]!), duration: 12 }, options)).not.toEqual(a);
	});

	test("plays each album in its own style and key", () => {
		let spec = songSpec(findTrack("harbor-lights-1")!);
		expect(spec.style).toBe("house");
		expect(spec.duration).toBe(4 * 60 + 31);
	});
});

describe("Murmur's listener state", () => {
	test("starts with a library, and drops unknown ids from a tampered cookie", () => {
		expect(readListener(null).liked.length).toBeGreaterThan(0);
		let listener = readListener(
			"murmur.liked=tidelight-1%2Cfake; murmur.saved=album%3Anope%2Calbum%3Ahinterland",
		);
		expect(listener.liked).toEqual(["tidelight-1"]);
		expect(listener.saved).toEqual(["album:hinterland"]);
	});

	test("reads back the track the player wrote, and ignores one that names nothing", () => {
		let cookie = nowCookie({ context: "playlist:night-drive", track: "midnight-citrus-3" }).split(
			";",
		)[0]!;
		expect(readListener(cookie).now).toEqual({
			context: "playlist:night-drive",
			track: "midnight-citrus-3",
		});
		expect(parseNowPlaying("album%3Anope%7Cx")).toBeNull();
	});

	test("puts a newly liked track first and removes an unliked one", () => {
		let listener = readListener(null);
		let added = listCookie(listener, "liked", "hinterland-7", true).split(";")[0]!;
		expect(readListener(added).liked[0]).toBe("hinterland-7");
		let removed = listCookie(listener, "liked", listener.liked[0]!, false).split(";")[0]!;
		expect(readListener(removed).liked).not.toContain(listener.liked[0]);
	});
});

describe("Murmur's posts", () => {
	test("a play post puts the track in the player and goes back to the page", async () => {
		let response = await post("play", {
			context: "album:tidelight",
			track: "tidelight-3",
			back: "album/tidelight",
		});
		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toMatch(/^\/showcase\/murmur\/demo\/album\/tidelight/);
		let cookie = cookieOf(response);
		expect(readListener(cookie).now).toEqual({ context: "album:tidelight", track: "tidelight-3" });

		let page = await (
			await fetchApp("/showcase/murmur/demo/album/tidelight", { headers: { Cookie: cookie } })
		).text();
		expect(page).toContain("First Light on the Breakwater");
		expect(page).toMatch(
			/data-track-id="tidelight-3"[^>]*aria-current="true"|aria-current="true"[^>]*data-track-id="tidelight-3"/,
		);
	});

	test("a like post adds the track and names its toast, and a foreign back is refused", async () => {
		let response = await post("like/zest-1", { on: "true", back: "https://example.com" });
		expect(response.status).toBe(400);
		let liked = await post("like/midnight-citrus-4", { on: "true", back: "https://evil.example" });
		expect(liked.headers.get("Location")).toMatch(
			/^\/showcase\/murmur\/demo\/library\?toast=liked-midnight-citrus-4/,
		);
		expect(readListener(cookieOf(liked)).liked[0]).toBe("midnight-citrus-4");
	});

	test("a save post saves an album and a follow post follows an artist", async () => {
		let saved = await post("save", {
			item: "album:atlas-of-small-hours",
			on: "true",
			back: "album/atlas-of-small-hours",
		});
		expect(readListener(cookieOf(saved)).saved[0]).toBe("album:atlas-of-small-hours");
		let followed = await post("follow/odile-varga", { on: "true", back: "artist/odile-varga" });
		expect(readListener(cookieOf(followed)).followed[0]).toBe("odile-varga");
	});

	test("draws the player outside the main frame with the last track paused", async () => {
		let cookie = nowCookie({ context: "artist:night-ferry", track: "harbor-lights-1" }).split(
			";",
		)[0]!;
		let body = await (
			await fetchApp("/showcase/murmur/demo/search", { headers: { Cookie: cookie } })
		).text();
		let main = body.indexOf("data-main-region");
		let bar = body.indexOf('aria-label="Player"');
		expect(main).toBeGreaterThan(-1);
		expect(bar).toBeGreaterThan(-1);
		expect(body).toContain("Last Crossing");
		expect(body).toContain('aria-label="Play"');
	});
});

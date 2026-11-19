/**
 * Holds Pinhole's server side to what a visitor relies on: every screen and every link in it
 * answers, a reel page opens on its own reel with the next one loading and its page
 * prefetched, a story address opens its segment, and likes, saves, follows and comments
 * survive in cookies and only ever send the visitor back inside the app.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";

import { POSTS, REELS } from "./data";
import { commentsCookie, readState, toggleCookie } from "./state";

import pinhole from "./index";

/** The app's root address. */
const ROOT = "/demo/apps/pinhole";

/** Posts a form to a Pinhole action path with the given cookie. */
async function post(page: string, fields: Record<string, string>, cookie = "") {
	return await fetchApp(`${ROOT}/${page}`, {
		method: "POST",
		body: new URLSearchParams(fields),
		headers: cookie === "" ? {} : { Cookie: cookie },
		redirect: "manual",
	});
}

/** The `name=value` part of each `Set-Cookie` a response carries. */
function cookiesOf(response: Response): string[] {
	return response.headers.getSetCookie().map((value) => value.split(";")[0] ?? "");
}

/** Fetches a screen's HTML. */
async function page(path: string, cookie = ""): Promise<string> {
	let response = await fetchApp(`${ROOT}${path === "" ? "" : `/${path}`}`, {
		headers: cookie === "" ? {} : { Cookie: cookie },
	});
	expect(response.status, path).toBe(200);
	return await response.text();
}

/** The opening tag of the element whose id is given. */
function tagOf(body: string, id: string): string {
	return new RegExp(`<[a-z]+\\b[^>]*\\bid="${id}"[^>]*>`).exec(body)?.[0] ?? "";
}

describe("Pinhole's screens", () => {
	test("every screen answers with one h1, and every link inside the app answers", async () => {
		let links = new Set<string>();
		for (let screen of pinhole.screens) {
			let body = await page(screen);
			expect([...body.matchAll(/<h1[\s>]/g)], screen).toHaveLength(1);
			expect(body, screen).not.toContain("[object Object]");
			for (let [, href] of body.matchAll(/(?<![\w-])href="([^"#]+)/g)) {
				let path = href!.replaceAll("&amp;", "&");
				if (path === ROOT || path.startsWith(`${ROOT}/`) || path.startsWith(`${ROOT}?`))
					links.add(path);
			}
		}
		for (let link of links) expect((await fetchApp(link)).status, link).toBe(200);
	});

	test("a missing post, person, reel or story answers the app's own 404", async () => {
		for (let path of [
			"p/nope",
			"u/nobody",
			"reels/nope",
			"stories/mara.quint/9",
			"highlights/mara.quint/nope/1",
		]) {
			let response = await fetchApp(`${ROOT}/${path}`);
			expect(response.status, path).toBe(404);
			expect(await response.text()).toContain("This page isn't on Pinhole");
		}
	});
});

describe("Pinhole's reels", () => {
	test("opens on its own reel, loads the next whole and the one after as metadata, and prefetches the next page", async () => {
		let reel = REELS[2]!;
		let body = await page(`reels/${reel.id}`);
		let preloads = REELS.map((entry) => {
			let item = body.slice(body.indexOf(`id="reel-${entry.id}"`));
			return /<video\b[^>]*\bpreload="([a-z]+)"/.exec(item)?.[1];
		});

		expect(preloads).toEqual(["none", "none", "auto", "auto", "metadata", "none", "none"]);
		expect(tagOf(body, `reel-${reel.id}`)).toContain("data-reel-active");
		expect(body).toMatch(new RegExp(`<link rel="prefetch" href="${ROOT}/reels/${REELS[3]!.id}"`));
		expect(body).toContain(`<title>Reel by Inès Oduya`);
	});

	test("plays each reel's own clip, looping it at the reel's length", async () => {
		let body = await page(`reels/${REELS[0]!.id}`);
		let clips = [...body.matchAll(/<source src="([^"]+\.webm)"/g)].map(([, src]) => src);
		expect(new Set(clips).size).toBe(REELS.length);
		expect(body).toContain(`data-loop-at="${REELS[0]!.seconds}"`);
	});
});

describe("Pinhole's stories", () => {
	test("opens a person's segment with tap zones to the segments around it", async () => {
		let body = await page("stories/mara.quint/2");
		expect(tagOf(body, "story-mara.quint")).toContain("data-story-active");
		let zones = [...body.matchAll(/<a href="([^"]+)" data-story-zone="(previous|next)"/g)].slice(
			0,
			2,
		);
		expect(zones.map(([, href]) => href)).toEqual([
			`${ROOT}/stories/mara.quint/1`,
			`${ROOT}/stories/mara.quint/3`,
		]);
	});

	test("a reply posts back to the story it answered, with a toast", async () => {
		let response = await post("stories/teo.lind/reply", {
			text: "Lovely",
			back: "stories/teo.lind/2",
		});
		expect(response.headers.get("Location")).toMatch(
			new RegExp(`^${ROOT}/stories/teo\\.lind/2\\?toast=replied\\.`),
		);
	});
});

describe("Pinhole's visitor state", () => {
	test("reads toggles and ignores a tampered value", () => {
		let state = readState("pinhole.like.kiln-opening=1; pinhole.save.harbor-fog=yes");
		expect(state.toggles.like.get("kiln-opening")).toBe(true);
		expect(state.toggles.save.has("harbor-fog")).toBe(false);
	});

	test("drops comments on posts that no longer exist and keeps the newest ten", () => {
		let state = readState(null);
		for (let index = 0; index < 12; index++) {
			let cookie = commentsCookie(state, {
				id: `c${index}`,
				post: POSTS[0]!.id,
				text: `n${index}`,
				at: index,
			});
			state = readState(cookie.split(";")[0]!);
		}
		expect(state.comments.map((comment) => comment.text)).toEqual(
			Array.from({ length: 10 }, (_, index) => `n${index + 2}`),
		);
	});
});

describe("Pinhole's posts", () => {
	test("a like sets its cookie and returns to the feed at the post", async () => {
		let response = await post("p/kiln-opening/like", { on: "true", back: "" });
		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(`${ROOT}#post-kiln-opening`);
		expect(cookiesOf(response)).toEqual(["pinhole.like.kiln-opening=1"]);
		let feed = await page("", "pinhole.like.kiln-opening=1");
		expect(feed).toContain("3,185 likes");
	});

	test("a post never sends the visitor off the app", async () => {
		for (let back of ["https://example.com", "//example.com", "/elsewhere"]) {
			let response = await post("p/harbor-fog/save", { on: "true", back });
			expect(response.headers.get("Location"), back).toBe(`${ROOT}/p/harbor-fog`);
		}
	});

	test("a comment lands on the post with its own anchor and a toast, and shows there", async () => {
		let response = await post("p/stair-light/comment", { text: "  So good  ", back: "" });
		let location = response.headers.get("Location") ?? "";
		expect(location).toMatch(new RegExp(`^${ROOT}/p/stair-light\\?toast=commented\\.[\\w-]+(&|#)`));
		let [cookie] = cookiesOf(response);
		let body = await page("p/stair-light", cookie);
		expect(body).toContain("So good");
		expect(body).toContain("Just now");
	});

	test("an empty comment changes nothing", async () => {
		let response = await post("p/stair-light/comment", { text: "   ", back: "p/stair-light" });
		expect(cookiesOf(response)).toEqual([]);
		expect(response.headers.get("Location")).toBe(`${ROOT}/p/stair-light`);
	});

	test("following counts the visitor in, and nobody follows themselves", async () => {
		let response = await post("u/noor.builds/follow", { on: "true", back: "u/noor.builds" });
		expect(cookiesOf(response)).toEqual(["pinhole.follow.noor.builds=1"]);
		let profile = await page("u/noor.builds", "pinhole.follow.noor.builds=1");
		expect(profile).toContain("31.8K");
		expect((await post("u/juno.arce/follow", { on: "true" })).status).toBe(400);
	});

	test("unfollowing someone takes their posts out of the home feed", async () => {
		let before = await page("");
		let after = await page("", toggleCookie("follow", "mara.quint", false).split(";")[0]!);
		let feedOf = (body: string) => body.slice(0, body.indexOf("all caught up"));
		expect(feedOf(before)).toContain('id="post-kiln-opening"');
		expect(feedOf(after)).not.toContain('id="post-kiln-opening"');
	});

	test("saved posts appear on Saved, and Saved explains itself when empty", async () => {
		expect(await page("saved")).toContain("Save what you want to see again");
		let saved = await page("saved", "pinhole.save.tile-study=1");
		expect(saved).toContain(`href="${ROOT}/p/tile-study"`);
	});

	test("reset expires every Pinhole cookie and lands on home with a toast", async () => {
		let response = await post(
			"reset",
			{},
			"pinhole.like.kiln-opening=1; pinhole.follow.ola.surfs=1",
		);
		expect(response.headers.get("Location")).toMatch(new RegExp(`^${ROOT}\\?toast=reset\\.`));
		expect(response.headers.getSetCookie().every((value) => value.includes("Max-Age=0"))).toBe(
			true,
		);
		expect(response.headers.getSetCookie()).toHaveLength(2);
	});
});

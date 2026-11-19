/**
 * Tests Parley, the team chat demo, through the real router: every screen renders with one
 * heading, a message posts without script and comes back in the log, reactions, edits, pins,
 * deletes with Undo and reads set the visitor's own cookies, threads and details open beside
 * the log, search finds lines, and the live stream types, posts and answers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";
import { demoAppActionHref, demoAppHref, demoAppStreamHref } from "~/resources/views/demo-apps";
import { MAIN_FRAME } from "~/resources/views/demo-apps/main-frame";
import parley from "~/resources/views/demo-apps/parley";

/** Parley's addresses. */
const href = demoAppHref("parley");

/** Where Parley's forms post. */
const action = demoAppActionHref("parley");

/** Parley's live streams. */
const stream = demoAppStreamHref("parley");

/** Posts a form as a browser without scripts does, carrying the visitor's cookies. */
async function post(page: string, fields: Record<string, string>, cookie = ""): Promise<Response> {
	return await fetchApp(action(page), {
		method: "POST",
		body: new URLSearchParams(fields),
		headers: { cookie },
	});
}

/** Turns a response's `Set-Cookie` headers into the `Cookie` header the next request sends. */
function cookiesFrom(response: Response, previous = ""): string {
	let jar = new Map(
		previous
			.split(";")
			.map((pair) => pair.trim())
			.filter(Boolean)
			.map((pair) => [pair.split("=")[0]!, pair] as const),
	);
	for (let header of response.headers.getSetCookie()) {
		let pair = header.split(";")[0]!;
		let [name = ""] = pair.split("=");
		if (/Max-Age=0/.test(header)) jar.delete(name);
		else jar.set(name, pair);
	}
	return [...jar.values()].join("; ");
}

/** A page's HTML as the visitor with `cookie` sees it. */
async function page(path: string, cookie = ""): Promise<string> {
	return await (await fetchApp(href(path), { headers: { cookie } })).text();
}

/** How many `<h1>` a page has. */
function countH1(body: string): number {
	return body.match(/<h1[\s>]/g)?.length ?? 0;
}

/** The redirect a post answered with, without its one-time toast nonce. */
function locationOf(response: Response): string {
	return (response.headers.get("location") ?? "").replace(/(toast=[\w-]+)\.[0-9a-f]+/, "$1");
}

describe("Parley screens", () => {
	test.each(parley.screens)("%s renders with one heading", async (screen) => {
		let response = await fetchApp(href(screen));
		let body = await response.text();
		expect(response.status).toBe(200);
		expect(countH1(body)).toBe(1);
	});

	test("a DM with any teammate opens, empty until the visitor writes", async () => {
		let response = await fetchApp(href("d/jonah"));
		expect(response.status).toBe(200);
		expect(await response.text()).toContain("beginning of your direct messages with Jonah Weiss");
	});

	test("an unknown channel answers the app's own 404", async () => {
		let response = await fetchApp(href("c/nowhere"));
		expect(response.status).toBe(404);
		expect(await response.text()).toContain("Nothing lives at this address");
	});

	test("the sidebar bolds unread conversations and badges mentions and DMs", async () => {
		let body = await page("c/random");
		let row = (key: string) =>
			[...body.matchAll(/<a\b[^>]*>/g)]
				.map(([tag]) => tag)
				.find((tag) => tag.includes(`data-conversation="${key}"`)) ?? "";
		expect(row("c:launch-v3")).toContain("data-unread");
		expect(row("c:general")).not.toContain("data-unread");
		expect(row("d:mira")).toContain("data-unread");
		expect(body).toContain("mentioning you");
	});

	test("a conversation opens with the New divider before the first unread line", async () => {
		let body = await page("c/launch-v3");
		let divider = body.indexOf('id="new-messages"');
		expect(divider).toBeGreaterThan(-1);
		expect(divider).toBeLessThan(body.indexOf('id="msg-l6"'));
		expect(divider).toBeGreaterThan(body.indexOf('id="msg-l3"'));
	});

	test("renders code fences, links, files and mentions in messages", async () => {
		let body = await page("c/launch-v3");
		expect(body).toContain("<pre");
		expect(body).toContain('href="https://sprout.example.com/whats-new"');
		expect(body).toContain(">https://sprout.example.com/whats-new<");
		expect(body).toContain("onboarding-copy-v4.pdf");
		expect(body).toContain('data-mention="sam"');
	});

	test("a thread opens beside the log, and details list the members", async () => {
		let thread = await page("c/launch-v3?thread=l3");
		expect(thread).toContain('data-live-log="thread-l3"');
		expect(thread).toContain("2 replies");
		let members = await page("c/launch-v3?details=members");
		expect(members).toContain("Kenji Mori");
		expect(members).toContain("Do not disturb");
	});

	test("the main frame answers a screen's pane alone", async () => {
		let response = await fetchApp(href("c/design"), {
			headers: { "x-remix-frame": "true", "x-remix-target": MAIN_FRAME },
		});
		let body = await response.text();
		expect(response.status).toBe(200);
		expect(body).not.toContain("<html");
		expect(body).toContain("#design");
	});

	test("search finds lines across conversations and narrows to one", async () => {
		let everywhere = await page("search?q=forecast");
		expect(everywhere).toContain("#engineering");
		let narrowed = await page("search?q=forecast&in=c%3Aengineering");
		expect(narrowed).toMatch(/\d+ results?/);
		expect(await page("search?q=zebra")).toContain("No messages match");
	});
});

describe("Parley messages", () => {
	test("a message posts without script and comes back in the log", async () => {
		let response = await post("c/design", {
			intent: "send",
			text: "Looks **great** @mira",
			return: "c/design",
		});
		expect(response.status).toBe(303);
		let location = locationOf(response);
		expect(location).toMatch(/^\/demo\/apps\/parley\/c\/design#msg-s[0-9a-f]{8}$/);
		let cookie = cookiesFrom(response);
		let body = await page("c/design", cookie);
		expect(body).toMatch(/<strong[^>]*>great<\/strong>/);
		expect(body).toContain(location.split("#")[1]!);
	});

	test("an empty message changes nothing", async () => {
		let response = await post("c/design", { intent: "send", text: "  ", return: "c/design" });
		expect(response.status).toBe(303);
		expect(response.headers.getSetCookie()).toEqual([]);
	});

	test("a reply in a thread lands in the thread", async () => {
		let response = await post("c/launch-v3", {
			intent: "send",
			text: "Reviewing now",
			parent: "l3",
			return: "c/launch-v3?thread=l3",
		});
		let cookie = cookiesFrom(response);
		let body = await page("c/launch-v3?thread=l3", cookie);
		expect(body).toContain("3 replies");
		expect(body).toContain("Reviewing now");
	});

	test("a reaction toggles the visitor in and out", async () => {
		let chip = (body: string, emoji: string) =>
			[...body.matchAll(/<button\b[^>]*data-slot="reaction"[^>]*>/g)]
				.map(([tag]) => tag)
				.find((tag) => tag.includes(`data-emoji="${emoji}"`) && body.indexOf(tag) > 0) ?? "";
		let added = cookiesFrom(
			await post("c/general", {
				intent: "react",
				id: "g5",
				emoji: "🎉",
				on: "1",
				return: "c/general",
			}),
		);
		let body = await page("c/general", added);
		let g5 = body.slice(body.indexOf('id="msg-g5"'));
		expect(chip(g5, "🎉")).toContain('aria-pressed="true"');
		let removed = cookiesFrom(
			await post("c/general", {
				intent: "react",
				id: "g1",
				emoji: "🙏",
				on: "0",
				return: "c/general",
			}),
		);
		let g1 = (await page("c/general", removed)).split('id="msg-g1"')[1] ?? "";
		expect(chip(g1, "🙏")).toContain('aria-pressed="false"');
	});

	test("a custom emoji reacts like any other, and an unknown one is refused", async () => {
		let response = await post("c/random", {
			intent: "react",
			id: "r3",
			emoji: ":shipit:",
			on: "1",
			return: "c/random?react=r3",
		});
		expect(locationOf(response)).toBe(`${href("c/random")}#msg-r3`);
		let body = await page("c/random", cookiesFrom(response));
		expect(body).toContain('data-emoji=":shipit:"');
		expect(body).toContain("/demos/parley/emoji/shipit.svg");
		let refused = await post("c/random", { intent: "react", id: "r3", emoji: "<b>", on: "1" });
		expect(refused.status).toBe(400);
	});

	test("the reaction page is a form of submit buttons, one per emoji", async () => {
		let body = await page("c/launch-v3?react=l7");
		expect(body).toContain("Add reaction");
		expect(body).toMatch(/<button[^>]*type="submit"[^>]*name="emoji"[^>]*value=":sprout:"/);
		expect(body).toMatch(/<button[^>]*type="submit"[^>]*name="emoji"[^>]*value="🎉"/);
	});

	test("shortcodes expand and Fernhill's custom emoji draw as images", async () => {
		let body = await page("c/general");
		expect(body).toContain("Office heating is fixed 🎉");
		expect(body).not.toContain(":tada:");
		expect(body).toMatch(/<img[^>]*src="\/demos\/parley\/emoji\/fernhill.svg"/);
	});

	test("the visitor edits and deletes their own message, and Undo brings it back", async () => {
		let edit = await post("c/engineering", {
			intent: "edit",
			id: "e2",
			text: "That was the last thing before 3.0 🚀",
			return: "c/engineering?edit=e2",
		});
		expect(locationOf(edit)).toBe(`${href("c/engineering")}?toast=edited#msg-e2`);
		let cookie = cookiesFrom(edit);
		expect(await page("c/engineering", cookie)).toContain("(edited)");

		let removed = await post(
			"c/engineering",
			{ intent: "delete", id: "e2", return: "c/engineering" },
			cookie,
		);
		expect(locationOf(removed)).toBe(`${href("c/engineering")}?toast=deleted`);
		cookie = cookiesFrom(removed, cookie);
		expect(await page("c/engineering", cookie)).not.toContain('id="msg-e2"');

		let restored = await post("undo", { intent: "undo" }, cookie);
		expect(locationOf(restored)).toBe(`${href("c/engineering")}?toast=restored#msg-e2`);
		expect(await page("c/engineering", cookiesFrom(restored, cookie))).toContain('id="msg-e2"');
	});

	test("nobody edits or deletes a teammate's message", async () => {
		let response = await post("c/engineering", {
			intent: "delete",
			id: "e1",
			return: "c/engineering",
		});
		expect(response.status).toBe(400);
	});

	test("pinning shows the message under Pinned", async () => {
		let cookie = cookiesFrom(
			await post("c/random", { intent: "pin", id: "r2", return: "c/random" }),
		);
		expect(await page("c/random?details=pins", cookie)).toContain("Office cat update");
	});

	test("reading a conversation clears its unread state", async () => {
		let cookie = cookiesFrom(await post("c/launch-v3", { intent: "read", return: "c/launch-v3" }));
		let body = await page("c/launch-v3", cookie);
		expect(body).not.toContain('id="new-messages"');
	});

	test("Mark all as read leaves Home caught up", async () => {
		let response = await post("", { intent: "read-all" });
		expect(await page("", cookiesFrom(response))).toContain("You're all caught up");
	});
});

describe("Parley live", () => {
	test("the stream answers the visitor's message, then plays the channel's lines", async () => {
		let sent = cookiesFrom(
			await post("d/theo", { intent: "send", text: "Thanks for the fix!", return: "d/theo" }),
		);
		let response = await fetchApp(stream("live/d/theo"), { headers: { cookie: sent } });
		expect(response.headers.get("content-type")).toContain("text/plain");
		let events = (await response.text())
			.trim()
			.split("\n")
			.map(
				(line) =>
					JSON.parse(line) as { type: string; html?: string; seen?: Record<string, string> },
			);
		expect(events.map((event) => event.type)).toEqual(["typing", "message", "typing", "message"]);
		expect(events[1]?.html).toContain("Anytime");
		expect(events[1]?.seen).toHaveProperty("answer");
		expect(events[3]?.seen).toEqual({ live: "0" });

		let seen = cookiesFrom(
			await post("d/theo", { intent: "seen", live: "0", answer: events[1]!.seen!.answer! }, sent),
			sent,
		);
		let body = await page("d/theo", seen);
		expect(body).toContain("Anytime");
		expect(body).toContain("Redeploy is green");
		let again = await (await fetchApp(stream("live/d/theo"), { headers: { cookie: seen } })).text();
		expect(again.trim()).toBe("");
	}, 30_000);

	test("an unknown stream answers 404", async () => {
		expect((await fetchApp(stream("live/c/nowhere"))).status).toBe(404);
	});
});

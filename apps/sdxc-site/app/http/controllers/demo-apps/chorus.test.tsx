/**
 * Tests Chorus, the social network demo, through the real router: likes, reposts, saves,
 * follows and votes set the visitor's own cookies and come back counted, a post within the
 * limit lands on the timeline while an empty or long one keeps its text, new posts arrive
 * by link, notifications group, search finds link cards, and pages drawn for one visitor
 * are never cached.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { withoutToastNonce } from "~/app/test/demo-apps";
import { fetchApp } from "~/app/test/router";
import { demoAppActionHref, demoAppFrameHref, demoAppHref } from "~/resources/views/demo-apps";
import chorus from "~/resources/views/demo-apps/chorus";
import { NOTIFICATIONS, pollFrame } from "~/resources/views/demo-apps/chorus/data";
import { groupSentence } from "~/resources/views/demo-apps/chorus/notifications";
import { MAIN_FRAME } from "~/resources/views/demo-apps/main-frame";

/** Chorus's addresses. */
const href = demoAppHref("chorus");

/** Chorus's frame addresses. */
const frame = demoAppFrameHref("chorus");

/** Where Chorus's forms post. */
const action = demoAppActionHref("chorus");

/**
 * Posts a form as a browser without scripts does, carrying the visitor's cookies.
 *
 * @param page The page path the form acts on.
 * @param fields The form's fields.
 * @param cookie The visitor's `Cookie` header.
 * @param headers Extra request headers.
 */
async function post(
	page: string,
	fields: Record<string, string>,
	cookie = "",
	headers: Record<string, string> = {},
): Promise<Response> {
	return await fetchApp(action(page), {
		method: "POST",
		body: new URLSearchParams(fields),
		headers: { cookie, ...headers },
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

/**
 * Fetches a page as the browser runtime loads it into one named frame.
 *
 * @param address The page's address.
 * @param name The frame's name, sent as `X-Remix-Target`.
 * @param cookie The visitor's `Cookie` header.
 */
async function targeted(address: string, name: string, cookie = ""): Promise<Response> {
	return await fetchApp(address, {
		headers: { cookie, "x-remix-frame": "true", "x-remix-target": name },
	});
}

/** The names of every frame a page mounts, nested ones included, from its frame data. */
function frameNames(body: string): Set<string> {
	let names = new Set<string>();
	for (let match of body.matchAll(
		/<script type="application\/json" id="rmx-data">(.*?)<\/script>/g,
	)) {
		let data = JSON.parse(match[1]!) as { f?: Record<string, { name?: string }> };
		for (let frame of Object.values(data.f ?? {})) if (frame.name) names.add(frame.name);
	}
	return names;
}

/** The frame names a page's links and forms aim at. */
function targetsOf(body: string): Set<string> {
	return new Set([...body.matchAll(/data-rmx-target="([^"]+)"/g)].map((match) => match[1]!));
}

/** The like button's accessible name in one post's card. */
function likeLabel(body: string, id: string): string | undefined {
	let card = body.slice(body.indexOf(`id="post-${id}"`));
	return /value="like"[\s\S]*?aria-label="([^"]+)"/.exec(card)?.[1];
}

describe("Chorus reactions", () => {
	test("a like without script lands back on the post's row and is remembered", async () => {
		let response = await post("post/p-heatpumps", { intent: "like", on: "true", return: "" });

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(`${href()}#post-p-heatpumps`);
		let cookie = cookiesFrom(response);
		expect(cookie).toBe("chorus.like.p-heatpumps=1");
		expect(likeLabel(await page("", cookie), "p-heatpumps")).toBe("Unlike");
		expect(likeLabel(await page(""), "p-heatpumps")).toBe("Like");
	});

	test("a toggle's background post answers 204 with its cookie", async () => {
		let response = await post(
			"post/p-heatpumps",
			{ intent: "repost", on: "true", return: "" },
			"",
			{ "x-optimistic-toggle": "1" },
		);

		expect(response.status).toBe(204);
		expect(response.headers.get("location")).toBeNull();
		expect(cookiesFrom(response)).toBe("chorus.repost.p-heatpumps=1");
	});

	test("unliking a post Noor had liked counts one fewer", async () => {
		let before = await page("post/p-leonids");
		let cookie = cookiesFrom(await post("post/p-leonids", { intent: "like", on: "false" }));
		let after = await page("post/p-leonids", cookie);

		expect(before).toContain("<strong");
		expect(before).toMatch(/3,820<\/strong> Likes/);
		expect(after).toMatch(/3,819<\/strong> Likes/);
	});

	test("a saved post shows on Saved", async () => {
		let empty = await page("bookmarks", "chorus.save.p-fieldsizing=0");
		let cookie = cookiesFrom(await post("post/p-menu", { intent: "save", on: "true" }));
		let saved = await page("bookmarks", cookie);

		expect(empty).toContain("Save posts for later");
		expect(saved).toContain('id="post-p-menu"');
		expect(saved).toContain('id="post-p-fieldsizing"');
	});

	test("a vote is counted in the poll's results", async () => {
		let unvoted = await page("post/p-friday-poll");
		let cookie = cookiesFrom(await post("post/p-friday-poll", { intent: "vote", option: "2" }));
		let voted = await page("post/p-friday-poll", cookie);

		expect(unvoted).toContain('name="option"');
		expect(voted).not.toContain('name="option"');
		expect(voted).toContain("1,404 votes");
		expect(voted).toContain('aria-label="Your vote"');
	});

	test("a vote for an option the poll lacks is refused", async () => {
		expect((await post("post/p-friday-poll", { intent: "vote", option: "9" })).status).toBe(400);
		expect((await post("post/p-leonids", { intent: "vote", option: "0" })).status).toBe(400);
	});

	test("following someone adds them to Following and counts the follower", async () => {
		let before = await page("u/rafaortiz");
		let cookie = cookiesFrom(
			await post("u/rafaortiz", { intent: "follow", on: "true", return: "u/rafaortiz" }),
		);
		let after = await page("u/rafaortiz", cookie);
		let following = await page("?feed=following", cookie);

		expect(before).toContain("12.8K");
		expect(after).toContain('aria-label="Unfollow Rafael Ortiz"');
		expect(following).toContain('id="post-p-menu"');
		expect(await page("?feed=following")).not.toContain('id="post-p-menu"');
	});

	test("a return address off the app falls back to the post", async () => {
		let response = await post("post/p-leonids", {
			intent: "like",
			on: "true",
			return: "//evil.example",
		});

		expect(response.headers.get("location")).toBe(`${href("post/p-leonids")}#post-p-leonids`);
	});
});

describe("Chorus posting", () => {
	test("a post lands at the top of the timeline with its toast", async () => {
		let response = await post("", { intent: "compose", text: "Hello from the test suite #demo" });
		let cookie = cookiesFrom(response);
		let body = await page("", cookie);

		expect(response.status).toBe(303);
		expect(withoutToastNonce(response.headers.get("location"))).toMatch(
			new RegExp(`^${href()}\\?toast=posted#post-n-[0-9a-f]{8}$`),
		);
		expect(body.indexOf("Hello from the test suite")).toBeLessThan(
			body.indexOf('id="post-p-leonids"'),
		);
		expect(body).toContain(`href="${href("explore?q=%23demo")}"`);
	});

	test("an empty post answers the page again with why", async () => {
		let response = await post("", { intent: "compose", text: "   " });
		let body = await response.text();

		expect(response.status).toBe(400);
		expect(body).toContain("Write something before posting.");
		expect(body).toContain('aria-invalid="true"');
	});

	test("a post over 280 characters keeps every character and says how far over", async () => {
		let text = "a".repeat(290);
		let response = await post("", { intent: "compose", text });
		let body = await response.text();

		expect(response.status).toBe(400);
		expect(body).toContain("This one is 10 over.");
		expect(body).toContain(text);
	});

	test("a reply lands under the post it answers and counts on it", async () => {
		let response = await post("post/p-weather", {
			intent: "compose",
			text: "Clear skies here too",
			replyTo: "p-weather",
		});
		let cookie = cookiesFrom(response);
		let body = await page("post/p-weather", cookie);

		expect(withoutToastNonce(response.headers.get("location"))).toMatch(
			new RegExp(`^${href("post/p-weather")}\\?toast=replied#post-n-`),
		);
		expect(body).toContain("Clear skies here too");
		expect(body).toMatch(/1<\/strong> Replies/);
		expect(await page("u/noorhaddad/replies", cookie)).toContain("Clear skies here too");
	});

	test("a refused reply answers the post page with the text kept", async () => {
		let response = await post("post/p-weather", {
			intent: "compose",
			text: "",
			replyTo: "p-weather",
		});
		let body = await response.text();

		expect(response.status).toBe(400);
		expect(body).toContain('id="post-p-weather"');
		expect(body).toContain("Write something before posting.");
	});

	test("a post from the New post dialog lands back on the page it was written on", async () => {
		let response = await post("compose", {
			intent: "compose",
			text: "From my profile",
			return: "u/noorhaddad",
		});
		let away = await post("compose", { intent: "compose", text: "Hi", return: "//evil.example" });

		expect(withoutToastNonce(response.headers.get("location"))).toMatch(
			new RegExp(`^${href("u/noorhaddad")}\\?toast=posted#post-n-`),
		);
		expect(withoutToastNonce(away.headers.get("location"))).toMatch(
			new RegExp(`^${href()}\\?toast=posted#post-n-`),
		);
	});

	test("every page's New post dialog returns to that page without script", async () => {
		let body = await page("u/noorhaddad/media?toast=posted");

		expect(body).toMatch(/<dialog[^>]*id="chorus-compose"/);
		expect(body).toMatch(/name="return" value="u\/noorhaddad\/media"/);
	});

	test("a reply to a post that does not exist is refused", async () => {
		expect((await post("compose", { text: "Hi", replyTo: "nope" })).status).toBe(400);
	});

	test("a quote carries the quoted post into the new one", async () => {
		let cookie = cookiesFrom(await post("compose", { text: "Worth reading", quote: "p-book" }));

		expect(await page("", cookie)).toContain('aria-label="Quoted post by Elif Kaya"');
	});

	test("reset clears every Chorus cookie", async () => {
		let cookie = cookiesFrom(await post("post/p-menu", { intent: "like", on: "true" }));
		let response = await post("reset", {}, cookie);

		expect(withoutToastNonce(response.headers.get("location"))).toBe(`${href()}?toast=reset`);
		expect(cookiesFrom(response, cookie)).toBe("");
	});
});

describe("Chorus timeline and screens", () => {
	test("each new-posts pill reveals the next batch", async () => {
		let first = await page("");
		let second = await page("?arrived=1");
		let last = await page("?arrived=2");

		expect(first).toContain(`href="${href("?arrived=1")}"`);
		expect(first).toContain("Show 3 new posts");
		expect(second).toContain('id="post-a-ferry"');
		expect(second).toContain("Show 2 new posts");
		expect(last).toContain('id="post-a-clouds"');
		expect(last).not.toContain('data-slot="chorus-new-posts"');
	});

	test("notifications group people under one sentence", async () => {
		let likes = NOTIFICATIONS.find((notification) => notification.id === "n-likes-forms")!;
		let follows = NOTIFICATIONS.find((notification) => notification.id === "n-follows")!;
		let css = NOTIFICATIONS.find((notification) => notification.id === "n-likes-css")!;

		expect(groupSentence(likes)).toBe("Ana Sousa and 3 others liked your post");
		expect(groupSentence(follows)).toBe("Hana Sato and Sol Mendes followed you");
		expect(groupSentence(css)).toBe("Mei Lin and 308 others liked your post");
		expect(await page("notifications")).toContain("and 3 others liked your post");
	});

	test("mentions keep only replies and mentions", async () => {
		let body = await page("notifications?tab=mentions");

		expect(body).toContain('id="post-m-elif"');
		expect(body).not.toContain("liked your post");
	});

	test("search finds posts by their link cards and says when nothing matches", async () => {
		expect(await page("explore?q=train")).toContain('id="post-p-nighttrain"');
		expect(await page("explore?q=zebra")).toContain("No results for “zebra”");
	});

	test("another person's likes are private", async () => {
		expect(await page("u/anasousa/likes")).toContain("Likes are private");
		expect(await page("u/noorhaddad/likes")).toContain('id="post-p-leonids"');
	});

	test("a message sent shows in the conversation", async () => {
		let response = await post("messages/kofibuilds", { text: "Sending it Monday" });
		let cookie = cookiesFrom(response);

		expect(withoutToastNonce(response.headers.get("location"))).toBe(
			`${href("messages/kofibuilds")}?toast=sent#latest`,
		);
		expect(await page("messages/kofibuilds", cookie)).toContain("Sending it Monday");
		expect(await page("messages", cookie)).toContain("You: Sending it Monday");
	});

	test("the rail's frames answer, and an unknown part does not", async () => {
		let trends = await fetchApp(frame("rail/trends"));
		let follow = await fetchApp(frame("rail/follow"));

		expect(trends.status).toBe(200);
		expect(await trends.text()).toContain("Trending now");
		expect(await follow.text()).toContain('aria-label="Follow Rafael Ortiz"');
		expect((await fetchApp(frame("rail/nope"))).status).toBe(404);
	});

	test("a page drawn for one visitor carries no cache policy", async () => {
		let shared = await fetchApp(href());
		let personal = await fetchApp(href(), { headers: { cookie: "chorus.like.p-menu=1" } });

		expect(shared.headers.get("cache-control")).not.toBeNull();
		expect(personal.headers.get("cache-control")).toBeNull();
	});

	test("the app's own cookie outranks one an earlier visit wrote at /demo", async () => {
		let cookie = "chorus.like.p-heatpumps=1; chorus.like.p-heatpumps=0";

		expect(likeLabel(await page("", cookie), "p-heatpumps")).toBe("Unlike");
	});

	test("an unreadable posts cookie reads as no posts", async () => {
		let response = await fetchApp(href(), { headers: { cookie: "chorus.posts=%%%not-base64" } });

		expect(response.status).toBe(200);
	});

	test("one account and no workspaces: the account row opens a menu with Sign out and Reset", async () => {
		let body = await page("");

		expect(body).toMatch(/<button[^>]*commandfor="chorus-account"/);
		expect(body).toContain('id="chorus-account"');
		expect(body).toMatch(/href="\/demo"[^>]*>Sign out</);
		expect(body).toContain(`action="${action("reset")}"`);
	});

	test("Message on any profile opens a conversation to write in", async () => {
		let body = await page("messages/priyacodes");

		expect(body).toContain("Messages with Priya Raman");
		expect(body).toContain('name="text"');
	});

	test("a missing post, profile or tab answers the app's own 404", async () => {
		for (let path of [
			"post/nope",
			"u/nobody",
			"u/meilin/posts",
			"u/meilin/nope",
			"messages/nobody",
			"nope",
		]) {
			expect((await fetchApp(href(path))).status, path).toBe(404);
		}
	});
});

describe("Chorus frames", () => {
	test("every link and form aimed at a frame names one its page mounts", async () => {
		let aimed = 0;
		for (let screen of chorus.screens) {
			let body = await page(screen);
			let names = frameNames(body);
			for (let target of targetsOf(body)) {
				expect(names, `${screen} → ${target}`).toContain(target);
				aimed += 1;
			}
		}
		expect(aimed).toBeGreaterThan(0);
	});

	test("a page mounts its column as a frame loading the page's own address", async () => {
		let body = await page("?feed=following&toast=posted");

		expect(body).toContain(`"name":"${MAIN_FRAME}","src":"${href("?feed=following")}"`);
	});

	test("a request aimed at the column answers the column alone", async () => {
		for (let [path, heading] of [
			["?feed=following", "Home: Following"],
			["?arrived=1", "Home: For you"],
			["u/noorhaddad/media", "Noor Haddad"],
			["notifications?tab=mentions", "Notifications"],
			["explore?tab=people", "Explore"],
			["messages/kofibuilds", "Kofi"],
		] as const) {
			let response = await targeted(href(path), MAIN_FRAME);
			let body = await response.text();

			expect(response.status, path).toBe(200);
			expect(body, path).not.toContain('data-slot="chorus"');
			expect(body, path).toContain('data-slot="chorus-header"');
			expect(body, path).toMatch(new RegExp(`<h1[^>]*>[^<]*${heading}`));
		}
	});

	test("the main frame tells the shell its screen's title, nav item, address and toast", async () => {
		let home = await (await targeted(href("?toast=posted.1a2b3c4d"), MAIN_FRAME)).text();
		let thread = await (await targeted(href("messages/kofibuilds"), MAIN_FRAME)).text();
		let post = await (await targeted(href("post/p-leonids"), MAIN_FRAME)).text();

		expect(home).toMatch(
			/data-main-screen="" data-title="Home" data-nav="home" data-url="[^"]*\/chorus"/,
		);
		expect(home).toContain("Your post is live");
		expect(thread).toContain('data-title="Messages with Kofi Mensah" data-nav="messages"');
		expect(post).toContain('data-nav="none"');
	});

	test("a request aimed at a frame the page lacks answers the whole page", async () => {
		expect(await (await targeted(href(), "nope")).text()).toContain('data-slot="chorus"');
	});

	test("a vote aimed at its poll comes back as the poll alone, counted", async () => {
		let response = await fetchApp(href(), {
			method: "POST",
			body: new URLSearchParams({ intent: "vote", post: "p-friday-poll", option: "2" }),
			headers: { "x-remix-target": pollFrame("p-friday-poll") },
		});
		let cookie = cookiesFrom(response);
		let poll = await (await targeted(href(), pollFrame("p-friday-poll"), cookie)).text();

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(`${href()}?at=post-p-friday-poll`);
		expect(poll).toContain('aria-label="Your vote"');
		expect(poll).toContain("1,404 votes");
		expect(poll).not.toContain('id="post-');
	});

	test("a poll answered after a vote posts its next vote to the page, without the anchor", async () => {
		let poll = await (
			await targeted(href("?feed=following&at=post-p-friday-poll"), pollFrame("p-friday-poll"))
		).text();

		expect(poll).toContain(`action="${href("?feed=following")}"`);
	});

	test("a post from the composer comes back as the column it was written in, on top", async () => {
		let response = await fetchApp(href("?feed=following"), {
			method: "POST",
			body: new URLSearchParams({ intent: "compose", text: "Framed hello" }),
			headers: { "x-remix-target": MAIN_FRAME },
		});
		let cookie = cookiesFrom(response);
		let location = response.headers.get("location") ?? "";
		let column = await (await targeted(location, MAIN_FRAME, cookie)).text();

		expect(location.startsWith(`${href("?feed=following")}&toast=posted.`)).toBe(true);
		expect(column).toContain("Framed hello");
		expect(column).toContain("Home: Following");
		expect(column).not.toContain('data-slot="chorus"');
	});

	test("a refused post aimed at the column answers the column with the text and why", async () => {
		let response = await fetchApp(href(), {
			method: "POST",
			body: new URLSearchParams({ intent: "compose", text: "   " }),
			headers: { "x-remix-target": MAIN_FRAME },
		});
		let body = await response.text();

		expect(response.status).toBe(400);
		expect(body).toContain("Write something before posting.");
		expect(body).not.toContain('data-slot="chorus"');
	});

	test("a message sent into the thread comes back as the thread with it", async () => {
		let response = await post("messages/kofibuilds", { text: "Framed message" }, "", {
			"x-remix-target": MAIN_FRAME,
		});
		let cookie = cookiesFrom(response);
		let location = response.headers.get("location") ?? "";
		let thread = await (await targeted(location, MAIN_FRAME, cookie)).text();

		expect(thread).toContain("Framed message");
		expect(thread).not.toContain('data-slot="chorus"');
	});
});

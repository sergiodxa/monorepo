/**
 * Tests Tern, the chat assistant demo, through the real router: a message sent without
 * JavaScript comes back answered, regenerate and edit branch the chat, feedback, pins and
 * deletes answer with their toasts, the canvas, files and usage frames answer, and a link or
 * post aimed at the main frame answers that frame's pane alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { withoutToastNonce } from "~/app/test/demo-apps";
import { fetchApp } from "~/app/test/router";
import { demoAppActionHref, demoAppFrameHref, demoAppHref } from "~/resources/views/demo-apps";
import { CANNED_REPLIES } from "~/resources/views/demo-apps/tern/data";

/** Tern's addresses. */
const href = demoAppHref("tern");

/** Tern's frame addresses. */
const frame = demoAppFrameHref("tern");

/** Where Tern's forms post. */
const action = demoAppActionHref("tern");

/**
 * Posts a form to one of Tern's pages, as a browser without scripts does.
 *
 * @param page The page path the form acts on.
 * @param fields The form's fields.
 * @returns The router's response.
 */
async function post(page: string, fields: Record<string, string>): Promise<Response> {
	return await fetchApp(action(page), { method: "POST", body: new URLSearchParams(fields) });
}

/** Counts the log rows a page draws. */
function turns(body: string): number {
	return [...body.matchAll(/data-message-id="turn-\d+"/g)].length;
}

/** The text of a block, as the canned reply writes it and the page prints it. */
function firstWords(text: string): string {
	return text.split(" ").slice(0, 4).join(" ");
}

describe("Tern without JavaScript", () => {
	test("sending a message answers with the chat, the message and a canned reply to stream", async () => {
		let response = await post("c/flaky-test", {
			intent: "send",
			prompt: "Compare these two options in a table",
		});
		let body = await response.text();
		let reply = CANNED_REPLIES.plan[0][0];

		expect(response.status).toBe(200);
		expect(turns(body)).toBe(4);
		expect(body).toContain("Compare these two options in a table");
		expect(reply?.type === "p" && body.includes(firstWords(reply.text))).toBe(true);
		expect(body).toMatch(/id="tern-reply-3"[^>]*data-stream-pending/);
		expect(body).toContain('"moduleUrl":"@sdxc/ui/chat/composer-submit"');
	});

	test("the streamed reply opens its thinking, and saved replies keep theirs closed", async () => {
		let sent = await (
			await post("c/flaky-test", { intent: "send", prompt: "Compare two options as a table" })
		).text();
		let saved = await (await fetchApp(href("c/debounce-search"))).text();

		expect(sent).toMatch(
			/<details[^>]*\bopen\b[^>]*data-slot="activity"|<details[^>]*data-slot="activity"[^>]*\bopen\b/,
		);
		expect(sent).toContain("Thinking");
		expect(sent).toContain("Searched the web for typical rates");
		expect(sent).toMatch(/data-stream-pause="1500"/);
		expect(saved).toContain("Thought for 14s");
		expect(saved).not.toMatch(/<details[^>]*\bopen\b[^>]*data-slot="activity"/);
	});

	test("a new chat starts from the home screen's composer and suggestions", async () => {
		let body = await (await post("", { intent: "send", prompt: "Write a shorter email" })).text();

		expect(turns(body)).toBe(2);
		expect(body).toMatch(/<h1[^>]*>Write a shorter email<\/h1>/);
		expect(body).toContain(`action="${action("")}"`);
	});

	test("the next send carries the chat so far, with no server state", async () => {
		let first = await (await post("", { intent: "send", prompt: "Plan a trip" })).text();
		let thread = /name="thread" value="([^"]+)"/.exec(first)?.[1]?.replaceAll("&quot;", '"') ?? "";
		let second = await (
			await post("", { intent: "send", prompt: "Now fix this bug", thread })
		).text();

		expect(turns(second)).toBe(4);
		expect(second).toContain("Plan a trip");
		expect(second).toContain("Now fix this bug");
	});

	test("an empty message on a saved chat returns to it", async () => {
		let response = await post("c/flaky-test", { intent: "send", prompt: "   " });
		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(href("c/flaky-test"));
	});

	test("regenerate replaces a reply with the topic's other answer", async () => {
		let body = await (await post("c/flaky-test", { intent: "regenerate-1" })).text();
		let alternative = CANNED_REPLIES.code[1][0];

		expect(turns(body)).toBe(2);
		expect(alternative?.type === "p" && body.includes(firstWords(alternative.text))).toBe(true);
	});

	test("editing a message drops what came after it and answers the new text", async () => {
		let body = await (
			await post("c/debounce-search", { intent: "edit-0", prompt: "Write a launch email instead" })
		).text();

		expect(turns(body)).toBe(2);
		expect(body).toContain("Write a launch email instead");
		expect(body).not.toContain("That last point bit us");
	});

	test("an action naming no turn is rejected", async () => {
		expect((await post("c/flaky-test", { intent: "regenerate-0" })).status).toBe(400);
		expect((await post("c/flaky-test", { intent: "edit-9", prompt: "x" })).status).toBe(400);
		expect((await post("c/nope", { intent: "send", prompt: "x" })).status).toBe(400);
	});
});

describe("Tern's other actions", () => {
	test("feedback, pins and the model picker redirect with their toasts", async () => {
		let rated = await post("c/flaky-test", { intent: "rate-1", up: "true" });
		let pinned = await post("c/flaky-test", { intent: "pin" });
		let model = await post("c/flaky-test", { intent: "model-dive" });

		expect(withoutToastNonce(rated.headers.get("Location"))).toBe(
			`${href("c/flaky-test")}?toast=feedback`,
		);
		expect(withoutToastNonce(pinned.headers.get("Location"))).toBe(
			`${href("c/flaky-test")}?toast=pinned`,
		);
		expect(model.headers.get("Location")).toBe(`${href("c/flaky-test")}?model=dive`);
		expect(await (await fetchApp(`${href("c/flaky-test")}?model=dive`)).text()).toContain(
			'aria-label="Model: Tern Dive"',
		);
	});

	test("deleting a chat offers Undo, which restores it", async () => {
		let deleted = await post("c/studio-names", { intent: "delete" });
		expect(withoutToastNonce(deleted.headers.get("Location"))).toBe(
			`${href()}?toast=deleted-studio-names`,
		);
		let home = await (await fetchApp(`${href()}?toast=deleted-studio-names`)).text();
		expect(home).toContain("Chat deleted");
		expect(home).toContain("Undo");

		let restored = await post("c/studio-names", { intent: "restore" });
		expect(withoutToastNonce(restored.headers.get("Location"))).toBe(
			`${href("c/studio-names")}?toast=restored`,
		);
	});

	test("settings save with their own toasts, and delete-all needs the phrase", async () => {
		let general = await post("settings/general", { section: "general" });
		let memory = await post("settings/personalization", { section: "memory", memory: "on" });
		let wrong = await post("settings/data", { section: "delete-all", confirmation: "yes" });
		let right = await post("settings/data", {
			section: "delete-all",
			confirmation: "delete my chats",
		});

		expect(withoutToastNonce(general.headers.get("Location"))).toBe(
			`${href("settings/general")}?toast=preferences-saved`,
		);
		expect(withoutToastNonce(memory.headers.get("Location"))).toBe(
			`${href("settings/personalization")}?toast=memory-on`,
		);
		expect(wrong.headers.get("Location")).toBe(href("settings/data"));
		expect(withoutToastNonce(right.headers.get("Location"))).toBe(`${href()}?toast=chats-deleted`);
	});
});

describe("Tern's screens and frames", () => {
	test("the history groups chats by age, and pinned chats sit apart", async () => {
		let body = await (await fetchApp(href())).text();
		for (let group of ["Pinned", "Projects", "Today", "Previous 7 days", "Previous 30 days"]) {
			expect(body, group).toContain(`>${group}<`);
		}
		expect(body).toMatch(
			/href="\/demo\/apps\/tern\/c\/debounce-search"[^>]*data-rmx-prefetch="intent"|data-rmx-prefetch="intent"[^>]*href="\/demo\/apps\/tern\/c\/debounce-search"/,
		);
	});

	test("search finds chats by their words, and says when none match", async () => {
		let found = await (await fetchApp(href("search?q=lisbon"))).text();
		let none = await (await fetchApp(href("search?q=zebra"))).text();

		expect(found).toContain("Plan a 3-day Lisbon offsite");
		expect(found).toContain("Outline chapter 3 on street trees");
		expect(found).toContain("2 chats found");
		expect(none).toContain("No chats match");
	});

	test("the canvas opens beside the chat as a frame, and answers on its own", async () => {
		let page = await (await fetchApp(href("c/debounce-search?canvas=open"))).text();
		let part = await fetchApp(frame("canvas/debounce-search"));

		expect(page).toContain(frame("canvas/debounce-search"));
		expect(part.status).toBe(200);
		expect(await part.text()).toContain("useDebouncedSearch");
		expect((await fetchApp(frame("canvas/flaky-test"))).status).toBe(404);
	});

	test("a project's files and the usage panel answer as frames", async () => {
		expect(await (await fetchApp(frame("projects/harbor-site/files"))).text()).toContain(
			"brand-voice.pdf",
		);
		expect(await (await fetchApp(frame("settings/usage"))).text()).toContain("Tern Dive");
	});

	test("a shared chat reads without the shell or any action", async () => {
		let body = await (await fetchApp(href("share/lisbon-offsite"))).text();

		expect(body).toContain("Read-only");
		expect(body).not.toContain('data-slot="composer"');
		expect(body).not.toContain("Regenerate response");
	});
});

describe("Tern's main frame", () => {
	/** The headers the browser runtime sends for a navigation aimed at the main frame. */
	let toMain = { "X-Remix-Frame": "true", "X-Remix-Target": "main" };

	test("a page inlines its pane in the main frame, so it reads without scripts", async () => {
		let body = await (await fetchApp(href("c/flaky-test"))).text();

		expect(body).toContain('name="robots"');
		expect(body).toContain('data-slot="app-shell-sidebar"');
		expect(body).toContain('<main id="tern-main"');
		expect([...body.matchAll(/<h1[\s>]/g)]).toHaveLength(1);
	});

	test("a link aimed at the main frame answers the pane alone, top bar included", async () => {
		let response = await fetchApp(href("c/flaky-test?model=dive"), { headers: toMain });
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("Vary")).toContain("X-Remix-Target");
		expect(body).not.toContain('name="robots"');
		expect(body).not.toContain('data-slot="app-shell-sidebar"');
		expect(body).toContain('data-slot="app-shell-topbar"');
		expect(body).toContain('aria-label="Model: Tern Dive"');
		expect([...body.matchAll(/<h1[\s>]/g)]).toHaveLength(1);
	});

	test("every link and form inside the pane is aimed at the main frame or opts out", async () => {
		for (let page of ["c/debounce-search", "search", "projects/harbor-site", "settings/general"]) {
			let body = await (await fetchApp(href(page), { headers: toMain })).text();
			let tags = [...body.matchAll(/<(?:a|form)\s[^>]*>/g)].map((match) => match[0]);
			let inApp = tags.filter(
				(tag) =>
					/(?:href|action)="\/demo\/apps\/tern(?:[/?"])/.test(tag) && !tag.includes("/share/"),
			);
			expect(inApp.length, page).toBeGreaterThan(0);
			for (let tag of inApp) {
				let aimed = tag.includes('data-rmx-target="main"');
				let settings = /action="\/demo\/apps\/tern\/settings\//.test(tag);
				let background = tag.includes('data-slot="optimistic-toggle"');
				expect(aimed || settings || background, `${page}: ${tag}`).toBe(true);
			}
		}
	});

	test("a message posted at the main frame answers the pane with its reply to stream", async () => {
		let response = await fetchApp(action("c/flaky-test"), {
			method: "POST",
			headers: toMain,
			body: new URLSearchParams({ intent: "send", prompt: "Compare these two options in a table" }),
		});
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).not.toContain('name="robots"');
		expect(body).not.toContain('data-slot="app-shell-sidebar"');
		expect(turns(body)).toBe(4);
		expect(body).toMatch(/id="tern-reply-3"[^>]*data-stream-pending/);
	});

	test("a shared chat owns no main frame, so a request aimed at it answers the whole page", async () => {
		let body = await (await fetchApp(href("share/lisbon-offsite"), { headers: toMain })).text();
		expect(body).toContain('name="robots"');
	});
});

/**
 * Tests Relay, the inbox demo, through the real router: each triage form returns the visitor
 * to the right conversation with the toast that names what happened, settings saves answer
 * with their own toasts, and the list states the inbox and contacts promise are reachable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { withoutToastNonce } from "~/app/test/demo-apps";
import { fetchApp } from "~/app/test/router";
import { demoAppActionHref, demoAppFrameHref, demoAppHref } from "~/resources/views/demo-apps";
import relay from "~/resources/views/demo-apps/relay";

/** Relay's addresses. */
const href = demoAppHref("relay");

/** Relay's frame addresses. */
const frame = demoAppFrameHref("relay");

/** Where Relay's forms post. */
const action = demoAppActionHref("relay");

/**
 * Posts a form to one of Relay's pages.
 *
 * @param page The page path the form acts on.
 * @param fields The form's fields.
 * @returns The router's response.
 */
async function post(page: string, fields: Record<string, string>): Promise<Response> {
	return await fetchApp(action(page), { method: "POST", body: new URLSearchParams(fields) });
}

/**
 * Renders a page and returns its HTML.
 *
 * @param page The page path, with its query string.
 * @returns The response body.
 */
async function html(page: string): Promise<string> {
	return await (await fetchApp(href(page))).text();
}

/**
 * Fetches a page as the browser runtime loads it into the `main` frame.
 *
 * @param page The page path, with its query string.
 * @returns The response body.
 */
async function main(page: string, name = "main"): Promise<string> {
	let response = await fetchApp(href(page), {
		headers: { "x-remix-frame": "true", "x-remix-target": name },
	});
	return await response.text();
}

/**
 * Reads a table's column headers from rendered HTML.
 *
 * @param body The page's HTML.
 * @returns Each `<th scope="col">`'s text, in order.
 */
function columns(body: string): string[] {
	return [...body.matchAll(/<th[^>]*scope="col"[^>]*>([^<]*)<\/th>/g)].map(
		(match) => match[1] ?? "",
	);
}

describe("Relay triage", () => {
	test("archiving opens the next conversation with an Undo toast and drops the row", async () => {
		let response = await post("inbox/2045", { intent: "archive" });

		expect(response.status).toBe(303);
		expect(withoutToastNonce(response.headers.get("Location"))).toBe(
			`${href("inbox/2044")}?archived=2045&toast=archived-2045`,
		);

		let body = await html("inbox/2044?archived=2045&toast=archived-2045");
		expect(body).toContain("Conversation archived");
		expect(body).toContain("Undo");
		expect(body).not.toContain(`href="${href("inbox/2045")}" data-split-view-item`);
		expect(body).toContain(`href="${href("inbox/2046")}" data-split-view-item`);
	});

	test("archiving the last conversation of a view returns to the one above it", async () => {
		let response = await post("bugs/2045", { intent: "archive" });
		expect(withoutToastNonce(response.headers.get("Location"))).toBe(
			`${href("bugs/2046")}?archived=2045&toast=archived-2045`,
		);
	});

	test("Undo moves the conversation back to the inbox", async () => {
		let response = await post("inbox/2045", { intent: "unarchive" });
		expect(withoutToastNonce(response.headers.get("Location"))).toBe(
			`${href("inbox/2045")}?toast=restored`,
		);
	});

	test("a reply comes back as sent, and an empty one comes back quietly", async () => {
		let sent = await post("mine/2043", { intent: "reply", body: "Section 4 is attached." });
		let empty = await post("mine/2043", { intent: "reply", body: "   " });

		expect(withoutToastNonce(sent.headers.get("Location"))).toBe(
			`${href("mine/2043")}?toast=reply-sent`,
		);
		expect(withoutToastNonce(empty.headers.get("Location"))).toBe(href("mine/2043"));
		expect(await html("mine/2043?toast=reply-sent")).toContain("Reply sent");
	});

	test("assigning names the teammate in the toast", async () => {
		let response = await post("inbox/2048", { intent: "assign-mei" });
		expect(withoutToastNonce(response.headers.get("Location"))).toBe(
			`${href("inbox/2048")}?toast=assigned-mei`,
		);
		expect(await html("inbox/2048?toast=assigned-mei")).toContain("Assigned to Mei");
	});

	test("the star and read toggles post back to the same conversation without a toast", async () => {
		let starred = await post("starred/2046", { intent: "star", starred: "false" });
		let read = await post("inbox/2046", { intent: "read", read: "false" });

		expect(withoutToastNonce(starred.headers.get("Location"))).toBe(href("starred/2046"));
		expect(withoutToastNonce(read.headers.get("Location"))).toBe(href("inbox/2046"));
	});

	test("an unknown action or conversation is rejected", async () => {
		expect((await post("inbox/2048", { intent: "delete-everything" })).status).toBe(400);
		expect((await post("inbox/9999", { intent: "archive" })).status).toBe(400);
	});

	test("a conversation id nobody has answers the app's 404", async () => {
		expect((await fetchApp(href("inbox/9999"))).status).toBe(404);
	});
});

describe("Relay settings", () => {
	test("each section saves with its own toast", async () => {
		let rules = await post("settings/assignment", { section: "rules", strategy: "least-busy" });
		let on = await post("settings/assignment", { section: "auto-reply", autoReply: "on" });
		let off = await post("settings/assignment", { section: "auto-reply" });
		let signature = await post("settings/signature", { section: "signature", signature: "Noor" });

		expect(withoutToastNonce(rules.headers.get("Location"))).toBe(
			`${href("settings/assignment")}?toast=rules-saved`,
		);
		expect(withoutToastNonce(on.headers.get("Location"))).toBe(
			`${href("settings/assignment")}?toast=auto-reply-on`,
		);
		expect(withoutToastNonce(off.headers.get("Location"))).toBe(
			`${href("settings/assignment")}?toast=auto-reply-off`,
		);
		expect(withoutToastNonce(signature.headers.get("Location"))).toBe(
			`${href("settings/signature")}?toast=signature-saved`,
		);
	});
});

describe("Relay screens", () => {
	test("an empty view is all caught up, with nothing selected beside it", async () => {
		let body = await html("unassigned");
		expect(body).toContain("All caught up");
		expect(body).toContain("No conversation selected");
	});

	test("a search nobody matches shows the no-results state with the query", async () => {
		let body = await html("contacts?q=zebra");
		expect(body).toContain("No contacts match");
		expect(body).toContain("zebra");
	});

	test("the visible properties in the URL hide the other columns", async () => {
		let all = await html("contacts");
		let some = await html("contacts?props=email");

		expect(columns(all)).toEqual([
			"Name",
			"Email",
			"Company",
			"Plan",
			"Last seen",
			"Lifetime value",
		]);
		expect(columns(some)).toEqual(["Name", "Email"]);
	});

	test("a contact in the URL opens its sheet at its place in the list", async () => {
		let body = await html("contacts?contact=priya-nair");
		expect(body).toContain("Platform Engineer at Arcadia Freight");
		expect(body).toMatch(/3\s*\/\s*12/);
	});
});

describe("Relay frames", () => {
	test("every frame a screen streams answers with its part", async () => {
		let sources = new Set<string>();
		for (let screen of relay.screens) {
			let body = await html(screen);
			for (let match of body.matchAll(/\/demo\/apps\/relay\/frames\/[^"'<\s]+/g)) {
				sources.add(match[0].replaceAll("&amp;", "&"));
			}
		}

		expect(sources).toContain(frame("conversation/2041?view=enterprise"));
		expect(sources).toContain(frame("contacts/priya-nair/sheet"));
		expect(sources).toContain(frame("contacts/maya-chen/activity"));
		expect(sources).toContain(frame("contacts/maya-chen/conversations"));
		expect(sources).toContain(frame("reports/stats"));
		expect(sources).toContain(frame("reports/chart"));
		expect(sources).toContain(frame("reports/chart?state=error"));
		for (let source of sources) {
			expect([source, (await fetchApp(source)).status]).toEqual([source, 200]);
		}
	});

	test("the open conversation's frame answers with its messages and its triage forms", async () => {
		let body = await (await fetchApp(frame("conversation/2041?view=enterprise"))).text();
		expect(body).toContain("Is the data processing agreement countersigned?");
		expect(body).toContain(`action="${action("enterprise/2041")}"`);
		expect(body).not.toContain("<h1");
	});

	test("the list stays in the document while the conversation streams in its frame", async () => {
		let body = await html("enterprise/2041");
		let row = /<a\b[^>]*href="[^"]*enterprise\/2041"[^>]*>/.exec(body)?.[0] ?? "";
		expect(row).toContain('data-split-view-item=""');
		expect(row).toContain('aria-current="page"');
		expect(body).toContain(frame("conversation/2041?view=enterprise"));
	});

	test("a part, record or view Relay lacks answers 404", async () => {
		expect((await fetchApp(frame("conversation/9999"))).status).toBe(404);
		expect((await fetchApp(frame("conversation/2041?view=nowhere"))).status).toBe(404);
		expect((await fetchApp(frame("contacts/nobody/sheet"))).status).toBe(404);
		expect((await fetchApp(frame("contacts/maya-chen/nothing"))).status).toBe(404);
		expect((await fetchApp(frame("reports/nothing"))).status).toBe(404);
	});
});

describe("Relay main frame", () => {
	test("each screen answers main alone, naming its title, sidebar row, crumb and address", async () => {
		let inbox = await main("enterprise/2041");
		expect(inbox).toContain('data-main-screen=""');
		expect(inbox).toContain('data-nav="view:enterprise"');
		expect(inbox).toContain('data-crumb="Enterprise"');
		expect(inbox).toContain(`data-url="${href("enterprise/2041")}"`);
		expect(inbox).toContain(frame("conversation/2041?view=enterprise"));
		expect(inbox.match(/<h1\b/g)).toHaveLength(1);
		expect(inbox).not.toContain("data-main-nav");

		let contacts = await main("contacts?contact=priya-nair");
		expect(contacts).toContain('data-nav="contacts"');
		expect(contacts).toContain(`data-url="${href("contacts?contact=priya-nair")}"`);
		expect(await main("settings/signature")).toContain('data-nav="settings"');
		expect(await main("reports")).toContain('data-crumb="Reports"');
	});

	test("a post's redirect raises its toast in main and settles on the address without it", async () => {
		let body = await main("inbox/2044?archived=2045&toast=archived-2045.0123abcd");
		expect(body).toContain("data-main-toast=");
		expect(body).toContain("Conversation archived");
		expect(body).toContain(`data-url="${href("inbox/2044?archived=2045")}"`);
		expect(body).not.toContain(`href="${href("inbox/2045")}" data-split-view-item`);
	});

	test("a reply or an assignment reloads the open conversation alone, with its toast", async () => {
		let pane = await main("mine/2043?toast=assigned-mei.0123abcd", "relay-conversation");
		expect(pane).toContain("Assigned to Mei");
		expect(pane).toContain("data-main-toast=");
		expect(pane).toContain(`action="${action("mine/2043")}"`);
		expect(pane).not.toContain("data-split-view-item");
		expect(pane).not.toContain("<h1");

		let conversation = await (await fetchApp(frame("conversation/2043?view=mine"))).text();
		expect(conversation).toMatch(/id="relay-reply"[^>]*data-rmx-target="relay-conversation"/);
		expect(conversation).toMatch(/value="assign-mei"[^>]*data-rmx-target="relay-conversation"/);
		expect(conversation).not.toMatch(/value="archive"[^>]*data-rmx-target/);
	});

	test("the whole page inlines main inside the shell, whose rows and crumb the browser updates", async () => {
		let body = await html("inbox/2048");
		expect(body).toContain('data-main-region=""');
		expect(body).toContain('data-main-screen=""');
		expect(body).toContain('data-main-crumb=""');
		expect(body).toContain('data-main-nav="view:inbox"');
		expect(body).toContain('data-main-nav="contacts"');
	});
});

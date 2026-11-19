/**
 * Holds reactions to their contract in a real browser: chips are submit buttons named by their
 * label and count, the row hides while empty, and with `reactionSync()` a press flips the chip
 * at once and posts in the background, a refused post puts it back, and a picked emoji is added.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { http, HttpResponse } from "msw";
import { setupWorker } from "msw/browser";
import { render } from "remix/component/test";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	onTestFinished,
	test,
	vi,
} from "vitest";

import { REACTION_ADD_EVENT, ReactionAddEvent, reactionSync } from "./mixins/reaction-sync.js";
import { ReactionBar } from "./reaction-bar.js";

import "../reset.css";
import "../theme.css";

/** Every background post, as its form body. */
let posted: string[] = [];

/** The status the next posts answer with. */
let status = 303;

/** The server behind the chips' forms. */
const WORKER = setupWorker(
	http.post(/\/react$/, async ({ request }) => {
		posted.push(await request.text());
		if (status === 303) {
			return new HttpResponse(null, { status: 303, headers: { Location: "/messages" } });
		}
		return new HttpResponse(null, { status });
	}),
);

beforeAll(async () => {
	await WORKER.start({ quiet: true, onUnhandledRequest: "bypass" });
});

afterAll(() => {
	WORKER.stop();
});

beforeEach(() => {
	posted = [];
	status = 303;
});

/** One chip's form, as a page draws it. */
function Chip(handle: {
	props: { emoji: string; label: string; count: number; pressed?: boolean };
}) {
	return () => (
		<form method="post" action="/react">
			<input type="hidden" name="emoji" value={handle.props.emoji} />
			<ReactionBar.Reaction
				emoji={handle.props.emoji}
				label={handle.props.label}
				count={handle.props.count}
				pressed={handle.props.pressed}
			/>
		</form>
	);
}

/** Mounts a row with two chips and a template, with or without `reactionSync()`. */
function mount(sync: boolean) {
	let mounted = render(
		<div>
			{sync ? <span hidden mix={[reactionSync()]} /> : null}
			<ReactionBar aria-label="Reactions" id="bar">
				<Chip emoji="🎉" label="Party popper" count={3} pressed />
				<Chip emoji="👀" label="Eyes" count={1} />
				<ReactionBar.Template>
					<form method="post" action="/react">
						<input type="hidden" name="emoji" value="" data-reaction-emoji="" />
						<ReactionBar.Reaction emoji="" label="" count={0} />
					</form>
				</ReactionBar.Template>
			</ReactionBar>
			<ReactionBar aria-label="Reactions" id="empty">
				<ReactionBar.Add>
					<button type="button">Add</button>
				</ReactionBar.Add>
			</ReactionBar>
		</div>,
	);
	onTestFinished(mounted.cleanup);
	return mounted.container;
}

/** The chip for an emoji in the first row. */
function chip(root: Element, emoji: string): HTMLButtonElement | null {
	return root.querySelector<HTMLButtonElement>(`#bar > form [data-emoji="${emoji}"]`);
}

describe("ReactionBar", () => {
	test("names each chip by its label and count, submitting the toggle that flips it", () => {
		let root = mount(false);
		let party = chip(root, "🎉")!;
		let eyes = chip(root, "👀")!;
		expect(party.type).toBe("submit");
		expect(party.getAttribute("aria-pressed")).toBe("true");
		expect(party.textContent).toContain("Party popper");
		expect(party.name).toBe("on");
		expect(party.value).toBe("0");
		expect(eyes.value).toBe("1");
		expect(root.querySelector("#bar")?.getAttribute("role")).toBe("group");
	});

	test("hides a row that holds no reaction", () => {
		let root = mount(false);
		expect(getComputedStyle(root.querySelector("#empty")!).display).toBe("none");
		expect(getComputedStyle(root.querySelector("#bar")!).display).not.toBe("none");
	});
});

describe("reactionSync", () => {
	test("flips a chip at once and posts it in the background", async () => {
		let root = mount(true);
		let eyes = chip(root, "👀")!;
		eyes.click();
		expect(eyes.getAttribute("aria-pressed")).toBe("true");
		expect(eyes.querySelector("[data-reaction-count]")?.textContent).toBe("2");
		expect(eyes.value).toBe("0");
		await vi.waitFor(() => expect(posted).toEqual(["emoji=%F0%9F%91%80&on=1"]));
		expect(eyes.getAttribute("aria-pressed")).toBe("true");
	});

	test("puts a chip back when the server refuses the post", async () => {
		status = 500;
		let root = mount(true);
		chip(root, "🎉")!.click();
		expect(chip(root, "🎉")?.getAttribute("aria-pressed")).toBe("false");
		await vi.waitFor(() => expect(posted).toHaveLength(1));
		await vi.waitFor(() => expect(chip(root, "🎉")?.getAttribute("aria-pressed")).toBe("true"));
		expect(chip(root, "🎉")?.querySelector("[data-reaction-count]")?.textContent).toBe("3");
	});

	test("adds a picked emoji from the template, and presses one already there", async () => {
		let root = mount(true);
		let bar = root.querySelector("#bar")!;
		bar.dispatchEvent(new ReactionAddEvent({ emoji: "🚀", label: "Rocket" }));
		let rocket = chip(root, "🚀");
		expect(rocket?.getAttribute("aria-pressed")).toBe("true");
		expect(rocket?.textContent).toContain("Rocket");
		expect(rocket?.querySelector("[data-reaction-count]")?.textContent).toBe("1");
		await vi.waitFor(() => expect(posted).toContain("emoji=%F0%9F%9A%80&on=1"));

		bar.dispatchEvent(new ReactionAddEvent({ emoji: "👀", label: "Eyes" }));
		expect(chip(root, "👀")?.getAttribute("aria-pressed")).toBe("true");
		expect(REACTION_ADD_EVENT).toBe("ui:reaction-add");

		rocket?.click();
		expect(chip(root, "🚀")).toBeNull();
	});
});

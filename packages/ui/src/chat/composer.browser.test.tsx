/**
 * Holds the chat composer to its contract in a real browser: the field grows with its text
 * and stops at its cap, Enter sends while Shift+Enter does not, and a reply streams from
 * nothing to exactly its markup, or freezes where Stop pressed it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { describe, expect, onTestFinished, test, vi } from "vitest";

import { ComposerSubmit } from "./composer-submit.js";
import { Composer } from "./composer.js";
import {
	STREAM_END_ATTRIBUTE,
	STREAM_HIDDEN_ATTRIBUTE,
	revealStream,
} from "./mixins/reveal-stream.js";
import { streamTarget } from "./mixins/stream-target.js";

import "../reset.css";
import "../theme.css";

/** A reply with a heading, a paragraph, a list and a table, which is what a model answers with. */
const REPLY_HTML =
	"<h3>Plan</h3><p>Start with the slow query, then cache it.</p><ul><li>Profile</li><li>Index the join</li></ul><table><tbody><tr><td>Before</td><td>840 ms</td></tr><tr><td>After</td><td>95 ms</td></tr></tbody></table>";

/** Mounts a reply element holding {@link REPLY_HTML}. */
function mountReply(): { root: HTMLElement; cleanup: () => void } {
	let mounted = render(<div id="reply" data-stream-pending mix={[streamTarget()]} />);
	let root = mounted.container.querySelector<HTMLElement>("#reply")!;
	root.innerHTML = REPLY_HTML;
	return { root, cleanup: mounted.cleanup };
}

describe("Composer.Input", () => {
	test("grows with its text and scrolls past twelve lines", () => {
		let mounted = render(
			<Composer style="inline-size:24rem">
				<Composer.Input aria-label="Message" />
			</Composer>,
		);
		let input = mounted.container.querySelector("textarea")!;
		let empty = input.getBoundingClientRect().height;

		input.value = "one\ntwo\nthree";
		let three = input.getBoundingClientRect().height;
		input.value = Array.from({ length: 40 }, (_, line) => `line ${line}`).join("\n");
		let capped = input.getBoundingClientRect().height;

		expect(three).toBeGreaterThan(empty);
		expect(capped).toBeLessThan(input.scrollHeight);
		expect(capped).toBeGreaterThan(three);
		mounted.cleanup();
	});
});

describe("revealStream", () => {
	test("starts from nothing and ends on exactly the server's markup", async () => {
		let { root, cleanup } = mountReply();
		onTestFinished(cleanup);
		let ended = vi.fn();
		revealStream(root, { interval: 1, onEnd: ended });

		expect(root.textContent).toBe("");
		expect(root.querySelector("table")?.hasAttribute(STREAM_HIDDEN_ATTRIBUTE)).toBe(true);
		await vi.waitFor(() => expect(ended).toHaveBeenCalledWith("done"));

		expect(root.innerHTML).toBe(REPLY_HTML);
		expect(root.getAttribute(STREAM_END_ATTRIBUTE)).toBe("done");
	});

	test("a stop keeps the words already shown and leaves the rest out of the layout", async () => {
		let { root, cleanup } = mountReply();
		onTestFinished(cleanup);
		let reveal = revealStream(root, { interval: 20 });
		await vi.waitFor(() => expect(root.textContent?.length).toBeGreaterThan(0), { interval: 2 });
		reveal.stop();
		let shown = root.textContent;
		await new Promise((resolve) => setTimeout(resolve, 40));

		expect(root.textContent).toBe(shown);
		expect(root.getAttribute(STREAM_END_ATTRIBUTE)).toBe("stopped");
		let table = root.querySelector("table")!;
		expect(getComputedStyle(table).display).toBe("none");
	});
});

describe("revealStream and skipped elements", () => {
	test("a note marked data-stream-skip keeps its text and is never hidden", () => {
		let { root, cleanup } = mountReply();
		onTestFinished(cleanup);
		root.insertAdjacentHTML("beforeend", '<p data-stream-skip id="note">Stopped</p>');
		let reveal = revealStream(root, { interval: 1000 });
		reveal.stop();

		let note = root.querySelector("#note")!;
		expect(note.textContent).toBe("Stopped");
		expect(note.hasAttribute(STREAM_HIDDEN_ATTRIBUTE)).toBe(false);
	});
});

describe("ComposerSubmit", () => {
	test("the send button is a circle", () => {
		let mounted = render(
			<Composer>
				<Composer.Input aria-label="Message" />
				<Composer.Toolbar>
					<ComposerSubmit labels={{ send: "Send", stop: "Stop" }} />
				</Composer.Toolbar>
			</Composer>,
		);
		onTestFinished(mounted.cleanup);
		let send = mounted.container.querySelector<HTMLElement>('[aria-label="Send"]')!;
		let box = send.getBoundingClientRect();

		expect(box.width).toBeGreaterThan(0);
		expect(box.height).toBe(box.width);
		expect(Number.parseFloat(getComputedStyle(send).borderTopLeftRadius)).toBeGreaterThanOrEqual(
			box.width / 2,
		);
	});

	test("Enter sends a message, Shift+Enter and an empty field do not", () => {
		let mounted = render(
			<Composer>
				<Composer.Input aria-label="Message" />
				<Composer.Toolbar>
					<ComposerSubmit labels={{ send: "Send", stop: "Stop" }} />
				</Composer.Toolbar>
			</Composer>,
		);
		let form = mounted.container.querySelector("form")!;
		let input = form.querySelector("textarea")!;
		let sent = vi.fn((event: Event) => event.preventDefault());
		form.addEventListener("submit", sent);
		let press = (init: KeyboardEventInit) =>
			input.dispatchEvent(
				new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, ...init }),
			);

		press({});
		input.value = "Hello";
		press({ shiftKey: true });
		expect(sent).not.toHaveBeenCalled();
		press({});
		expect(sent).toHaveBeenCalledTimes(1);
		mounted.cleanup();
	});

	test("a sent message reaches the navigation it starts, and the field empties after", async () => {
		let home = `${location.pathname}${location.search}`;
		let mounted = render(
			<Composer method="post" action={`${location.pathname}?sent`} enctype="multipart/form-data">
				<Composer.Input name="prompt" aria-label="Message" />
				<Composer.Toolbar>
					<ComposerSubmit labels={{ send: "Send", stop: "Stop" }} />
				</Composer.Toolbar>
			</Composer>,
		);
		let input = mounted.container.querySelector("textarea")!;
		let sent = new Promise<FormDataEntryValue | null | undefined>((resolve) => {
			navigation.addEventListener(
				"navigate",
				(event) => {
					resolve(event.formData?.get("prompt"));
					event.intercept({ async handler() {} });
				},
				{ once: true },
			);
		});
		onTestFinished(() => {
			mounted.cleanup();
			history.replaceState(null, "", home);
		});

		input.value = "Hello";
		input.form!.requestSubmit();

		expect(await sent).toBe("Hello");
		await vi.waitFor(() => expect(input.value).toBe(""));
	});

	test("a message a script posts itself is read first, and the field empties after", async () => {
		let mounted = render(
			<Composer method="post" action={`${location.pathname}?sent`} enctype="multipart/form-data">
				<Composer.Input name="prompt" aria-label="Message" />
				<Composer.Toolbar>
					<ComposerSubmit labels={{ send: "Send", stop: "Stop" }} />
				</Composer.Toolbar>
			</Composer>,
		);
		let input = mounted.container.querySelector("textarea")!;
		let read: FormDataEntryValue | null = null;
		let takeOver = (event: SubmitEvent) => {
			event.preventDefault();
			read = new FormData(event.target as HTMLFormElement).get("prompt");
		};
		document.addEventListener("submit", takeOver);
		onTestFinished(() => {
			document.removeEventListener("submit", takeOver);
			mounted.cleanup();
		});

		input.value = "Hello";
		input.form!.requestSubmit();

		expect(read).toBe("Hello");
		await vi.waitFor(() => expect(input.value).toBe(""));
	});

	test("a reply named after the composer mounted, as a frame update does, still replays", async () => {
		let { root, cleanup } = mountReply();
		onTestFinished(cleanup);
		let composer = (stream?: string) => (
			<Composer>
				<Composer.Input aria-label="Message" />
				<ComposerSubmit labels={{ send: "Send", stop: "Stop" }} stream={stream} streamKey="2" />
			</Composer>
		);
		let mounted = render(composer());
		onTestFinished(mounted.cleanup);

		mounted.root.render(composer("reply"));

		await vi.waitFor(() => expect(root.getAttribute(STREAM_END_ATTRIBUTE)).toBe("done"), {
			timeout: 3000,
		});
	});

	test("turns into Stop while the reply streams, and Stop freezes it", async () => {
		let { root, cleanup } = mountReply();
		onTestFinished(cleanup);
		let mounted = render(
			<Composer>
				<Composer.Input aria-label="Message" />
				<ComposerSubmit labels={{ send: "Send", stop: "Stop" }} stream="reply" />
			</Composer>,
		);
		let stop = await vi.waitFor(() => {
			let button = mounted.container.querySelector<HTMLButtonElement>('[aria-label="Stop"]');
			expect(button).not.toBeNull();
			return button!;
		});
		await vi.waitFor(() => expect(root.textContent?.length).toBeGreaterThan(4));
		stop.click();
		let shown = root.textContent;

		await vi.waitFor(() =>
			expect(mounted.container.querySelector('[aria-label="Send"]')).not.toBeNull(),
		);
		await new Promise((resolve) => setTimeout(resolve, 60));
		expect(root.textContent).toBe(shown);
		expect(shown).not.toBe(
			new DOMParser().parseFromString(REPLY_HTML, "text/html").body.textContent,
		);
		mounted.cleanup();
	});
});

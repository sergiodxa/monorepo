/**
 * Holds a message group and the typing line to their contracts in a real browser: later lines
 * align with the first line's text, times and actions wait for hover or focus, and the typing
 * line keeps its height while nobody types.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { describe, expect, onTestFinished, test } from "vitest";

import { MessageGroup } from "./message-group.js";
import { TypingIndicator, typingLabel } from "./typing-indicator.js";

import "../reset.css";
import "../theme.css";

/** Mounts a two-line group with an action bar on each line, in a 32rem column. */
function mountGroup() {
	let mounted = render(
		<div
			style={{
				inlineSize: "32rem",
				"--ui-warning-bg-solid": "rgb(220, 140, 0)",
				"--ui-warning-bg-tint": "rgb(255, 245, 225)",
			}}
		>
			<MessageGroup>
				<MessageGroup.Item id="m-1">
					<MessageGroup.Avatar>
						<span style={{ display: "block", inlineSize: "2.25rem", blockSize: "2.25rem" }} />
					</MessageGroup.Avatar>
					<MessageGroup.Header>
						<strong>Mira Okafor</strong>
						<time dateTime="2026-11-18T10:42">10:42</time>
					</MessageGroup.Header>
					<MessageGroup.Content>
						<p id="first-text">Shipped the onboarding.</p>
					</MessageGroup.Content>
					<MessageGroup.Actions>
						<button type="button" id="react-1">
							React
						</button>
						<button type="button" id="more-1">
							More
						</button>
					</MessageGroup.Actions>
				</MessageGroup.Item>
				<MessageGroup.Item id="m-2" mentioned>
					<MessageGroup.Time dateTime="2026-11-18T10:43">10:43</MessageGroup.Time>
					<MessageGroup.Content>
						<p id="second-text">
							Notes are in the doc.
							<MessageGroup.Edited>(edited)</MessageGroup.Edited>
						</p>
						<MessageGroup.Thread href="#thread" avatars={<span>A</span>}>
							<strong>3 replies</strong> Last reply 2h ago
						</MessageGroup.Thread>
					</MessageGroup.Content>
				</MessageGroup.Item>
			</MessageGroup>
		</div>,
	);
	onTestFinished(mounted.cleanup);
	return mounted.container;
}

describe("MessageGroup", () => {
	test("lines a continuation's text up with the first line's text", () => {
		let root = mountGroup();
		let first = root.querySelector("#first-text")!.getBoundingClientRect();
		let second = root.querySelector("#second-text")!.getBoundingClientRect();
		expect(Math.round(second.left)).toBe(Math.round(first.left));
		expect(second.top).toBeGreaterThan(first.bottom - 1);
	});

	test("hides a continuation's time and the action bar until the line holds focus", async () => {
		let root = mountGroup();
		let time = root.querySelector<HTMLElement>("[data-slot=message-group-time]")!;
		let actions = root.querySelector<HTMLElement>("#m-1 [data-slot=message-group-actions]")!;
		expect(getComputedStyle(time).opacity).toBe("0");
		expect(getComputedStyle(actions).opacity).toBe("0");

		root.querySelector<HTMLButtonElement>("#react-1")!.focus();
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(getComputedStyle(actions).opacity).toBe("1");
	});

	test("marks a mentioned line with an accent edge", () => {
		let root = mountGroup();
		let mentioned = root.querySelector<HTMLElement>("#m-2")!;
		expect(mentioned.hasAttribute("data-mentioned")).toBe(true);
		expect(getComputedStyle(mentioned).boxShadow).not.toBe("none");
	});

	test("links the thread summary to its thread", () => {
		let root = mountGroup();
		let thread = root.querySelector<HTMLAnchorElement>("[data-slot=message-group-thread]")!;
		expect(thread.getAttribute("href")).toBe("#thread");
		expect(thread.textContent).toContain("3 replies");
	});
});

describe("TypingIndicator", () => {
	let labels: TypingIndicator.Labels = {
		one: (name) => `${name} is typing…`,
		two: (first, second) => `${first} and ${second} are typing…`,
		many: (count) => `${count} people are typing…`,
	};

	test("words one, two or several typists", () => {
		expect(typingLabel([], labels)).toBe("");
		expect(typingLabel(["Mira"], labels)).toBe("Mira is typing…");
		expect(typingLabel(["Mira", "Theo"], labels)).toBe("Mira and Theo are typing…");
		expect(typingLabel(["Mira", "Theo", "Ana"], labels)).toBe("3 people are typing…");
	});

	test("keeps its height while nobody types, with the dots hidden", () => {
		let mounted = render(
			<div>
				<TypingIndicator id="empty" />
				<TypingIndicator id="busy">Mira is typing…</TypingIndicator>
			</div>,
		);
		onTestFinished(mounted.cleanup);
		let empty = mounted.container.querySelector<HTMLElement>("#empty")!;
		let busy = mounted.container.querySelector<HTMLElement>("#busy")!;
		expect(empty.getAttribute("role")).toBe("status");
		expect(empty.getBoundingClientRect().height).toBeGreaterThanOrEqual(19);
		expect(Math.round(empty.getBoundingClientRect().height)).toBe(
			Math.round(busy.getBoundingClientRect().height),
		);
		expect(getComputedStyle(empty.querySelector("[data-slot=typing-dots]")!).visibility).toBe(
			"hidden",
		);
		expect(getComputedStyle(busy.querySelector("[data-slot=typing-dots]")!).visibility).toBe(
			"visible",
		);
	});
});

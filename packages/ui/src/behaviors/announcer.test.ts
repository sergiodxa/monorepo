/**
 * Unit tests for {@link Announcer}, constructed and driven directly with no
 * DOM and no rendering: every assertion reads queue state or observes
 * dispatched "change" events.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { Announcer } from "./announcer";

describe(Announcer.name, () => {
	test("starts with an empty queue and no current message", () => {
		let announcer = new Announcer();

		expect(announcer.messages).toEqual([]);
		expect(announcer.current).toBeUndefined();
	});

	test("announce defaults to polite priority and appends to the queue", () => {
		let announcer = new Announcer();

		announcer.announce("5 results found");
		announcer.announce("6 results found");

		expect(announcer.messages).toHaveLength(2);
		expect(announcer.messages[0]?.text).toBe("5 results found");
		expect(announcer.messages[0]?.priority).toBe("polite");
		expect(announcer.messages[1]?.text).toBe("6 results found");
		expect(announcer.current).toBe(announcer.messages[0]);
	});

	test("announce returns a unique id per message", () => {
		let announcer = new Announcer();

		let firstId = announcer.announce("first");
		let secondId = announcer.announce("second");

		expect(firstId).not.toBe(secondId);
	});

	test("announce dispatches a change event", () => {
		let announcer = new Announcer();
		let changeCount = 0;

		announcer.addEventListener("change", () => {
			changeCount++;
		});

		announcer.announce("moved to row 2 of 5");

		expect(changeCount).toBe(1);
	});

	test("assertive messages interrupt ahead of polite messages but behind earlier assertive ones", () => {
		let announcer = new Announcer();

		announcer.announce("polite one", "polite");
		announcer.announce("polite two", "polite");
		let firstAssertiveId = announcer.announce("assertive one", "assertive");
		announcer.announce("assertive two", "assertive");

		expect(announcer.messages.map((message) => message.text)).toEqual([
			"assertive one",
			"assertive two",
			"polite one",
			"polite two",
		]);
		expect(announcer.current?.id).toBe(firstAssertiveId);
	});

	test("dismiss removes a message by id wherever it sits in the queue", () => {
		let announcer = new Announcer();

		announcer.announce("first");
		let targetId = announcer.announce("second");
		announcer.announce("third");

		announcer.dismiss(targetId);

		expect(announcer.messages.map((message) => message.text)).toEqual(["first", "third"]);
	});

	test("dismiss with an unknown id does nothing and does not dispatch change", () => {
		let announcer = new Announcer();
		announcer.announce("first");

		let changeCount = 0;
		announcer.addEventListener("change", () => {
			changeCount++;
		});

		announcer.dismiss("unknown-id");

		expect(announcer.messages).toHaveLength(1);
		expect(changeCount).toBe(0);
	});

	test("next advances the queue and dispatches change", () => {
		let announcer = new Announcer();
		announcer.announce("first");
		announcer.announce("second");

		let changeCount = 0;
		announcer.addEventListener("change", () => {
			changeCount++;
		});

		announcer.next();

		expect(announcer.current?.text).toBe("second");
		expect(changeCount).toBe(1);
	});

	test("next on an empty queue does nothing and does not dispatch change", () => {
		let announcer = new Announcer();

		let changeCount = 0;
		announcer.addEventListener("change", () => {
			changeCount++;
		});

		announcer.next();

		expect(announcer.current).toBeUndefined();
		expect(changeCount).toBe(0);
	});

	test("clear empties the queue and dispatches change", () => {
		let announcer = new Announcer();
		announcer.announce("first");
		announcer.announce("second");

		let changeCount = 0;
		announcer.addEventListener("change", () => {
			changeCount++;
		});

		announcer.clear();

		expect(announcer.messages).toEqual([]);
		expect(changeCount).toBe(1);
	});

	test("clear on an already empty queue does nothing and does not dispatch change", () => {
		let announcer = new Announcer();

		let changeCount = 0;
		announcer.addEventListener("change", () => {
			changeCount++;
		});

		announcer.clear();

		expect(changeCount).toBe(0);
	});

	test("removeEventListener stops delivering change events", () => {
		let announcer = new Announcer();
		let changeCount = 0;
		let listener = () => {
			changeCount++;
		};

		announcer.addEventListener("change", listener);
		announcer.announce("first");
		announcer.removeEventListener("change", listener);
		announcer.announce("second");

		expect(changeCount).toBe(1);
	});

	test("an aborted signal detaches the change listener", () => {
		let announcer = new Announcer();
		let controller = new AbortController();
		let changeCount = 0;

		announcer.addEventListener(
			"change",
			() => {
				changeCount++;
			},
			{ signal: controller.signal },
		);

		announcer.announce("first");
		controller.abort();
		announcer.announce("second");

		expect(changeCount).toBe(1);
	});
});

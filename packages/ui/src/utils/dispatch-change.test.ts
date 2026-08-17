/**
 * Unit tests for {@link "./dispatch-change"}: every assertion checks the
 * dispatched event against a plain `EventTarget` stand-in, with no DOM and no
 * rendering involved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { dispatchChange } from "./dispatch-change";

describe(dispatchChange.name, () => {
	test("dispatches a change event on the given target", () => {
		let target = new EventTarget();
		let events: Event[] = [];
		target.addEventListener("change", (event) => {
			events.push(event);
		});

		dispatchChange(target);

		expect(events).toHaveLength(1);
		expect(events[0]?.type).toBe("change");
	});

	test("dispatches a fresh Event instance on every call", () => {
		let target = new EventTarget();
		let events: Event[] = [];
		target.addEventListener("change", (event) => {
			events.push(event);
		});

		dispatchChange(target);
		dispatchChange(target);

		expect(events).toHaveLength(2);
		expect(events[0]).not.toBe(events[1]);
	});

	test("notifies every listener registered on the target", () => {
		let target = new EventTarget();
		let count = 0;
		target.addEventListener("change", () => count++);
		target.addEventListener("change", () => count++);

		dispatchChange(target);

		expect(count).toBe(2);
	});
});

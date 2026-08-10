/**
 * Unit tests for the command-event cast in {@link "./command-event"}: every
 * assertion checks the narrowed value against a plain `Event` stand-in, with
 * no DOM and no rendering involved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { asCommandEvent } from "./command-event";

describe(asCommandEvent.name, () => {
	test("returns the exact same event reference", () => {
		let event = new Event("command");
		let commandEvent = asCommandEvent(event);

		expect(commandEvent as unknown as Event).toBe(event);
	});

	test("exposes the command and source properties a real CommandEvent carries", () => {
		let event = new Event("command");
		Object.assign(event, { command: "--ui-theme-dark", source: null });

		let commandEvent = asCommandEvent(event);

		expect(commandEvent.command).toBe("--ui-theme-dark");
		expect(commandEvent.source).toBeNull();
	});
});

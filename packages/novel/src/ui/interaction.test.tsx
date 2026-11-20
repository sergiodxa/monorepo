/**
 * Holds `NovelPlayer.Interaction` and `InteractionCompleteEvent` to their types: the frame the
 * children function receives narrows by name, a switch that misses an interaction fails to
 * compile, and an event's output is typed by its declaration's output schema.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { describe, expect, expectTypeOf, test } from "vitest";

import { interaction, interactions } from "../declarations.js";

import { InteractionCompleteEvent } from "./events.js";
import { Interaction } from "./interaction.js";

/** Two interactions, so a switch over the frame has a case to miss. */
const INTERACTIONS = interactions({
	fishing: interaction({
		input: s.object({ difficulty: s.number() }),
		output: s.object({ caught: s.number() }),
	}),
	lockpick: interaction({
		input: s.object({ pins: s.number() }),
		output: s.object({ opened: s.boolean() }),
	}),
});

describe(Interaction, () => {
	test("narrows the frame by name and refuses a switch that misses an interaction", () => {
		<Interaction interactions={INTERACTIONS}>
			{(frame) => {
				switch (frame.interaction) {
					case "fishing":
						expectTypeOf(frame.input).toEqualTypeOf<{ difficulty: number }>();
						return <p>{frame.input.difficulty}</p>;
					case "lockpick":
						expectTypeOf(frame.input).toEqualTypeOf<{ pins: number }>();
						return <p>{frame.input.pins}</p>;
				}
			}}
		</Interaction>;
		<Interaction interactions={INTERACTIONS}>
			{/* @ts-expect-error -- a switch without "lockpick" returns undefined for it */}
			{(frame) => {
				switch (frame.interaction) {
					case "fishing":
						return <p>{frame.input.difficulty}</p>;
				}
			}}
		</Interaction>;
		expect(true).toBe(true);
	});

	test("types a completion's output by its declaration and bubbles it as novel:interaction:complete", () => {
		let event = new InteractionCompleteEvent(INTERACTIONS.fishing, { caught: 3 });
		expectTypeOf(event.interaction).toEqualTypeOf<"fishing">();
		expectTypeOf(event.output).toEqualTypeOf<{ caught: number }>();
		// @ts-expect-error -- fishing's output has no `opened`
		void new InteractionCompleteEvent(INTERACTIONS.fishing, { opened: true });
		expect(event.type).toBe("novel:interaction:complete");
		expect(event.bubbles).toBe(true);
		expect(event.interaction).toBe("fishing");
		expect(event.output).toEqual({ caught: 3 });
	});
});

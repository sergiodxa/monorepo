/**
 * Draws the app's own components for custom frames: one `Interaction` part over the app's
 * `interactions()` map renders a function of the current frame, narrowed by its name, and
 * answers the frame when a component inside it dispatches `novel:interaction:complete`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { css, on } from "remix/component";

import type { InteractionDeclaration } from "../declarations.js";
import type { CustomFrame, InteractionFrame } from "../frames.js";

import { NovelPlayer } from "./player.js";

export namespace Interaction {
	/** The interactions an app declares with `interactions()`, by name. */
	export type Map = Readonly<Record<string, InteractionDeclaration>>;

	/**
	 * The custom frame of each interaction in `Declarations`, so `frame.interaction` narrows
	 * `frame.input` and `frame.complete()` to that interaction's schemas.
	 *
	 * @template Declarations - The app's `interactions()` map.
	 */
	export type Frame<Declarations extends Map> = {
		[Name in keyof Declarations]: Declarations[Name] extends InteractionDeclaration<
			infer Key,
			infer Input,
			infer Output
		>
			? InteractionFrame<Key, Input, Output>
			: never;
	}[keyof Declarations];

	/**
	 * What the children function returns for a frame: something to draw, never `null` or
	 * `undefined`, so a `switch` that misses an interaction fails to compile.
	 */
	export type Rendered = Exclude<RemixNode, null | undefined>;

	/**
	 * Props {@link Interaction} accepts.
	 *
	 * @template Declarations - The app's `interactions()` map.
	 */
	export interface Props<Declarations extends Map> extends Omit<TagProps<"div">, "children"> {
		/** The app's `interactions()` map, which types the frame and picks the frames drawn. */
		interactions: Declarations;
		/** Draws the current custom frame, called on every render while the play stops at it. */
		children: (frame: Frame<Declarations>) => Rendered;
	}
}

/**
 * Renders its children function over the stage while the play stops at an interaction in
 * `interactions`, once the stage has settled; clicks inside it never advance the story. A
 * `novel:interaction:complete` from inside answers the frame it names, once.
 *
 * @example <NovelPlayer.Interaction interactions={INTERACTIONS}>{(frame) => { switch (frame.interaction) { case "fishing": return <Fishing input={frame.input} />; } }}</NovelPlayer.Interaction>
 */
export function Interaction<Declarations extends Interaction.Map>(
	handle: Handle<Interaction.Props<Declarations>>,
) {
	let player = handle.context.get(NovelPlayer);
	let answered: unknown;

	return () => {
		let { interactions, children, mix, ...rest } = handle.props;
		let frame = player.frame;
		if (frame?.type !== "custom" || !Object.hasOwn(interactions, frame.interaction)) return null;
		if (player.phase === "staging") return null;
		let current = untyped(frame);
		return (
			<div
				{...rest}
				data-novel-interaction={current.interaction}
				mix={[
					css({ position: "absolute", inset: 0, zIndex: 4 }),
					on("novel:interaction:complete", (event) => {
						if (player.frame !== current || answered === current) return;
						if (event.interaction !== current.interaction) return;
						answered = current;
						player.answer(current.complete(event.output));
					}),
					mix,
				]}
			>
				{children(current as Interaction.Frame<Declarations>)}
			</div>
		);
	};
}

/**
 * A custom frame by the declaration-free shape the part works with, whatever the app declared
 * globally; the frame's own `complete()` validates the output against its schema.
 */
function untyped(frame: CustomFrame): InteractionFrame {
	return frame as unknown as InteractionFrame;
}

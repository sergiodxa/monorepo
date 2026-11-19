/**
 * Draws the app's own component for a custom frame: one `Interaction` part per declared
 * interaction, each rendering only while the current frame is that interaction, so the frame
 * its component receives is typed by the interaction's declared input and output.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { css } from "remix/component";

import type { CustomFrame, Reply } from "../frames.js";

import { NovelPlayer } from "./player.js";

/** The name of an interaction the app declared through `NovelTypes["interactions"]`. */
export type InteractionName = CustomFrame["interaction"];

export namespace Interaction {
	/** Props an interaction component receives. */
	export interface ComponentProps<Name extends InteractionName = InteractionName> {
		frame: Extract<CustomFrame, { interaction: Name }>;
		/** Answers the frame; pass `frame.complete(output)`. */
		respond: (reply: Reply) => void;
	}

	/** Props {@link Interaction} accepts. */
	export interface Props<Name extends InteractionName = InteractionName> extends Omit<
		TagProps<"div">,
		"children"
	> {
		/** The interaction this part draws. */
		name: Name;
		/** The app's component for it. */
		component: (handle: Handle<ComponentProps<Name>>) => () => RemixNode;
	}
}

/**
 * Renders `component` over the stage while the play stops at the interaction `name`, once the
 * stage has settled; clicks inside it never advance the story.
 *
 * @example <NovelPlayer.Interaction name="fishing" component={Fishing} />
 */
export function Interaction<Name extends InteractionName>(handle: Handle<Interaction.Props<Name>>) {
	let player = handle.context.get(NovelPlayer);
	return () => {
		let { name, component: Component, mix, ...rest } = handle.props;
		let frame = player.frame;
		if (frame?.type !== "custom" || frame.interaction !== name) return null;
		if (player.phase === "staging") return null;
		return (
			<div
				{...rest}
				data-novel-interaction={name}
				mix={[css({ position: "absolute", inset: 0, zIndex: 4 }), mix]}
			>
				<Component
					frame={frame as Extract<CustomFrame, { interaction: Name }>}
					respond={(reply) => player.answer(reply)}
				/>
			</div>
		);
	};
}

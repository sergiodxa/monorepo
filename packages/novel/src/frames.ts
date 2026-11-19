/**
 * What a play yields and accepts: frames, each a complete description of one stop, and the
 * replies only a frame's own methods build, so a narrowed frame type decides which replies
 * compile. Also the `GameState` a play exposes and the `Ending` it finishes with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RandomState } from "@sdxc/random";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import type { AssetSource, InteractionDeclaration } from "./declarations.js";
import type { NovelError } from "./errors.js";
import type { Audio, FrameStage, Stage } from "./stage.js";
import type { NovelState, NovelTypes, SchemaInput } from "./types.js";

/** Keys a reply's contents, so only frame methods inside the package can build one. */
export const REPLY = Symbol.for("@sdxc/novel.reply");

/** What a reply says, read by the engine alone. */
export type ReplyBody =
	| { frame: string; kind: "advance" }
	| { frame: string; kind: "choose"; option: string }
	| { frame: string; kind: "complete"; output: unknown };

/** An answer to one frame, built by that frame's `advance()`, `choose()` or `complete()`. */
export interface Reply {
	readonly [REPLY]: ReplyBody;
}

/** What every frame carries. */
export interface FrameBase {
	/** Unique within the play; a reply from any other frame than the current one is refused. */
	id: string;
	/** The name of the scene the stop is in. */
	scene: string;
	stage: FrameStage;
	audio: Audio;
}

/** A speaker as a line shows them. */
export interface Speaker {
	id: string;
	/** The name's message key. */
	name: string;
	color?: string;
}

/** A line of dialogue or narration. */
export interface LineFrame extends FrameBase {
	type: "line";
	/** The characters saying it: none for narration, several for a line said together. */
	speakers: Speaker[];
	key: string;
	/** The message values, evaluated once when the line was reached and kept as shown. */
	values: Record<string, unknown> | undefined;
	voice: AssetSource | null;
	/** True when the player has already read this line, which skip-read-text acts on. */
	seen: boolean;
	advance(): Reply;
}

/** One option on a menu. */
export interface FrameOption {
	/** The label's message key, which `choose()` takes. */
	id: string;
	label: string;
	/** True for an option shown locked; choosing it is refused. */
	disabled: boolean;
	/** The message key that explains a locked option. */
	reason?: string;
	/** True when the option was taken before, which the UI may mark. */
	chosen: boolean;
}

/** A menu. */
export interface ChoiceFrame extends FrameBase {
	type: "choice";
	prompt?: string;
	options: FrameOption[];
	/** Milliseconds the player has to choose; the UI counts down and then takes `default`. */
	timeout?: number;
	default?: string;
	choose(option: string): Reply;
}

/** A pause with no line. */
export interface PauseFrame extends FrameBase {
	type: "pause";
	/** Milliseconds the UI waits before advancing; a test advances at once. */
	duration: number;
	advance(): Reply;
}

/**
 * An interaction the app renders itself, typed from the interactions the app declared.
 *
 * @template Name - The interaction's name, which narrows the union.
 * @template Input - The schema of what the interaction receives.
 * @template Output - The schema its reply is validated against.
 */
export interface InteractionFrame<
	Name extends string = string,
	Input extends StandardSchemaV1 = StandardSchemaV1,
	Output extends StandardSchemaV1 = StandardSchemaV1,
> extends FrameBase {
	type: "custom";
	interaction: Name;
	input: StandardSchemaV1.InferOutput<Input>;
	complete(output: SchemaInput<Output>): Reply;
}

/** The interactions the app declared through {@link NovelTypes}, or any until it does. */
type NovelInteractions = NovelTypes extends { interactions: infer Map }
	? Map
	: Record<string, InteractionDeclaration>;

/** A custom frame for each declared interaction, narrowed by `frame.interaction`. */
export type CustomFrame = {
	[Key in keyof NovelInteractions]: NovelInteractions[Key] extends InteractionDeclaration<
		infer Name,
		infer Input,
		infer Output
	>
		? InteractionFrame<Name, Input, Output>
		: never;
}[keyof NovelInteractions];

/** Every frame a reply can answer. */
export type StopFrame = LineFrame | ChoiceFrame | PauseFrame | CustomFrame;

/**
 * A reply the engine refused, or a jump it could not take. Answer it through the frame it
 * carries, which is still the current stop; it is `null` when the play could not reach its
 * first stop, and calling `next()` again retries.
 */
export interface ErrorFrame {
	type: "error";
	error: NovelError;
	frame: StopFrame | null;
}

/** Everything a play yields. */
export type Frame = StopFrame | ErrorFrame;

/** How a play finished. */
export interface Ending {
	/** The ending's message key, or `null` when the story ran out without reaching one. */
	key: string | null;
	/** The scene the play finished in. */
	scene: string;
}

/** A place in the story, anchored on the message key of the stop it names. */
export interface StoryPosition {
	/** The scene's name. */
	scene: string;
	/**
	 * The stop's anchor: a line's key, or a menu's prompt key (its first option's key without
	 * one); a pause, interaction or call is anchored as `<key before it>+<n>`.
	 */
	line: string;
}

/**
 * A playthrough as JSON: everything a save needs to resume at the same stop with the same
 * stage, audio, state and random stream.
 */
export interface GameState {
	position: StoryPosition;
	/** The calls to return from, innermost last; each anchored on its `call`. */
	stack: StoryPosition[];
	stage: Stage;
	audio: Audio;
	state: NovelState;
	random: RandomState;
	/** Options taken in this play, as `<scene>:<option>`, which `once` options read. */
	taken: string[];
	meta: {
		/** The scene's title key, or its name when it has no title, for a save slot to show. */
		scene: string;
		savedAt: string;
		/** Milliseconds played, carried across saves. */
		playTime: number;
	};
}

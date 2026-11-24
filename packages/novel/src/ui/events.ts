/**
 * The DOM events of a player: a save, a settings change and an ending from its root, which an
 * app stores; an interaction's completion, which `NovelPlayer.Interaction` answers the frame
 * with; and the library screens' picks, whose default a listener may prevent. They all bubble.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { InteractionDeclaration, SceneDeclaration } from "../declarations.js";
import type { Ending, GameState, ReplayScope } from "../frames.js";
import type { StartOptions } from "../novel.js";
import type { SchemaInput } from "../types.js";

import type { MemoryLine } from "./library.js";
import type { NovelSettings } from "./settings.js";

declare global {
	interface HTMLElementEventMap {
		"novel:save": NovelSaveEvent;
		"novel:settings": NovelSettingsEvent;
		"novel:ending": NovelEndingEvent;
		"novel:interaction:complete": InteractionCompleteEvent;
		"novel:replay": NovelReplayEvent;
		"novel:replay-voice": NovelReplayVoiceEvent;
		"novel:start": NovelStartEvent;
	}
}

/**
 * Dispatched as `novel:save` when the reader saves, with the slot and the play as JSON for the
 * app to store; the save also reaches the novel's `save` event.
 *
 * @example on("novel:save", (event) => store(event.slot, event.state))
 */
export class NovelSaveEvent extends Event {
	readonly slot: string;
	readonly state: GameState;

	/**
	 * @param slot - The slot the reader saved into.
	 * @param state - The play as JSON.
	 */
	constructor(slot: string, state: GameState) {
		super("novel:save", { bubbles: true });
		this.slot = slot;
		this.state = state;
	}
}

/**
 * Dispatched as `novel:settings` whenever the reader changes a setting, with the whole settings
 * object, so the app stores one JSON value and passes it back through `settings`.
 *
 * @example on("novel:settings", (event) => store(event.settings))
 */
export class NovelSettingsEvent extends Event {
	readonly settings: NovelSettings;

	/** @param settings - Every setting, as the reader left them. */
	constructor(settings: NovelSettings) {
		super("novel:settings", { bubbles: true });
		this.settings = settings;
	}
}

/**
 * Dispatched as `novel:ending` when the play reaches an ending or runs out of story, which a
 * replay with no play to resume also does.
 *
 * @example on("novel:ending", (event) => showCredits(event.ending.key))
 */
export class NovelEndingEvent extends Event {
	readonly ending: Ending;

	/** @param ending - The ending's key (`null` when the story ran out) and its scene. */
	constructor(ending: Ending) {
		super("novel:ending", { bubbles: true });
		this.ending = ending;
	}
}

/**
 * Dispatched as `novel:interaction:complete` by an interaction's component when it is done,
 * with the output typed by the declaration's output schema. `NovelPlayer.Interaction` answers
 * the current frame with it when the frame is that interaction; the engine validates the output.
 *
 * @template Declaration - The interaction it completes.
 * @example root.dispatchEvent(new InteractionCompleteEvent(INTERACTIONS.fishing, { caught: 3 }))
 */
export class InteractionCompleteEvent<
	Declaration extends InteractionDeclaration = InteractionDeclaration,
> extends Event {
	/** The name of the interaction it completes, which a custom frame carries. */
	readonly interaction: Declaration["name"];
	readonly output: SchemaInput<Declaration["output"]>;

	/**
	 * @param declaration - The interaction, from the app's `interactions()` map.
	 * @param output - What it hands back to the scene.
	 */
	constructor(declaration: Declaration, output: SchemaInput<Declaration["output"]>) {
		super("novel:interaction:complete", { bubbles: true });
		this.interaction = declaration.name;
		this.output = output;
	}
}

/**
 * Dispatched as `novel:replay` by `ChapterSelect` and `SceneReplay` when the reader picks a
 * reached entry. Inside a player the screen then starts the replay itself, unless a listener
 * calls `preventDefault()`; outside one the listener starts it.
 *
 * @example on("novel:replay", (event) => play({ scene: event.scene, replay: event.scope }))
 */
export class NovelReplayEvent extends Event {
	/** A chapter's first mapped scene, or the scene picked. */
	readonly scene: SceneDeclaration;
	/** `"chapter"` from `ChapterSelect`, `"scene"` from `SceneReplay`: where the replay ends. */
	readonly scope: ReplayScope;

	/**
	 * @param scene - The scene to start from.
	 * @param scope - How much of the story the replay plays.
	 */
	constructor(scene: SceneDeclaration, scope: ReplayScope) {
		super("novel:replay", { bubbles: true, cancelable: true });
		this.scene = scene;
		this.scope = scope;
	}
}

/**
 * Dispatched as `novel:replay-voice` by `Memories` when the reader replays a line's voice.
 * Inside a player the screen then plays it through the player's mixer, unless a listener calls
 * `preventDefault()`; outside one the listener plays it.
 *
 * @example on("novel:replay-voice", (event) => play(event.line.voice))
 */
export class NovelReplayVoiceEvent extends Event {
	/** The line, whose `voice` is the URL to play. */
	readonly line: MemoryLine;

	/** @param line - The remembered line whose voice the reader asked for. */
	constructor(line: MemoryLine) {
		super("novel:replay-voice", { bubbles: true, cancelable: true });
		this.line = line;
	}
}

/**
 * Dispatched as `novel:start` by `NovelPlayer.Title` when the reader begins a play: a new game,
 * Continue from the newest save, or a chapter or scene replay. `start` is what to mount a
 * player with; `NovelPlayer.Default` swaps its title screen for that play by itself.
 *
 * @example on("novel:start", (event) => play(event.start))
 */
export class NovelStartEvent extends Event {
	/** The title's `start` with the save to resume, or the scene and scope to replay. */
	readonly start: StartOptions;

	/** @param start - What the play starts from. */
	constructor(start: StartOptions) {
		super("novel:start", { bubbles: true });
		this.start = start;
	}
}

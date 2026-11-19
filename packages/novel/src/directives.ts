/**
 * `createScene()` and the directives a scene is made of. The builder runs once, when the scene's
 * module loads, and returns plain data: every line, jump, asset and choice sits in the array,
 * which is what lets the engine save a position by message key and lets tools read a scene.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";

import type {
	AssetDeclaration,
	CharacterDeclaration,
	InteractionDeclaration,
	LayerImage,
	SceneDeclaration,
	SpriteImage,
} from "./declarations.js";
import type { CharacterTransition, Position, SceneryTransition } from "./stage.js";
import type {
	LineKey,
	LineValues,
	NovelState,
	PathAccepting,
	PathValue,
	PlayTools,
	SchemaInput,
	StatePath,
	StateRecord,
} from "./types.js";

/**
 * A callback as a directive stores it. The builders type it from the app's state; the engine
 * calls it with whatever state the play holds.
 */
export type StoredCallback<Value> = (state: StateRecord, tools: PlayTools) => Value;

/** Shows a background or a full-screen image. */
export interface ShowDirective {
	type: "show";
	asset: AssetDeclaration<"background" | "image">;
	transition?: SceneryTransition;
}

/** Removes the full-screen image. */
export interface HideDirective {
	type: "hide";
	asset: AssetDeclaration<"image">;
	transition?: SceneryTransition;
}

/** Puts a character on stage. */
export interface EnterDirective {
	type: "enter";
	character: CharacterDeclaration;
	at: Position;
	expression?: string;
	layers?: Record<string, string>;
	transition?: CharacterTransition;
}

/** Takes a character off stage. */
export interface ExitDirective {
	type: "exit";
	character: CharacterDeclaration;
	transition?: CharacterTransition;
}

/** Changes the sprite or layers a character shows. */
export interface ExpressDirective {
	type: "express";
	character: CharacterDeclaration;
	expression?: string;
	layers?: Record<string, string>;
	transition?: CharacterTransition;
}

/** Moves a character to another column. */
export interface MoveDirective {
	type: "move";
	character: CharacterDeclaration;
	at: Position;
	transition?: CharacterTransition;
}

/** A line spoken by one or more characters; a stop. */
export interface SayDirective {
	type: "say";
	speakers: CharacterDeclaration[];
	key: string;
	values?: object | StoredCallback<object>;
}

/** A line with no speaker; a stop. */
export interface NarrateDirective {
	type: "narrate";
	key: string;
	values?: object | StoredCallback<object>;
}

/** One option of a menu, normalized to its object form. */
export interface ChoiceOptionDirective {
	/** The label's message key, which is also the option's id. */
	key: string;
	when?: StoredCallback<boolean>;
	visibility: "hidden" | "disabled";
	reason?: string;
	once: boolean;
	done: boolean;
	/** The directives the option runs when taken. */
	do: Directive[];
}

/** A menu; a stop. */
export interface ChooseDirective {
	type: "choose";
	options: ChoiceOptionDirective[];
	prompt?: string;
	repeat: boolean;
	timeout?: number;
	default?: string;
}

/** Runs one list of directives or the other, by a condition read at play time. */
export interface WhenDirective {
	type: "when";
	condition: StoredCallback<boolean>;
	/** The directives run when the condition holds. */
	do: Directive[];
	otherwise: Directive[];
}

/** Changes state at a dotted path. */
export interface SetDirective {
	type: "set";
	path: string;
	update: unknown;
}

/** Continues in another scene. */
export interface GotoDirective {
	type: "goto";
	scene: SceneDeclaration;
}

/** Plays another scene and returns to the next directive. */
export interface CallDirective {
	type: "call";
	scene: SceneDeclaration;
}

/** Returns from a called scene. */
export interface BackDirective {
	type: "back";
}

/** A pause with no line; a stop the player advances after `duration`. */
export interface WaitDirective {
	type: "wait";
	duration: number;
}

/** Starts music, an ambience loop or a sound. */
export interface PlayDirective {
	type: "play";
	asset: AssetDeclaration<"music" | "ambience" | "sound">;
	volume?: number;
	fade?: number;
}

/** Stops the music, every ambience loop, or one of them. */
export interface StopDirective {
	type: "stop";
	channel: "music" | "ambience";
	asset?: AssetDeclaration<"ambience">;
	fade?: number;
}

/** Hands the screen to an app-rendered interaction; a stop. */
export interface CustomDirective {
	type: "custom";
	interaction: InteractionDeclaration;
	input: unknown;
	into?: string;
}

/** Records an ending and finishes the play. */
export interface EndingDirective {
	type: "ending";
	key: string;
}

/** Every directive a scene can hold. */
export type Directive =
	| ShowDirective
	| HideDirective
	| EnterDirective
	| ExitDirective
	| ExpressDirective
	| MoveDirective
	| SayDirective
	| NarrateDirective
	| ChooseDirective
	| WhenDirective
	| SetDirective
	| GotoDirective
	| CallDirective
	| BackDirective
	| WaitDirective
	| PlayDirective
	| StopDirective
	| CustomDirective
	| EndingDirective;

/** A character that can stand on stage: one drawn from sprites or layers. */
// oxlint-disable-next-line typescript/no-explicit-any -- matches every sprite and layer set
export type StagedCharacter = CharacterDeclaration<SpriteImage<any> | LayerImage<any>>;

/** The layer variants a layered character can show, one name per layer. */
type LayerChoice<Image> =
	Image extends LayerImage<infer Layers>
		? { [Layer in keyof Layers]: keyof Layers[Layer] & string }
		: never;

/** The sprite names a sprite character can show. */
type SpriteName<Image> = Image extends SpriteImage<infer Sprites> ? keyof Sprites & string : never;

/** The image shape of a declared character. */
type ImageOf<Character> = Character extends CharacterDeclaration<infer Image> ? Image : never;

/**
 * The options `enter` takes for a character: a sprite by name (the first by default), or a
 * variant for every layer.
 *
 * @template Character - The character entering.
 */
export type EnterOptions<Character> =
	ImageOf<Character> extends SpriteImage<infer _Sprites>
		? {
				at: Position;
				expression?: SpriteName<ImageOf<Character>>;
				transition?: CharacterTransition;
			}
		: ImageOf<Character> extends LayerImage<infer _Layers>
			? { at: Position; layers: LayerChoice<ImageOf<Character>>; transition?: CharacterTransition }
			: never;

/**
 * The options `express` takes: another sprite, or new variants for any of the layers.
 *
 * @template Character - The character changing.
 */
export type ExpressOptions<Character> =
	ImageOf<Character> extends SpriteImage<infer _Sprites>
		? { expression: SpriteName<ImageOf<Character>>; transition?: CharacterTransition }
		: ImageOf<Character> extends LayerImage<infer _Layers>
			? { layers: Partial<LayerChoice<ImageOf<Character>>>; transition?: CharacterTransition }
			: never;

/** An option of a menu that needs more than its directives. */
export interface ChoiceOption {
	/** Offers the option only while this holds. */
	when?: (state: Readonly<NovelState>, tools: PlayTools) => boolean;
	/** What a failed `when` looks like: removed (the default) or shown locked with `reason`. */
	visibility?: "hidden" | "disabled";
	/** The message key a disabled option shows. */
	reason?: LineKey;
	/** Removes the option once it has been taken in this play. */
	once?: boolean;
	/** Ends a repeating menu: after this option's directives the play continues past the menu. */
	done?: boolean;
	/** The directives the option runs when taken. */
	do: Directive[];
}

/** A menu's options keyed by label: a list of directives, or an option object. */
export type ChoiceOptions = { readonly [Key in LineKey]?: Directive[] | ChoiceOption };

/**
 * How a menu behaves beyond its options.
 *
 * @template Options - The menu's options, whose keys `default` names.
 */
export interface MenuOptions<Options> {
	/** The prompt's message key. */
	prompt?: LineKey;
	/** Brings the menu back after a branch that stays in the scene, which is how a question hub is written. */
	repeat?: boolean;
	/** Milliseconds the player has to choose; the player UI counts down. */
	timeout?: number;
	/** The option a timed menu takes when the time runs out. */
	default?: keyof Options & string;
}

/** What a scene's builder receives: every directive, as functions that return plain data. */
export interface SceneContext {
	/** Sets the background, or shows a full-screen image over it. */
	show(
		asset: AssetDeclaration<"background" | "image">,
		options?: { transition?: SceneryTransition },
	): ShowDirective;
	/** Removes the full-screen image. */
	hide(
		asset: AssetDeclaration<"image">,
		options?: { transition?: SceneryTransition },
	): HideDirective;
	/** Puts a character on stage at a column, showing a sprite or a variant per layer. */
	enter<Character extends StagedCharacter>(
		character: Character,
		options: EnterOptions<Character>,
	): EnterDirective;
	/** Takes a character off stage. */
	exit(character: StagedCharacter, options?: { transition?: CharacterTransition }): ExitDirective;
	/** Changes the sprite or layers a character shows. */
	express<Character extends StagedCharacter>(
		character: Character,
		options: ExpressOptions<Character>,
	): ExpressDirective;
	/** Moves a character to another column. */
	move(
		character: StagedCharacter,
		options: { at: Position; transition?: CharacterTransition },
	): MoveDirective;
	/** A line spoken by a character, or by several at once; the play stops for the player. */
	say<Key extends LineKey>(
		speaker: CharacterDeclaration | readonly CharacterDeclaration[],
		key: Key,
		...values: LineValues<Key>
	): SayDirective;
	/** A line with no speaker; the play stops for the player. */
	narrate<Key extends LineKey>(key: Key, ...values: LineValues<Key>): NarrateDirective;
	/** A menu; the play stops for the player's choice. */
	choose<const Options extends ChoiceOptions>(
		options: Options,
		menu?: MenuOptions<Options>,
	): ChooseDirective;
	/** Runs `directives` when the condition holds, and `otherwise` when it does not. */
	when(
		condition: (state: Readonly<NovelState>, tools: PlayTools) => boolean,
		directives: Directive[],
		otherwise?: Directive[],
	): WhenDirective;
	/** Sets state at a path, to a value or to what a function makes of the current one. */
	set<Path extends StatePath<NovelState>>(
		path: Path,
		update:
			| PathValue<NovelState, Path>
			| ((
					value: PathValue<NovelState, Path>,
					state: Readonly<NovelState>,
					tools: PlayTools,
			  ) => PathValue<NovelState, Path>),
	): SetDirective;
	/** Continues in another scene. */
	goto(scene: SceneDeclaration): GotoDirective;
	/** Plays another scene, then continues with the next directive. */
	call(scene: SceneDeclaration): CallDirective;
	/** Returns from a called scene before its end. */
	back(): BackDirective;
	/** A pause with no line, which the player advances after `duration` milliseconds. */
	wait(duration: number): WaitDirective;
	/** Starts music, an ambience loop, or a one-shot sound. */
	play(
		asset: AssetDeclaration<"music" | "ambience" | "sound">,
		options?: { volume?: number; fade?: number },
	): PlayDirective;
	/** Stops the music, every ambience loop, or one ambience loop. */
	stop(
		target: "music" | "ambience" | AssetDeclaration<"ambience">,
		options?: { fade?: number },
	): StopDirective;
	/** Hands the screen to an interaction; its validated output is stored at `into`. */
	custom<Interaction extends InteractionDeclaration>(
		interaction: Interaction,
		options: {
			input: SchemaInput<Interaction["input"]>;
			into?: PathAccepting<NovelState, StandardSchemaV1.InferOutput<Interaction["output"]>>;
		},
	): CustomDirective;
	/** Records an ending and finishes the play. */
	ending(key: LineKey): EndingDirective;
}

/** Copies the transition onto a directive only when one was given. */
function withTransition<Value extends object>(
	value: Value,
	transition: string | undefined,
): Value & { transition?: string } {
	return transition === undefined ? value : { ...value, transition };
}

/** Normalizes one menu option to its object form. */
function normalizeOption(key: string, option: Directive[] | ChoiceOption): ChoiceOptionDirective {
	if (Array.isArray(option)) {
		return { key, visibility: "hidden", once: false, done: false, do: option };
	}
	let normalized: ChoiceOptionDirective = {
		key,
		visibility: option.visibility ?? "hidden",
		once: option.once ?? false,
		done: option.done ?? false,
		do: option.do,
	};
	if (option.when !== undefined) normalized.when = option.when as StoredCallback<boolean>;
	if (option.reason !== undefined) normalized.reason = option.reason;
	return normalized;
}

/**
 * The directive builders every scene receives. They read no state and keep none, so one
 * object serves every scene.
 */
const sceneContext: SceneContext = {
	show(asset, options = {}) {
		return withTransition({ type: "show", asset }, options.transition);
	},
	hide(asset, options = {}) {
		return withTransition({ type: "hide", asset }, options.transition);
	},
	enter(character, options) {
		let picked = options as {
			at: Position;
			expression?: string;
			layers?: Record<string, string>;
			transition?: string;
		};
		let directive: EnterDirective = { type: "enter", character, at: picked.at };
		if (picked.expression !== undefined) directive.expression = picked.expression;
		if (picked.layers !== undefined) directive.layers = picked.layers;
		return withTransition(directive, picked.transition);
	},
	exit(character, options = {}) {
		return withTransition({ type: "exit", character }, options.transition);
	},
	express(character, options) {
		let picked = options as {
			expression?: string;
			layers?: Record<string, string>;
			transition?: string;
		};
		let directive: ExpressDirective = { type: "express", character };
		if (picked.expression !== undefined) directive.expression = picked.expression;
		if (picked.layers !== undefined) directive.layers = picked.layers;
		return withTransition(directive, picked.transition);
	},
	move(character, options) {
		return withTransition({ type: "move", character, at: options.at }, options.transition);
	},
	say(speaker, key, ...values) {
		let speakers: CharacterDeclaration[] = Array.isArray(speaker)
			? [...(speaker as readonly CharacterDeclaration[])]
			: [speaker as CharacterDeclaration];
		let directive: SayDirective = { type: "say", speakers, key };
		if (values[0] !== undefined) directive.values = values[0] as SayDirective["values"];
		return directive;
	},
	narrate(key, ...values) {
		let directive: NarrateDirective = { type: "narrate", key };
		if (values[0] !== undefined) directive.values = values[0] as NarrateDirective["values"];
		return directive;
	},
	choose(options, menu = {}) {
		let entries = Object.entries(options as Record<string, Directive[] | ChoiceOption>);
		let directive: ChooseDirective = {
			type: "choose",
			options: entries.map(([key, option]) => normalizeOption(key, option)),
			repeat: menu.repeat ?? false,
		};
		if (menu.prompt !== undefined) directive.prompt = menu.prompt;
		if (menu.timeout !== undefined) directive.timeout = menu.timeout;
		if (menu.default !== undefined) directive.default = menu.default;
		return directive;
	},
	when(condition, directives, otherwise = []) {
		return {
			type: "when",
			condition: condition as StoredCallback<boolean>,
			do: directives,
			otherwise,
		};
	},
	set(path, update) {
		return { type: "set", path, update };
	},
	goto(target) {
		return { type: "goto", scene: target };
	},
	call(target) {
		return { type: "call", scene: target };
	},
	back() {
		return { type: "back" };
	},
	wait(duration) {
		return { type: "wait", duration };
	},
	play(asset, options = {}) {
		let directive: PlayDirective = { type: "play", asset };
		if (options.volume !== undefined) directive.volume = options.volume;
		if (options.fade !== undefined) directive.fade = options.fade;
		return directive;
	},
	stop(target, options = {}) {
		let directive: StopDirective =
			typeof target === "string"
				? { type: "stop", channel: target }
				: { type: "stop", channel: "ambience", asset: target };
		if (options.fade !== undefined) directive.fade = options.fade;
		return directive;
	},
	custom(target, options) {
		let directive: CustomDirective = { type: "custom", interaction: target, input: options.input };
		if (options.into !== undefined) directive.into = options.into;
		return directive;
	},
	ending(key) {
		return { type: "ending", key };
	},
};

/**
 * A scene's module as `createScene()` builds it: the scene it was written for and its
 * directives.
 *
 * @template Declaration - The scene this module plays.
 */
export interface SceneModule<Declaration extends SceneDeclaration = SceneDeclaration> {
	readonly scene: Declaration;
	readonly directives: readonly Directive[];
}

/**
 * Builds a scene's directives once. The builder receives the directive functions and returns
 * the scene as a list; state is read only inside callbacks, which the engine calls at play time.
 *
 * @param declaration - The scene this module plays, from the app's `scenes()` map.
 * @param build - Answers the scene's directives.
 * @returns The module, which the scene's file default-exports for `novel.map()` to load.
 * @example export default createScene(scenes.prologue.opening, (ctx) => [ctx.narrate("opening.welcome")]);
 */
export function createScene<Declaration extends SceneDeclaration>(
	declaration: Declaration,
	build: (ctx: SceneContext) => Directive[],
): SceneModule<Declaration> {
	return { scene: declaration, directives: build(sceneContext) };
}

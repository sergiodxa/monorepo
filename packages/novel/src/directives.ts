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
	EntryDeclaration,
	InteractionDeclaration,
	LayerImage,
	SceneDeclaration,
	SpriteImage,
} from "./declarations.js";
import type { ExtensionCalls, ExtensionContext } from "./extensions.js";
import type { Persistent } from "./persistent.js";
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

import { isEntryDeclaration } from "./declarations.js";

/**
 * A callback as a directive stores it. The builders type it from the app's state; the engine
 * calls it with whatever state the play holds.
 */
export type StoredCallback<Value> = (state: StateRecord, tools: PlayTools<Persistent>) => Value;

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

/** Takes every character off stage at once, each with the same transition. */
export interface ClearDirective {
	type: "clear";
	transition?: CharacterTransition;
}

/** Makes the story introduce a character, whose name the textbox shows from then on. */
export interface IntroduceDirective {
	type: "introduce";
	character: CharacterDeclaration;
}

/** Makes the reader learn an encyclopedia entry, which opens in the encyclopedia from then on. */
export interface LearnDirective {
	type: "learn";
	entry: EntryDeclaration;
}

/** Makes the reader learn a section of a character's bio, which the characters screen shows from then on. */
export interface LearnBioDirective {
	type: "learnBio";
	character: CharacterDeclaration;
	section: string;
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

/**
 * A notification, such as an achievement toast: the play passes it without a stop and emits
 * `notify` with the message key and its values, leaving the state as it was.
 */
export interface NotifyDirective {
	type: "notify";
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

/**
 * Changes an extension's lasting slice, which outlives the playthrough: to `update`, or to what
 * `update` makes of the current value when it is a function.
 */
export interface RememberDirective {
	type: "remember";
	/** The extension's name. */
	extension: string;
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

/**
 * How a pick weighs one candidate when the play reaches it: a positive number, or `true` for 1;
 * `false`, `0` and any other number leave the candidate out.
 */
export type StoredWeight = (
	scene: SceneDeclaration,
	state: StateRecord,
	tools: PlayTools<Persistent>,
) => number | boolean;

/**
 * Continues in, or calls, one of several scenes drawn at play time from the play's seeded
 * stream, so a reload or rollback draws the same scene. Every candidate is listed up front,
 * which is how tools follow each one; when none qualifies the play runs the next directive.
 */
export interface PickDirective {
	type: "pick";
	/** `goto` continues in the picked scene; `call` plays it and returns to the next directive. */
	via: "goto" | "call";
	scenes: SceneDeclaration[];
	/** Without it every candidate weighs 1. */
	weight?: StoredWeight;
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

/**
 * A call to a story extension's method, as a scene records it. The novel replaces it with the
 * directives the method answers when it loads the scene, so a play never runs one.
 */
export interface ExtensionDirective {
	type: "extension";
	/** The extension's name. */
	extension: string;
	method: string;
	args: unknown[];
}

/** Every directive a scene can hold. */
export type Directive =
	| ShowDirective
	| HideDirective
	| EnterDirective
	| ExitDirective
	| ClearDirective
	| IntroduceDirective
	| LearnDirective
	| LearnBioDirective
	| ExpressDirective
	| MoveDirective
	| SayDirective
	| NarrateDirective
	| NotifyDirective
	| ChooseDirective
	| WhenDirective
	| SetDirective
	| RememberDirective
	| GotoDirective
	| CallDirective
	| PickDirective
	| BackDirective
	| WaitDirective
	| PlayDirective
	| StopDirective
	| CustomDirective
	| EndingDirective
	| ExtensionDirective;

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

/**
 * An option of a menu that needs more than its directives.
 *
 * @template State - The state `when` reads.
 * @template Tools - The tools its callbacks receive.
 */
export interface ChoiceOption<State = NovelState, Tools = PlayTools> {
	/** Offers the option only while this holds. */
	when?: (state: Readonly<State>, tools: Tools) => boolean;
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

/**
 * A menu's options keyed by label: a list of directives, or an option object.
 *
 * @template State - The state an option's `when` reads.
 * @template Tools - The tools its callbacks receive.
 */
export type ChoiceOptions<State = NovelState, Tools = PlayTools> = {
	readonly [Key in LineKey]?: Directive[] | ChoiceOption<State, Tools>;
};

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

/**
 * How a pick weighs a candidate: a positive number, `true` for 1, or `false` or `0` to leave it
 * out. It runs when the play reaches the pick, with the state and the play's seeded stream.
 *
 * @template Scene - The candidates.
 * @template State - The state it reads.
 * @template Tools - The tools its callbacks receive.
 */
export type PickWeight<Scene extends SceneDeclaration, State = NovelState, Tools = PlayTools> = (
	scene: Scene,
	state: Readonly<State>,
	tools: Tools,
) => number | boolean;

/**
 * `goto`: continues in a scene, or with `oneOf` in one drawn among candidates.
 *
 * @template State - The state a weight reads.
 * @template Tools - The tools its callbacks receive.
 */
export interface GotoBuilder<State = NovelState, Tools = PlayTools> {
	/** Continues in another scene. */
	(scene: SceneDeclaration): GotoDirective;
	/**
	 * Continues in one of `scenes`, drawn by `weight` (1 each without it) from the play's seeded
	 * stream; when none qualifies the play runs the next directive instead.
	 */
	oneOf<const Scenes extends readonly SceneDeclaration[]>(
		scenes: Scenes,
		weight?: PickWeight<Scenes[number], State, Tools>,
	): PickDirective;
}

/**
 * `call`: plays a scene and returns, or with `oneOf` one drawn among candidates.
 *
 * @template State - The state a weight reads.
 * @template Tools - The tools its callbacks receive.
 */
export interface CallBuilder<State = NovelState, Tools = PlayTools> {
	/** Plays another scene, then continues with the next directive. */
	(scene: SceneDeclaration): CallDirective;
	/**
	 * Plays one of `scenes`, drawn like `goto.oneOf`, then continues with the next directive,
	 * which is also where the play goes when no candidate qualifies.
	 */
	oneOf<const Scenes extends readonly SceneDeclaration[]>(
		scenes: Scenes,
		weight?: PickWeight<Scenes[number], State, Tools>,
	): PickDirective;
}

/**
 * Every built-in directive, as functions that return plain data.
 *
 * @template State - The state callbacks read and `set` writes: the novel's whole state in a
 * scene, the declared state and the extension's own slice in an extension.
 * @template Tools - The tools callbacks receive: the novel's whole persistent data in a scene, its
 * own record and the extension's lasting slice in an extension.
 */
export interface SceneDirectives<State = NovelState, Tools = PlayTools> {
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
	/**
	 * Takes every character off stage at once, each leaving with `transition` as `exit` would, so
	 * the next chapter or scene starts on an empty stage.
	 */
	clear(options?: { transition?: CharacterTransition }): ClearDirective;
	/**
	 * Introduces a character: lines after it show the character's name, where earlier lines showed
	 * the unknown-name label. The play's state keeps it, so saves, loads and rollbacks agree.
	 */
	introduce(character: CharacterDeclaration): IntroduceDirective;
	/**
	 * Opens an encyclopedia entry for the reader, in this play and every later one; the player
	 * announces it the first time.
	 */
	learn(entry: EntryDeclaration): LearnDirective;
	/**
	 * Opens a section of a character's bio, by its id in the character's `bio`, in this play and
	 * every later one; the player announces it the first time.
	 */
	learn(character: CharacterDeclaration, section: string): LearnBioDirective;
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
		...values: LineValues<Key, State, Tools>
	): SayDirective;
	/** A line with no speaker; the play stops for the player. */
	narrate<Key extends LineKey>(
		key: Key,
		...values: LineValues<Key, State, Tools>
	): NarrateDirective;
	/**
	 * Emits `notify` with a message and its values when the play passes it, without a stop; a
	 * rollback or a load landing past it does not emit it again, and a replay never does.
	 */
	notify<Key extends LineKey>(key: Key, ...values: LineValues<Key, State, Tools>): NotifyDirective;
	/** A menu; the play stops for the player's choice. */
	choose<const Options extends ChoiceOptions<State, Tools>>(
		options: Options,
		menu?: MenuOptions<Options>,
	): ChooseDirective;
	/** Runs `directives` when the condition holds, and `otherwise` when it does not. */
	when(
		condition: (state: Readonly<State>, tools: Tools) => boolean,
		directives: Directive[],
		otherwise?: Directive[],
	): WhenDirective;
	/** Sets state at a path, to a value or to what a function makes of the current one. */
	set<Path extends StatePath<State>>(
		path: Path,
		update:
			| PathValue<State, Path>
			| ((
					value: PathValue<State, Path>,
					state: Readonly<State>,
					tools: Tools,
			  ) => PathValue<State, Path>),
	): SetDirective;
	/** Continues in another scene; `goto.oneOf` continues in one drawn at play time. */
	goto: GotoBuilder<State, Tools>;
	/** Plays another scene and returns; `call.oneOf` plays one drawn at play time. */
	call: CallBuilder<State, Tools>;
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
			into?: PathAccepting<State, StandardSchemaV1.InferOutput<Interaction["output"]>>;
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
function normalizeOption(
	key: string,
	option: Directive[] | ChoiceOption<StateRecord>,
): ChoiceOptionDirective {
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
 * Builds the `oneOf` of `goto` or `call`. The candidates are copied, so a list the scene keeps
 * changing afterwards leaves the directive as written.
 */
function pickBuilder(via: PickDirective["via"]) {
	return (scenes: readonly SceneDeclaration[], weight?: PickWeight<SceneDeclaration, never>) => {
		let directive: PickDirective = { type: "pick", via, scenes: [...scenes] };
		if (weight !== undefined) directive.weight = weight as StoredWeight;
		return directive;
	};
}

/**
 * The scenes a directive can continue in or call, with how it gets there, for tools that follow
 * every path a play may take.
 *
 * @param directive - Any directive.
 * @returns The jump's targets, every candidate of a pick included, or `undefined` for a directive that does not jump.
 */
export function jumpOf(
	directive: Directive,
): { via: "goto" | "call"; scenes: readonly SceneDeclaration[] } | undefined {
	if (directive.type === "goto" || directive.type === "call") {
		return { via: directive.type, scenes: [directive.scene] };
	}
	if (directive.type === "pick") return { via: directive.via, scenes: directive.scenes };
	return undefined;
}

/**
 * What a scene's builder receives: every built-in directive, and each declared extension's
 * methods under its name.
 */
export type SceneContext = SceneDirectives & ExtensionCalls;

/**
 * The built-in directive builders. They read no state and keep none, so one object serves
 * every scene and every extension.
 */
const builders: SceneDirectives = {
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
	clear(options = {}) {
		return withTransition({ type: "clear" }, options.transition);
	},
	introduce(character) {
		return { type: "introduce", character };
	},
	learn(declaration: EntryDeclaration | CharacterDeclaration, section?: string): never {
		let directive: LearnDirective | LearnBioDirective = isEntryDeclaration(declaration)
			? { type: "learn", entry: declaration }
			: { type: "learnBio", character: declaration, section: section ?? "" };
		return directive as never;
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
	notify(key, ...values) {
		let directive: NotifyDirective = { type: "notify", key };
		if (values[0] !== undefined) directive.values = values[0] as NotifyDirective["values"];
		return directive;
	},
	choose(options, menu = {}) {
		let entries = Object.entries(
			options as Record<string, Directive[] | ChoiceOption<StateRecord>>,
		);
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
	goto: Object.assign(
		(target: SceneDeclaration): GotoDirective => ({ type: "goto", scene: target }),
		{
			oneOf: pickBuilder("goto"),
		},
	),
	call: Object.assign(
		(target: SceneDeclaration): CallDirective => ({ type: "call", scene: target }),
		{
			oneOf: pickBuilder("call"),
		},
	),
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
 * The context scenes are built with: the built-in builders, and for any other name the methods
 * of the extension so named, each recording its call as an {@link ExtensionDirective}.
 */
const sceneContext = new Proxy(builders, {
	get(target, key, receiver) {
		if (typeof key !== "string" || key in target) return Reflect.get(target, key, receiver);
		return extensionCalls(key);
	},
}) as SceneContext;

/** The methods of the extension named `extension`, each recording the call it receives. */
function extensionCalls(extension: string): Record<string, (...args: unknown[]) => Directive> {
	return new Proxy(
		{},
		{
			get(_target, method) {
				if (typeof method !== "string") return undefined;
				return (...args: unknown[]): ExtensionDirective => ({
					type: "extension",
					extension,
					method,
					args,
				});
			},
		},
	);
}

/**
 * Reports whether `name` is a built-in directive, which an extension cannot be named after
 * since the scene context would never reach it.
 *
 * @param name - A candidate extension name.
 * @returns `true` when the scene context already has a builder by that name.
 */
export function isBuiltinDirective(name: string): boolean {
	return name in builders;
}

/**
 * The context an extension's methods are written with: the built-in builders, `update` for the
 * slice at `name`, and `remember` for its lasting slice.
 *
 * @param name - The extension's name, which is its slice's key in the state.
 * @returns The context its `directives` builder receives.
 */
export function extensionContext(name: string): ExtensionContext<string, unknown, unknown> {
	return {
		...builders,
		update(update) {
			return { type: "set", path: name, update };
		},
		remember(update) {
			return { type: "remember", extension: name, update };
		},
	};
}

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

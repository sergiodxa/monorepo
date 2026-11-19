/**
 * The package entrypoint: declarations for scenes, the cast, assets and interactions, scene
 * modules built from directives, and the novel that maps scenes, plays them as an async generator
 * of frames and emits typed events. Test helpers and checks live in `@sdxc/novel/test`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type {
	AssetDeclaration,
	AssetKind,
	AssetMap,
	AssetSource,
	AssetTree,
	CaptionedSound,
	CastMap,
	ChapterInfo,
	ChapterLeaf,
	ChapterMarker,
	CharacterDeclaration,
	CharacterImage,
	CharacterLeaf,
	CharacterOptions,
	InteractionDeclaration,
	InteractionLeaf,
	InteractionMap,
	LayerImage,
	NoImage,
	SceneDeclaration,
	SceneLeaf,
	SceneMap,
	SceneTree,
	SpriteImage,
} from "./declarations.js";
export type {
	BackDirective,
	CallDirective,
	ChoiceOption,
	ChoiceOptionDirective,
	ChoiceOptions,
	ChooseDirective,
	CustomDirective,
	Directive,
	EndingDirective,
	EnterDirective,
	EnterOptions,
	ExitDirective,
	ExpressDirective,
	ExpressOptions,
	GotoDirective,
	HideDirective,
	MenuOptions,
	MoveDirective,
	NarrateDirective,
	PlayDirective,
	SayDirective,
	SceneContext,
	SceneModule,
	SetDirective,
	ShowDirective,
	StagedCharacter,
	StopDirective,
	StoredCallback,
	WaitDirective,
	WhenDirective,
} from "./directives.js";
export type { NovelErrorCode, NovelErrorOptions } from "./errors.js";
export type {
	ChapterEvent,
	ChoiceEvent,
	LineEvent,
	NovelEventName,
	NovelEvents,
	NovelListener,
	NovelPlugin,
	SaveEvent,
	SceneEvent,
	UnlockEvent,
} from "./events.js";
export type {
	ChoiceFrame,
	CustomFrame,
	Ending,
	ErrorFrame,
	Frame,
	FrameBase,
	FrameOption,
	GameState,
	InteractionFrame,
	LineFrame,
	PauseFrame,
	Reply,
	Speaker,
	StopFrame,
	StoryPosition,
} from "./frames.js";
export type { Lazy } from "./lazy.js";
export type {
	MessageCatalog,
	Migration,
	NovelOptions,
	Play,
	SavedObject,
	StartOptions,
	VoiceLine,
} from "./novel.js";
export type { Persistent } from "./persistent.js";
export type {
	Audio,
	AudioSound,
	AudioTrack,
	CharacterTransition,
	Fraction,
	FrameCharacter,
	FrameStage,
	Position,
	PositionAlias,
	SceneryTransition,
	Stage,
	StageCharacter,
	StageScenery,
} from "./stage.js";
export type {
	DeepPartial,
	LineKey,
	LineValues,
	NovelMessages,
	NovelState,
	NovelTypes,
	PathAccepting,
	PathValue,
	PlayTools,
	StateCallback,
	StatePath,
	StateRecord,
	ValuesInput,
} from "./types.js";

export {
	assets,
	cast,
	chapter,
	chapterOf,
	character,
	interaction,
	interactions,
	scene,
	scenes,
} from "./declarations.js";
export { createScene } from "./directives.js";
export { NovelError } from "./errors.js";
export { lazy } from "./lazy.js";
export { createNovel, Novel } from "./novel.js";

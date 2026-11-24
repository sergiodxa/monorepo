/**
 * The package entrypoint: declarations for scenes, the cast, assets, interactions and story
 * extensions, scene modules built from directives, and the novel that maps scenes, plays them
 * as an async generator of frames and emits typed events. Test helpers and checks live in
 * `@sdxc/novel/test`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type {
	ArcChapters,
	ArcInfo,
	ArcLeaf,
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
	ChapterTree,
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
	CallBuilder,
	ChoiceOptions,
	ChooseDirective,
	ClearDirective,
	CustomDirective,
	Directive,
	EndingDirective,
	EnterDirective,
	EnterOptions,
	ExitDirective,
	ExtensionDirective,
	ExpressDirective,
	ExpressOptions,
	GotoBuilder,
	GotoDirective,
	HideDirective,
	IntroduceDirective,
	MenuOptions,
	MoveDirective,
	NarrateDirective,
	NotifyDirective,
	PickDirective,
	PickWeight,
	PlayDirective,
	RememberDirective,
	SayDirective,
	SceneContext,
	SceneDirectives,
	SceneModule,
	SetDirective,
	ShowDirective,
	StagedCharacter,
	StopDirective,
	StoredCallback,
	StoredWeight,
	WaitDirective,
	WhenDirective,
} from "./directives.js";
export type { NovelErrorCode, NovelErrorOptions } from "./errors.js";
export type {
	AnyExtension,
	Extension,
	ExtensionCalls,
	ExtensionBaseOptions,
	ExtensionContext,
	ExtensionLasting,
	ExtensionListeners,
	ExtensionMethods,
	ExtensionOptions,
	ExtensionPersistent,
	ExtensionScope,
	ExtensionState,
	LastingOptions,
	StatelessExtensionOptions,
} from "./extensions.js";
export type {
	ChapterEvent,
	ChoiceEvent,
	LineEvent,
	NovelEventName,
	NovelEvents,
	NovelListener,
	NovelPlugin,
	NotifyEvent,
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
	ReplayScope,
	Reply,
	Speaker,
	StopFrame,
	StoryPosition,
} from "./frames.js";
export type { Lazy } from "./lazy.js";
export type { NovelLink, ReachedScene, ReachOptions, SceneAsset } from "./links.js";
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
	DeclaredState,
	DeepPartial,
	LineKey,
	LineValues,
	NovelMessages,
	NovelPersistent,
	NovelState,
	NovelTypes,
	PathAccepting,
	PathValue,
	PlayTools,
	SchemaInput,
	StateCallback,
	StatePath,
	StateRecord,
	ValuesInput,
} from "./types.js";

export {
	arc,
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
export { extension } from "./extensions.js";
export { lazy } from "./lazy.js";
export { createNovel, Novel } from "./novel.js";

/**
 * The player UI as `remix/component` components: `NovelPlayer`, the provider that owns a play,
 * the parts composed inside it, the input mixins, and the headless behaviors the parts are built
 * on, so a game replaces any part with its own over the same context.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { MixerSnapshot } from "./ui/audio.js";
export type { BacklogEntry } from "./ui/behaviors/backlog.js";
export type { RevealStatus } from "./ui/behaviors/reveal.js";
export type { Column } from "./ui/layout.js";
export type { GamepadAction } from "./ui/input.js";
export type {
	LibraryAsset,
	LibraryChapter,
	LibraryEnding,
	LibraryScene,
	MemoryLine,
	NovelLibrary,
	SceneLine,
} from "./ui/library.js";
export type { Phase } from "./ui/director.js";
export type {
	AudioChannel,
	NovelLabels,
	NovelSettings,
	PlayerAction,
	SkipMode,
	StoredSettings,
} from "./ui/settings.js";
export type { InteractionName } from "./ui/interaction.js";
export type { NovelThemeVariable } from "./ui/theme.js";
export type { RunningTransition } from "./ui/transitions.js";

export { AudioMixer } from "./ui/audio.js";
export { Backlog } from "./ui/backlog.js";
export { AUTO_PER_CHARACTER_MS, AutoModel } from "./ui/behaviors/auto.js";
export { BacklogModel } from "./ui/behaviors/backlog.js";
export { CountdownExpireEvent, CountdownModel, timeoutOption } from "./ui/behaviors/countdown.js";
export { RevealModel } from "./ui/behaviors/reveal.js";
export { QUICK_SLOT, SaveSlots } from "./ui/behaviors/save-slots.js";
export { SettingsModel } from "./ui/behaviors/settings.js";
export { SKIP_STEP_MS, SkipModel } from "./ui/behaviors/skip.js";
export { ChapterSelect, SceneReplay } from "./ui/chapters.js";
export { ChoiceMenu } from "./ui/choice-menu.js";
export { gamepadControls, keyboardControls, touchControls } from "./ui/controls.js";
export { EndingsList } from "./ui/endings.js";
export { NovelEndingEvent, NovelSaveEvent, NovelSettingsEvent } from "./ui/events.js";
export { Extras } from "./ui/extras.js";
export { Gallery } from "./ui/gallery.js";
export { gamepadActions } from "./ui/input.js";
export { Interaction } from "./ui/interaction.js";
export { columnOf, stillStage } from "./ui/layout.js";
export { endingKeys, readLibrary, sceneLines } from "./ui/library.js";
export { Memories } from "./ui/memories.js";
export { lineMarkup, Message } from "./ui/message.js";
export { MusicRoom } from "./ui/music-room.js";
export { NovelPlayer } from "./ui/player.js";
export { QuickMenu } from "./ui/quick-menu.js";
export { Prefetcher } from "./ui/prefetch.js";
export { SaveScreen, SlotThumbnail } from "./ui/saves.js";
export { DEFAULT_LABELS, DEFAULT_SETTINGS, KEYMAP, resolveSettings } from "./ui/settings.js";
export { RangeSetting, SettingsScreen } from "./ui/settings-screen.js";
export { resolveSource } from "./ui/source.js";
export { CharacterSprite, Scenery, Stage } from "./ui/stage.js";
export { Captions, Line, NamePlate, NextIndicator, Textbox } from "./ui/textbox.js";
export { NOVEL_THEME_VARIABLES } from "./ui/theme.js";
export { BUILT_IN_TRANSITIONS, prefersReducedMotion } from "./ui/transitions.js";

/**
 * The player UI as `remix/component` components: `NovelPlayer`, the provider that owns a play,
 * the parts composed inside it, the input mixins, and the headless behaviors the parts are built
 * on, so a game replaces any part with its own over the same context.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { MixerSnapshot } from "./ui/audio.js";
export type { AutoBehavior } from "./ui/behaviors/auto.js";
export type { AutosaveBehavior } from "./ui/behaviors/autosave.js";
export type { BacklogBehavior, BacklogEntry } from "./ui/behaviors/backlog.js";
export type { CountdownBehavior } from "./ui/behaviors/countdown.js";
export type {
	NotificationInput,
	NotificationMessage,
	NotificationsBehavior,
	NotificationTarget,
	NotificationText,
	NovelNotification,
} from "./ui/behaviors/notifications.js";
export type { ReadBehavior } from "./ui/behaviors/read.js";
export type { RevealBehavior, RevealStatus } from "./ui/behaviors/reveal.js";
export type { SavesBehavior } from "./ui/behaviors/save-slots.js";
export type { SettingsBehavior } from "./ui/behaviors/settings.js";
export type { SkipBehavior } from "./ui/behaviors/skip.js";
export type { Column } from "./ui/layout.js";
export type { GamepadAction } from "./ui/input.js";
export type {
	LibraryArc,
	LibraryAsset,
	LibraryChapter,
	LibraryEnding,
	LibraryScene,
	MemoryLine,
	NovelLibrary,
} from "./ui/library.js";
export type { SceneLine } from "./unlocks.js";
export type { Phase } from "./ui/director.js";
export type { InterfaceSoundRole, InterfaceSounds } from "./ui/interface-sounds.js";
export type {
	AudioChannel,
	NovelLabels,
	NovelSettings,
	PlayerAction,
	SkipMode,
	StoredSettings,
} from "./ui/settings.js";
export type { NovelTheme, NovelThemeVariable } from "./ui/theme.js";
export type { RunningTransition } from "./ui/transitions.js";

export { AudioMixer } from "./ui/audio.js";
export { Backlog } from "./ui/backlog.js";
export { AUTO_PER_CHARACTER_MS, AutoModel } from "./ui/behaviors/auto.js";
export { AUTO_SLOT, AutosaveModel } from "./ui/behaviors/autosave.js";
export { BacklogModel } from "./ui/behaviors/backlog.js";
export { CountdownExpireEvent, CountdownModel, timeoutOption } from "./ui/behaviors/countdown.js";
export { NotificationsModel } from "./ui/behaviors/notifications.js";
export { ReadModel } from "./ui/behaviors/read.js";
export { RevealModel } from "./ui/behaviors/reveal.js";
export { QUICK_SLOT, SaveSlots } from "./ui/behaviors/save-slots.js";
export { SettingsModel } from "./ui/behaviors/settings.js";
export { SKIP_STEP_MS, SkipModel } from "./ui/behaviors/skip.js";
export { ChapterSelect, SceneReplay } from "./ui/chapters.js";
export { ChoiceMenu } from "./ui/choice-menu.js";
export { gamepadControls, keyboardControls, touchControls } from "./ui/controls.js";
export { EndingsList } from "./ui/endings.js";
export {
	InteractionCompleteEvent,
	NovelEndingEvent,
	NovelReplayEvent,
	NovelReplayVoiceEvent,
	NovelSaveEvent,
	NovelSettingsEvent,
	NovelStartEvent,
	NovelTitleEvent,
} from "./ui/events.js";
export { Extras } from "./ui/extras.js";
export { Characters } from "./ui/characters.js";
export { Encyclopedia } from "./ui/encyclopedia.js";
export { Gallery } from "./ui/gallery.js";
export { gamepadActions } from "./ui/input.js";
export { Interaction } from "./ui/interaction.js";
export { columnOf, stillStage } from "./ui/layout.js";
export { readLibrary } from "./ui/library.js";
export { endingKeys, sceneLines } from "./unlocks.js";
export { Memories } from "./ui/memories.js";
export { lineMarkup, Message } from "./ui/message.js";
export { MusicRoom } from "./ui/music-room.js";
export { Notifications } from "./ui/notifications.js";
export { NovelPlayer } from "./ui/player.js";
export { QuickMenu } from "./ui/quick-menu.js";
export { Prefetcher } from "./ui/prefetch.js";
export { SaveScreen, SaveSummary, SlotThumbnail } from "./ui/saves.js";
export { DEFAULT_LABELS, DEFAULT_SETTINGS, KEYMAP, resolveSettings } from "./ui/settings.js";
export { RangeSetting, SettingRow, SettingsScreen } from "./ui/settings-screen.js";
export { resolveSource } from "./ui/source.js";
export { CharacterSprite, Scenery, Stage } from "./ui/stage.js";
export { Captions, Line, NamePlate, NextIndicator, Textbox } from "./ui/textbox.js";
export { NOVEL_THEME_VARIABLES, theme } from "./ui/theme.js";
export { Title } from "./ui/title.js";
export { BUILT_IN_TRANSITIONS, prefersReducedMotion } from "./ui/transitions.js";

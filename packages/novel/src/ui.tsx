/**
 * The player UI as `remix/component` components: `NovelPlayer`, which owns a play and sequences
 * its frames, and the presentational parts it is built from (stage, textbox, choice menu,
 * backlog, save and settings screens), each usable alone so a game can replace any of them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { MixerSnapshot } from "./ui/audio.js";
export type { BacklogEntry } from "./ui/backlog.js";
export type { Column } from "./ui/layout.js";
export type { GamepadAction } from "./ui/input.js";
export type { Phase } from "./ui/director.js";
export type {
	AudioChannel,
	NovelLabels,
	NovelSettings,
	PlayerAction,
	SkipMode,
	StoredSettings,
} from "./ui/settings.js";
export type { RunningTransition } from "./ui/transitions.js";

export { AudioMixer } from "./ui/audio.js";
export { Backlog } from "./ui/backlog.js";
export { ChoiceMenu, timeoutOption } from "./ui/choice-menu.js";
export { gamepadActions, moveFocus, swipeDirection } from "./ui/input.js";
export { columnOf, stillStage } from "./ui/layout.js";
export { lineMarkup, Message } from "./ui/message.js";
export { NovelPlayer } from "./ui/player.js";
export { QuickMenu } from "./ui/quick-menu.js";
export { QUICK_SLOT, SaveScreen, SlotThumbnail } from "./ui/saves.js";
export { DEFAULT_LABELS, DEFAULT_SETTINGS, KEYMAP, resolveSettings } from "./ui/settings.js";
export { RangeSetting, SettingsScreen } from "./ui/settings-screen.js";
export { resolveSource } from "./ui/source.js";
export { CharacterSprite, Scenery, Stage } from "./ui/stage.js";
export { Captions, Textbox } from "./ui/textbox.js";
export { BUILT_IN_TRANSITIONS, prefersReducedMotion } from "./ui/transitions.js";
export { Typewriter, UNREVEALED_HIGHLIGHT } from "./ui/typewriter.js";

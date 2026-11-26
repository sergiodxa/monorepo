/**
 * The player's presentation settings, its interface labels and its keyboard map. Settings are
 * plain JSON the app stores and hands back, and every label is a prop with an English default,
 * so a game translates the chrome the same way it translates its story.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A channel of the mixer, each with its own volume. */
export type AudioChannel = "music" | "ambience" | "sound" | "voice";

/** Which lines skip passes through: only those already read, or every line. */
export type SkipMode = "read" | "all";

/** What a player can change, stored by the app and passed back through `settings`. */
export interface NovelSettings {
	/** Characters revealed per second; `0` shows every line at once. */
	textSpeed: number;
	/** Milliseconds auto mode waits after a line is shown and its voice ends, before the length-based part. */
	autoDelay: number;
	skip: SkipMode;
	/** Volumes between 0 and 1, `master` scaling the four channels. */
	volume: Record<AudioChannel | "master", number>;
	/** A multiplier on the textbox's type size, so text grows with the stage. */
	fontSize: number;
	/** Sets the textbox in a dyslexia-friendly typeface with wider letter and word spacing. */
	dyslexiaFont: boolean;
	/** Reads every line and option aloud through the browser's speech synthesis. */
	selfVoicing: boolean;
}

/** Settings a new player starts with. */
export const DEFAULT_SETTINGS: NovelSettings = {
	textSpeed: 40,
	autoDelay: 1000,
	skip: "read",
	volume: { master: 1, music: 0.8, ambience: 0.8, sound: 1, voice: 1 },
	fontSize: 1,
	dyslexiaFont: false,
	selfVoicing: false,
};

/** Settings as an app stores them: any subset, older saves missing newer fields included. */
export interface StoredSettings extends Partial<Omit<NovelSettings, "volume">> {
	volume?: Partial<NovelSettings["volume"]>;
}

/**
 * Completes stored settings with the defaults.
 *
 * @param stored - What the app kept, possibly partial or from an older version.
 * @returns Every setting, the stored value where there is one.
 */
export function resolveSettings(stored: StoredSettings | undefined): NovelSettings {
	return {
		...DEFAULT_SETTINGS,
		...stored,
		volume: { ...DEFAULT_SETTINGS.volume, ...stored?.volume },
	};
}

/** The interface's own words; the story's text comes from the app's catalog. */
export interface NovelLabels {
	menu: string;
	auto: string;
	skip: string;
	backlog: string;
	save: string;
	load: string;
	quickSave: string;
	quickLoad: string;
	settings: string;
	hide: string;
	fullscreen: string;
	close: string;
	slot: string;
	emptySlot: string;
	replayVoice: string;
	textSpeed: string;
	autoDelay: string;
	skipMode: string;
	skipRead: string;
	skipAll: string;
	volumeMaster: string;
	volumeMusic: string;
	volumeAmbience: string;
	volumeSound: string;
	volumeVoice: string;
	fontSize: string;
	dyslexiaFont: string;
	selfVoicing: string;
	/** The settings screen's tab of text and pacing settings. */
	settingsText: string;
	/** The settings screen's tab of volumes. */
	settingsSound: string;
	/** The settings screen's tab of reading aids. */
	settingsAccessibility: string;
	/** The line the settings screen types at the chosen text speed. */
	textPreview: string;
	/** The text speed's readout when lines show at once. */
	textInstant: string;
	/** The settings screen's button that restores every default. */
	resetSettings: string;
	/** The settings screen's button that closes it. */
	back: string;
	/** The quick menu's button that leaves the play for the title screen. */
	toTitle: string;
	retry: string;
	playAgain: string;
	/** The ending's button that returns to the title screen, in place of Play again. */
	backToTitle: string;
	timeLeft: string;
	extras: string;
	memories: string;
	gallery: string;
	characters: string;
	/** The accessible name of a character's looks on the characters screen. */
	characterLooks: string;
	musicRoom: string;
	endings: string;
	chapterSelect: string;
	sceneReplay: string;
	loading: string;
	locked: string;
	/** Shown in place of an ending's name until the reader reaches it. */
	unknownEnding: string;
	/** Shown in place of a speaker's name until the story introduces them. */
	unknownName: string;
	/** What Memories says before the reader has read a line. */
	noMemories: string;
	play: string;
	stop: string;
	endReplay: string;
	/** The autosave slot's name on the save screens. */
	autosave: string;
	/** The notifications region's accessible name. */
	notifications: string;
	/** The toast shown when an image is shown for the first time in any playthrough. */
	imageUnlocked: string;
	/** The toast shown when a track plays for the first time in any playthrough. */
	musicUnlocked: string;
	/** The toast shown when a scene teaches an encyclopedia entry, followed by its title. */
	entryUnlocked: string;
	/** The encyclopedia screen's name. */
	encyclopedia: string;
	/** The encyclopedia's page listing every entry of every topic. */
	encyclopediaAll: string;
	/** The encyclopedia's search field's placeholder and accessible name. */
	search: string;
	/** The disclosure listing an entry's sections. */
	contents: string;
	/** What a topic says before the reader has learned any of its entries. */
	noEntries: string;
	/** The toast shown on reaching an ending, followed by how many of all endings were reached. */
	endingReached: string;
	/** The title screen's button that starts a play from the beginning. */
	newGame: string;
	/** The title screen's button that resumes the newest save. */
	continue: string;
	/** The title screen menu's accessible name. */
	titleMenu: string;
}

/** English labels, each replaced by the matching key of the player's `labels` prop. */
export const DEFAULT_LABELS: NovelLabels = {
	menu: "Menu",
	auto: "Auto",
	skip: "Skip",
	backlog: "Backlog",
	save: "Save",
	load: "Load",
	quickSave: "Quick save",
	quickLoad: "Quick load",
	settings: "Settings",
	hide: "Hide interface",
	fullscreen: "Full screen",
	close: "Close",
	slot: "Slot",
	emptySlot: "Empty",
	replayVoice: "Replay voice",
	textSpeed: "Text speed",
	autoDelay: "Auto delay",
	skipMode: "Skip",
	skipRead: "Read text only",
	skipAll: "All text",
	volumeMaster: "Master volume",
	volumeMusic: "Music",
	volumeAmbience: "Ambience",
	volumeSound: "Sounds",
	volumeVoice: "Voices",
	fontSize: "Text size",
	dyslexiaFont: "Dyslexia-friendly font",
	selfVoicing: "Read text aloud",
	settingsText: "Text",
	settingsSound: "Sound",
	settingsAccessibility: "Accessibility",
	textPreview: "This is how quickly each line appears.",
	textInstant: "Instant",
	resetSettings: "Reset settings",
	back: "Back",
	toTitle: "Title",
	retry: "Try again",
	playAgain: "Play again",
	backToTitle: "Back to title",
	timeLeft: "Time left",
	extras: "Extras",
	memories: "Memories",
	gallery: "Gallery",
	characters: "Characters",
	characterLooks: "Looks",
	musicRoom: "Music room",
	endings: "Endings",
	chapterSelect: "Chapters",
	sceneReplay: "Scene replay",
	loading: "Loading…",
	locked: "Locked",
	unknownEnding: "???",
	unknownName: "???",
	noMemories: "Nothing to remember yet.",
	play: "Play",
	stop: "Stop",
	endReplay: "End replay",
	autosave: "Autosave",
	notifications: "Notifications",
	imageUnlocked: "CG unlocked",
	musicUnlocked: "Track unlocked",
	entryUnlocked: "New entry",
	encyclopedia: "Encyclopedia",
	encyclopediaAll: "All entries",
	search: "Search…",
	contents: "Contents",
	noEntries: "Nothing learned yet.",
	endingReached: "Ending",
	newGame: "New game",
	continue: "Continue",
	titleMenu: "Title menu",
};

/** What a key does in the player. */
export type PlayerAction =
	| "advance"
	| "auto"
	| "skip"
	| "backlog"
	| "rollback"
	| "hide"
	| "fullscreen"
	| "quickSave"
	| "quickLoad"
	| "save"
	| "load"
	| "settings"
	| "endReplay"
	| "toTitle";

/**
 * The keyboard map, by `KeyboardEvent.key`. Holding Control also skips for as long as it is
 * held, and the wheel rolls back (up) and advances (down).
 */
export const KEYMAP: Readonly<Record<string, PlayerAction>> = {
	" ": "advance",
	Enter: "advance",
	ArrowUp: "rollback",
	PageUp: "rollback",
	ArrowLeft: "backlog",
	l: "backlog",
	a: "auto",
	k: "skip",
	h: "hide",
	f: "fullscreen",
	q: "quickSave",
	w: "quickLoad",
	s: "save",
	o: "load",
	Escape: "settings",
};

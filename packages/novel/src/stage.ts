/**
 * What the player sees and hears at a stop: the stage (background, full-screen image and the
 * characters standing in front) and the four audio channels. Both are complete on every frame
 * and in every save, so a renderer or a loaded save draws them without replaying a scene.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AssetSource } from "./declarations.js";

/** Column `n` of `d` (`1/3` is left of three, `2/2` the right half), or a named alias. */
export type Position = Fraction | PositionAlias;

/** A column as `n/d`, which is how the stage stores every position. */
export type Fraction = `${number}/${number}`;

/** The aliases every novel starts with, which `createNovel({ positions })` can redefine. */
export type PositionAlias = "left" | "center" | "right";

/** Where each alias stands unless a novel redefines it. */
export const DEFAULT_POSITIONS: Readonly<Record<PositionAlias, Fraction>> = {
	left: "1/3",
	center: "2/3",
	right: "3/3",
};

/**
 * Transitions built into the player for backgrounds and images; any other name is a CSS class
 * the app styles.
 */
export type SceneryTransition =
	| "fade"
	| "dissolve"
	| "slide-left"
	| "slide-right"
	| "slide-up"
	| "slide-down"
	| "wipe"
	| "zoom"
	| "flash"
	| "shake"
	| (string & {});

/** Transitions built into the player for characters; any other name is a CSS class. */
export type CharacterTransition = "fade" | "slide" | (string & {});

/**
 * A background or full-screen image on stage. `transition` is set only on the stop where the
 * change happened, so a re-rendered frame never animates twice.
 */
export interface StageScenery {
	/** The asset's id (`backgrounds.cafe`), which a loaded save re-resolves to the current URL. */
	id: string;
	src: AssetSource;
	transition?: SceneryTransition;
}

/** A character standing on stage. */
export interface StageCharacter {
	id: string;
	at: Fraction;
	/** The sprite shown, for a character drawn from sprites. */
	expression?: string;
	/** The variant shown per layer, for a character drawn in layers. */
	layers?: Record<string, string>;
	/** The files to draw, bottom to top: one sprite, or one file per layer. */
	images: AssetSource[];
	/** Set on the stop where the character entered, moved or changed. */
	transition?: CharacterTransition;
}

/** The stage as the story left it: what a save keeps. */
export interface Stage {
	background: StageScenery | null;
	image: StageScenery | null;
	characters: StageCharacter[];
}

/** A character as a frame shows it, with speaker focus. */
export interface FrameCharacter extends StageCharacter {
	/** True for the line's speakers; false for everyone else and on every frame without a line. */
	speaking: boolean;
}

/** The stage as a frame shows it. */
export interface FrameStage extends Omit<Stage, "characters"> {
	characters: FrameCharacter[];
}

/** A looping track on the music or ambience channel. */
export interface AudioTrack {
	id: string;
	src: AssetSource;
	/** A volume between 0 and 1, scaled by the player's channel volume. */
	volume?: number;
	/** How long the track fades in, in milliseconds. */
	fade?: number;
}

/** A one-shot sound played since the previous stop. */
export interface AudioSound {
	id: string;
	src: AssetSource;
	/** The caption's message key. */
	caption?: string;
	volume?: number;
	/** Unique within the play, so a re-rendered frame never plays the same sound twice. */
	occurrence: string;
}

/** What each channel should be playing at a stop. */
export interface Audio {
	/** One loop at a time; the player crossfades when it changes. */
	music: AudioTrack | null;
	/** Loops that layer. */
	ambience: AudioTrack[];
	/** One-shots started since the previous stop. */
	sounds: AudioSound[];
	/** The line's voice, found by speaker and message key. */
	voice: AssetSource | null;
}

/**
 * An empty stage.
 *
 * @returns A stage with nothing on it.
 */
export function emptyStage(): Stage {
	return { background: null, image: null, characters: [] };
}

/**
 * Silence on every channel.
 *
 * @returns Audio with nothing playing.
 */
export function silence(): Audio {
	return { music: null, ambience: [], sounds: [], voice: null };
}

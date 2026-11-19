/**
 * Turns the engine's stage positions into layout: column `n` of `d` becomes a left edge and a
 * width as percentages of the stage, and a saved stage becomes one a frame would show, so a
 * save slot's thumbnail draws with the same component as the play.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Fraction, FrameStage, Stage } from "../stage.js";

/** Where a column sits on the stage, as CSS percentages. */
export interface Column {
	left: string;
	width: string;
	/** True for a column whose center is left of the stage's, which slides in from the left. */
	leftSide: boolean;
}

/**
 * The column a position names; a malformed one centers the character on the whole stage.
 *
 * @param at - A position as `n/d`.
 * @returns The column's left edge and width.
 * @example columnOf("1/3"); // { left: "0%", width: "33.3333%", leftSide: true }
 */
export function columnOf(at: Fraction): Column {
	let [n, d] = at.split("/").map(Number);
	if (n === undefined || d === undefined || !(d > 0) || !(n >= 1) || n > d) {
		return { left: "0%", width: "100%", leftSide: false };
	}
	let width = 100 / d;
	return {
		left: `${round((n - 1) * width)}%`,
		width: `${round(width)}%`,
		leftSide: (n - 0.5) / d < 0.5,
	};
}

/** Rounds a percentage to four decimals, enough for any column count a stage holds. */
function round(value: number): number {
	return Math.round(value * 10_000) / 10_000;
}

/**
 * A saved stage as a frame would show it: nobody speaking and no transition running.
 *
 * @param stage - The stage a `GameState` kept.
 * @returns The stage the stage component draws.
 */
export function stillStage(stage: Stage): FrameStage {
	return {
		background:
			stage.background === null ? null : { id: stage.background.id, src: stage.background.src },
		image: stage.image === null ? null : { id: stage.image.id, src: stage.image.src },
		characters: stage.characters.map(({ transition: _transition, ...character }) => ({
			...character,
			speaking: false,
		})),
	};
}

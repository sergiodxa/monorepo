/**
 * Canonical nature content for the game's content layer.
 *
 * Neutral natures spell out `null` on both sides, so every nature id resolves to
 * a complete record and callers read the modifiers directly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Nature, NatureId } from "~/game/data/nature";

import { Stat } from "~/game/data/stat";

export const NATURES = {
	ADAMANT: { increases: Stat.Attack, decreases: Stat.SpecialAttack },
	BASHFUL: { increases: null, decreases: null },
	BOLD: { increases: Stat.Defense, decreases: Stat.Attack },
	BRAVE: { increases: Stat.Attack, decreases: Stat.Speed },
	CALM: { increases: Stat.SpecialDefense, decreases: Stat.Attack },
	CAREFUL: { increases: Stat.SpecialDefense, decreases: Stat.SpecialAttack },
	DOCILE: { increases: null, decreases: null },
	GENTLE: { increases: Stat.SpecialDefense, decreases: Stat.Defense },
	HARDY: { increases: null, decreases: null },
	HASTY: { increases: Stat.Speed, decreases: Stat.Defense },
	IMPISH: { increases: Stat.Defense, decreases: Stat.SpecialAttack },
	JOLLY: { increases: Stat.Speed, decreases: Stat.SpecialAttack },
	LAX: { increases: Stat.Defense, decreases: Stat.SpecialDefense },
	LONELY: { increases: Stat.Attack, decreases: Stat.Defense },
	MILD: { increases: Stat.SpecialAttack, decreases: Stat.Defense },
	MODEST: { increases: Stat.SpecialAttack, decreases: Stat.Attack },
	NAIVE: { increases: Stat.Speed, decreases: Stat.SpecialDefense },
	NAUGHTY: { increases: Stat.Attack, decreases: Stat.SpecialDefense },
	QUIET: { increases: Stat.SpecialAttack, decreases: Stat.Speed },
	QUIRKY: { increases: null, decreases: null },
	RASH: { increases: Stat.SpecialAttack, decreases: Stat.SpecialDefense },
	RELAXED: { increases: Stat.Defense, decreases: Stat.Speed },
	SASSY: { increases: Stat.SpecialDefense, decreases: Stat.Speed },
	SERIOUS: { increases: null, decreases: null },
	TIMID: { increases: Stat.Speed, decreases: Stat.Attack },
} satisfies Record<NatureId, Nature>;

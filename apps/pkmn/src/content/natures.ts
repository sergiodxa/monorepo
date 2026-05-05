/**
 * Canonical nature content for the game's content layer.
 *
 * This module maps each nature identifier to the stat it raises and the stat it lowers, giving the rest of the app a single source of truth for nature modifiers. Neutral natures are represented explicitly with `null` values so the content remains complete and uniform.
 *
 * As a content-layer file, this module focuses on authored game data rather than mechanics. The engine and domain layers can consume this table without embedding nature-specific values elsewhere, which keeps balancing data centralized and easier to maintain.
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

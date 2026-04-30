import type { Nature, NatureId } from "../domain/nature";

import { Stat } from "../domain/stat";

export const NATURES = {
	MODEST: { increases: Stat.SpecialAttack, decreases: Stat.Attack },
	BRAVE: { increases: Stat.Attack, decreases: Stat.Speed },
	CALM: { increases: Stat.SpecialDefense, decreases: Stat.Attack },
	TIMID: { increases: Stat.Speed, decreases: Stat.Attack },
	JOLLY: { increases: Stat.Speed, decreases: Stat.SpecialAttack },
	HASTY: { increases: Stat.Speed, decreases: Stat.Defense },
	NAIVE: { increases: Stat.Speed, decreases: Stat.SpecialDefense },
	LAX: { increases: Stat.Defense, decreases: Stat.SpecialDefense },
	RELAXED: { increases: Stat.Defense, decreases: Stat.Speed },
	IMPISH: { increases: Stat.Defense, decreases: Stat.SpecialAttack },
	CAREFUL: { increases: Stat.SpecialDefense, decreases: Stat.SpecialAttack },
	SASSY: { increases: Stat.SpecialDefense, decreases: Stat.Speed },
	GENTLE: { increases: Stat.SpecialDefense, decreases: Stat.Defense },
	BOLD: { increases: Stat.Defense, decreases: Stat.Attack },
	DOCILE: { increases: null, decreases: null },
	QUIRKY: { increases: null, decreases: null },
	HARDY: { increases: null, decreases: null },
	LONELY: { increases: Stat.Attack, decreases: Stat.Defense },
	ADAMANT: { increases: Stat.Attack, decreases: Stat.SpecialAttack },
	NAUGHTY: { increases: Stat.Attack, decreases: Stat.SpecialDefense },
} satisfies Record<NatureId, Nature>;

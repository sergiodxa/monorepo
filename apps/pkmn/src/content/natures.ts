import type { Nature } from "../domain/nature";

import { Stat } from "../domain/stat";

export const NATURES = {
	["MODEST" as Nature.Symbol]: { increases: Stat.SpecialAttack, decreases: Stat.Attack },
	["BRAVE" as Nature.Symbol]: { increases: Stat.Attack, decreases: Stat.Speed },
	["CALM" as Nature.Symbol]: { increases: Stat.SpecialDefense, decreases: Stat.Attack },
	["TIMID" as Nature.Symbol]: { increases: Stat.Speed, decreases: Stat.Attack },
	["JOLLY" as Nature.Symbol]: { increases: Stat.Speed, decreases: Stat.SpecialAttack },
	["HASTY" as Nature.Symbol]: { increases: Stat.Speed, decreases: Stat.Defense },
	["NAIVE" as Nature.Symbol]: { increases: Stat.Speed, decreases: Stat.SpecialDefense },
	["LAX" as Nature.Symbol]: { increases: Stat.Defense, decreases: Stat.SpecialDefense },
	["RELAXED" as Nature.Symbol]: { increases: Stat.Defense, decreases: Stat.Speed },
	["IMPISH" as Nature.Symbol]: { increases: Stat.Defense, decreases: Stat.SpecialAttack },
	["CAREFUL" as Nature.Symbol]: { increases: Stat.SpecialDefense, decreases: Stat.SpecialAttack },
	["SASSY" as Nature.Symbol]: { increases: Stat.SpecialDefense, decreases: Stat.Speed },
	["GENTLE" as Nature.Symbol]: { increases: Stat.SpecialDefense, decreases: Stat.Defense },
	["BOLD" as Nature.Symbol]: { increases: Stat.Defense, decreases: Stat.Attack },
	["DOCILE" as Nature.Symbol]: { increases: null, decreases: null },
	["QUIRKY" as Nature.Symbol]: { increases: null, decreases: null },
	["HARDY" as Nature.Symbol]: { increases: null, decreases: null },
	["LONELY" as Nature.Symbol]: { increases: Stat.Attack, decreases: Stat.Defense },
	["ADAMANT" as Nature.Symbol]: { increases: Stat.Attack, decreases: Stat.SpecialAttack },
	["NAUGHTY" as Nature.Symbol]: { increases: Stat.Attack, decreases: Stat.SpecialDefense },
} satisfies Record<Nature.Symbol, Nature>;

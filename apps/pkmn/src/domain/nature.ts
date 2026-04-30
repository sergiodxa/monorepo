import { Stat } from "./stat";

export interface Nature {
	increases: Stat | null;
	decreases: Stat | null;
}

export namespace Nature {
	export type Symbol = string & { __brand: "Nature" };
}

import { describe, test, expect } from "bun:test";

import { assertsSpeciesSymbol } from "~/domain/species";

import { Bestiary } from "./bestiary";

describe(Bestiary, () => {
	let symbol = "BULBASAUR";
	assertsSpeciesSymbol(symbol); // Type guard to ensure symbol is of type Species.Symbol

	test("#constructor initializes sight and caught sets based on arguments", () => {
		let bestiary = new Bestiary({ sight: [], caught: [] });
		expect(bestiary).toBeInstanceOf(Bestiary);
		expect(bestiary.sight.size).toBe(0);
		expect(bestiary.caught.size).toBe(0);
	});

	test("#markAsSighted adds a species to the sight set", () => {
		let bestiary = new Bestiary({ sight: [], caught: [] });
		bestiary.markAsSighted(symbol);
		expect(bestiary.sight.has(symbol)).toBe(true);
	});

	test("#markAsCaught adds a species to the caught set and sight set", () => {
		let bestiary = new Bestiary({ sight: [], caught: [] });
		bestiary.markAsCaught(symbol);
		expect(bestiary.caught.has(symbol)).toBe(true);
		expect(bestiary.sight.has(symbol)).toBe(true);
	});

	test("#toJSON serializes the bestiary to a JSON-compatible format", () => {
		let bestiary = new Bestiary({
			sight: [symbol],
			caught: [symbol],
		});
		let json = bestiary.toJSON();
		expect(json).toEqual({ sight: [symbol], caught: [symbol] });
		expect(JSON.stringify(json)).toBe(JSON.stringify({ sight: [symbol], caught: [symbol] }));
	});

	test(".fromJSON revives a bestiary from a JSON-compatible format", () => {
		let json = { sight: [symbol], caught: [symbol] };
		let bestiary = Bestiary.fromJSON(json);
		expect(bestiary).toBeInstanceOf(Bestiary);
		expect(bestiary.sight.has(symbol)).toBe(true);
		expect(bestiary.caught.has(symbol)).toBe(true);
	});
});

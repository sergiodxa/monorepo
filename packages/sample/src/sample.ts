/**
 * The generator a caller holds: every module drawing from one stream, so a
 * seed reproduces a whole run's worth of data rather than a single value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Dataset } from "./dataset";
import type { CompanyModule } from "./modules/company";
import type { DateModule } from "./modules/date";
import type { HelpersModule } from "./modules/helpers";
import type { InternetModule } from "./modules/internet";
import type { LocationModule } from "./modules/location";
import type { LoremModule } from "./modules/lorem";
import type { NumberModule } from "./modules/number";
import type { PersonModule } from "./modules/person";
import type { StringModule } from "./modules/string";
import type { Random, Seed } from "./random";

import { en } from "./data/en";
import { createCompanyModule } from "./modules/company";
import { createDateModule } from "./modules/date";
import { createHelpersModule } from "./modules/helpers";
import { createInternetModule } from "./modules/internet";
import { createLocationModule } from "./modules/location";
import { createLoremModule } from "./modules/lorem";
import { createNumberModule } from "./modules/number";
import { createPersonModule } from "./modules/person";
import { createStringModule } from "./modules/string";
import { createRandom } from "./random";

/** What a generator is built from. */
export interface SampleOptions {
	/**
	 * The stream to draw from: a seed to open one, or a stream already open.
	 * Required, so a run's data is always replayable from something the caller
	 * knows.
	 */
	seed: Seed | Random;
	/** The lists to draw from, English by default. */
	data?: Dataset;
	/** The instant the `date` module measures from, the current time by default. */
	now?: Date;
}

/** A generator: one stream, one dataset, and the modules that read them. */
export interface Sample {
	/** The seed this generator replays from. */
	readonly seed: Seed;
	person: PersonModule;
	internet: InternetModule;
	location: LocationModule;
	company: CompanyModule;
	lorem: LoremModule;
	number: NumberModule;
	string: StringModule;
	date: DateModule;
	helpers: HelpersModule;
	/**
	 * An independent generator named by `label`, on the same dataset and
	 * reference instant. Its values hold still as calls are added to this one,
	 * which is what keeps one part of a fixture from moving another.
	 */
	derive(label: string): Sample;
}

function isRandom(seed: Seed | Random): seed is Random {
	return typeof seed === "object";
}

/**
 * Build a generator. The same seed, dataset, and sequence of calls produce the
 * same values, so data that reproduces a run is the seed and nothing else.
 *
 * @param options - The stream to draw from, and the lists and reference instant to read.
 * @returns The generator, positioned at its first value.
 * @example createSample({ seed: 42 }).person.record()
 */
export function createSample(options: SampleOptions): Sample {
	let random = isRandom(options.seed) ? options.seed : createRandom(options.seed);
	let data = options.data ?? en;
	let now = options.now ?? new Date();

	let internet = createInternetModule(random, data);

	return {
		seed: random.seed,
		person: createPersonModule(random, data, internet),
		internet,
		location: createLocationModule(random, data),
		company: createCompanyModule(random, data),
		lorem: createLoremModule(random, data),
		number: createNumberModule(random),
		string: createStringModule(random),
		date: createDateModule(random, now),
		helpers: createHelpersModule(random),
		derive(label) {
			return createSample({ seed: random.derive(label), data, now });
		},
	};
}

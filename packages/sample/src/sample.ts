/**
 * The generator a caller holds: every module drawing from one stream, so a
 * seed reproduces a whole run's worth of data rather than a single value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Dataset } from "./dataset";
import type { ColorModule } from "./modules/color";
import type { CompanyModule } from "./modules/company";
import type { DatatypeModule } from "./modules/datatype";
import type { DateModule } from "./modules/date";
import type { GitModule } from "./modules/git";
import type { HackerModule } from "./modules/hacker";
import type { HelpersModule } from "./modules/helpers";
import type { InternetModule } from "./modules/internet";
import type { LocationModule } from "./modules/location";
import type { LoremModule } from "./modules/lorem";
import type { NumberModule } from "./modules/number";
import type { PersonModule } from "./modules/person";
import type { PhoneModule } from "./modules/phone";
import type { StringModule } from "./modules/string";
import type { SystemModule } from "./modules/system";
import type { Random, Seed } from "./random";

import { en } from "./data/en";
import { createColorModule } from "./modules/color";
import { createCompanyModule } from "./modules/company";
import { createDatatypeModule } from "./modules/datatype";
import { createDateModule } from "./modules/date";
import { createGitModule } from "./modules/git";
import { createHackerModule } from "./modules/hacker";
import { createHelpersModule } from "./modules/helpers";
import { createInternetModule } from "./modules/internet";
import { createLocationModule } from "./modules/location";
import { createLoremModule } from "./modules/lorem";
import { createNumberModule } from "./modules/number";
import { createPersonModule } from "./modules/person";
import { createPhoneModule } from "./modules/phone";
import { createStringModule } from "./modules/string";
import { createSystemModule } from "./modules/system";
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
	color: ColorModule;
	datatype: DatatypeModule;
	git: GitModule;
	hacker: HackerModule;
	phone: PhoneModule;
	system: SystemModule;
	helpers: HelpersModule;
	/**
	 * An independent generator named by `label`, on the same dataset and
	 * reference instant. Its values hold still as calls are added to this one,
	 * which is what keeps one part of a fixture from moving another.
	 */
	derive(label: string): Sample;
}

/** The module names a `{{module.method}}` template may reach. */
type ModuleName = Exclude<keyof Sample, "seed" | "derive">;

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
	let phone = createPhoneModule(random);
	let person = createPersonModule(random, data, internet, phone);
	let dates = createDateModule(random, data, now);

	/**
	 * Resolves `person.firstName` for a template, calling the generator it names.
	 * An unknown path is an error rather than an empty string, since a silently
	 * blank field is the hardest kind of template bug to notice.
	 */
	function lookup(path: string): string {
		let [moduleName, methodName] = path.split(".");
		if (moduleName === undefined || methodName === undefined) {
			throw new RangeError(`fake() needs a "module.method" path, received "${path}".`);
		}
		let module = sample[moduleName as ModuleName] as unknown as Record<string, unknown> | undefined;
		let method = module?.[methodName];
		if (typeof method !== "function") {
			throw new RangeError(`fake() found no generator named "${path}".`);
		}
		return String((method as () => unknown).call(module));
	}

	let sample: Sample = {
		seed: random.seed,
		person,
		internet,
		location: createLocationModule(random, data),
		company: createCompanyModule(random, data),
		lorem: createLoremModule(random, data),
		number: createNumberModule(random),
		string: createStringModule(random, now),
		date: dates,
		color: createColorModule(random, data),
		datatype: createDatatypeModule(random),
		git: createGitModule(random, data, person, internet, dates),
		hacker: createHackerModule(random, data),
		phone,
		system: createSystemModule(random, data),
		helpers: createHelpersModule(random, lookup),
		derive(label) {
			return createSample({ seed: random.derive(label), data, now });
		},
	};

	return sample;
}

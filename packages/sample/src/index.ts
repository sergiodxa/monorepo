/**
 * The package entrypoint: the generator, the stream it draws from, and the
 * types a dataset is written against. The English dataset is the default and is
 * also importable on its own for a caller that extends it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export type { Country, Dataset } from "./dataset";

export type { CompanyModule } from "./modules/company";

export type { BetweenOptions, DateModule, SpanOptions } from "./modules/date";

export type {
	HelpersModule,
	MaybeOptions,
	MultipleOptions,
	PickManyOptions,
} from "./modules/helpers";

export type { InternetModule, NameOptions, PasswordOptions } from "./modules/internet";

export type { CityOptions, LocationModule } from "./modules/location";

export type { LoremModule, ParagraphOptions } from "./modules/lorem";

export type { FloatOptions, IntOptions, NumberModule } from "./modules/number";

export type { PersonModule, PersonRecord } from "./modules/person";

export type { StringModule } from "./modules/string";

export type { Random, Seed } from "./random";

export { createRandom, systemSeed } from "./random";

export type { Sample, SampleOptions } from "./sample";

export { createSample } from "./sample";

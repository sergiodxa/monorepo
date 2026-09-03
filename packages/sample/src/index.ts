/**
 * The package entrypoint: the generator, the stream it draws from, and the
 * types a dataset is written against. The English dataset is the default and is
 * also importable on its own for a caller that extends it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export type { Country, Dataset, FirstNames } from "./dataset.js";

export type {
	ColorFormat,
	ColorModule,
	ColorOptions,
	RgbOptions,
	SpaceOptions,
} from "./modules/color.js";

export type { CompanyModule } from "./modules/company.js";

export type { BooleanOptions, DatatypeModule } from "./modules/datatype.js";

export type {
	BetweenOptions,
	BetweensOptions,
	BirthdateOptions,
	DateModule,
	NameOptions as DateNameOptions,
	SpanOptions,
} from "./modules/date.js";

export type { GitModule, ShaOptions } from "./modules/git.js";

export type { HackerModule } from "./modules/hacker.js";

export type {
	GeneratorLookup,
	HelpersModule,
	MaybeOptions,
	MultipleOptions,
	MustacheValues,
	NumberRange,
	PickManyOptions,
	WeightedChoice,
} from "./modules/helpers.js";

export type {
	InternetModule,
	JwtOptions,
	NameOptions,
	PasswordOptions,
} from "./modules/internet.js";

export type {
	CityOptions,
	CoordinateOptions,
	LocationModule,
	NearbyOptions,
	StateOptions,
} from "./modules/location.js";

export type {
	CountOptions,
	LoremModule,
	ParagraphOptions,
	ParagraphsOptions,
} from "./modules/lorem.js";

export type {
	BaseOptions,
	BigIntOptions,
	FloatOptions,
	IntOptions,
	NumberModule,
} from "./modules/number.js";

export type {
	FirstNameOptions,
	FullNameOptions,
	PersonModule,
	PersonRecord,
	SexType,
} from "./modules/person.js";

export type { PhoneModule, PhoneNumberOptions, PhoneStyle } from "./modules/phone.js";

export type { AlphaOptions, HexadecimalOptions, StringModule } from "./modules/string.js";

export type { FileNameOptions, NetworkInterfaceOptions, SystemModule } from "./modules/system.js";

export type { Random, Seed } from "./random.js";

export { createRandom, systemSeed } from "./random.js";

export type { Sample, SampleOptions } from "./sample.js";

export { createSample } from "./sample.js";

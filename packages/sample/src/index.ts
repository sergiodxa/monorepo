/**
 * The package entrypoint: the generator, the stream it draws from, and the
 * types a dataset is written against. The English dataset is the default and is
 * also importable on its own for a caller that extends it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export type { Country, Dataset, FirstNames } from "./dataset";

export type {
	ColorFormat,
	ColorModule,
	ColorOptions,
	RgbOptions,
	SpaceOptions,
} from "./modules/color";

export type { CompanyModule } from "./modules/company";

export type { BooleanOptions, DatatypeModule } from "./modules/datatype";

export type {
	BetweenOptions,
	BetweensOptions,
	BirthdateOptions,
	DateModule,
	NameOptions as DateNameOptions,
	SpanOptions,
} from "./modules/date";

export type { GitModule, ShaOptions } from "./modules/git";

export type { HackerModule } from "./modules/hacker";

export type {
	GeneratorLookup,
	HelpersModule,
	MaybeOptions,
	MultipleOptions,
	MustacheValues,
	NumberRange,
	PickManyOptions,
	WeightedChoice,
} from "./modules/helpers";

export type { InternetModule, JwtOptions, NameOptions, PasswordOptions } from "./modules/internet";

export type {
	CityOptions,
	CoordinateOptions,
	LocationModule,
	NearbyOptions,
	StateOptions,
} from "./modules/location";

export type {
	CountOptions,
	LoremModule,
	ParagraphOptions,
	ParagraphsOptions,
} from "./modules/lorem";

export type {
	BaseOptions,
	BigIntOptions,
	FloatOptions,
	IntOptions,
	NumberModule,
} from "./modules/number";

export type {
	FirstNameOptions,
	FullNameOptions,
	PersonModule,
	PersonRecord,
	SexType,
} from "./modules/person";

export type { PhoneModule, PhoneNumberOptions, PhoneStyle } from "./modules/phone";

export type { AlphaOptions, HexadecimalOptions, StringModule } from "./modules/string";

export type { FileNameOptions, NetworkInterfaceOptions, SystemModule } from "./modules/system";

export type { Random, Seed } from "./random";

export { createRandom, systemSeed } from "./random";

export type { Sample, SampleOptions } from "./sample";

export { createSample } from "./sample";

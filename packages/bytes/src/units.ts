/**
 * The unit tables: every spelling a byte size may use, long names and symbols,
 * mapped to the number of bytes it covers. Decimal units step by 1000 and binary
 * units by 1024, and the unit types derive from the tables so each lives in one place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

const KB = 1000;
const MB = KB * 1000;
const GB = MB * 1000;
const TB = GB * 1000;
const PB = TB * 1000;

const KIB = 1024;
const MIB = KIB * 1024;
const GIB = MIB * 1024;
const TIB = GIB * 1024;
const PIB = TIB * 1024;

/**
 * Long unit names, singular and plural, in bytes. The `-bibyte` names are the
 * binary units, so `"1 megabyte"` is 1000000 and `"1 mebibyte"` is 1048576.
 */
export const LONG_UNIT_BYTES = {
	byte: 1,
	bytes: 1,
	kilobyte: KB,
	kilobytes: KB,
	megabyte: MB,
	megabytes: MB,
	gigabyte: GB,
	gigabytes: GB,
	terabyte: TB,
	terabytes: TB,
	petabyte: PB,
	petabytes: PB,
	kibibyte: KIB,
	kibibytes: KIB,
	mebibyte: MIB,
	mebibytes: MIB,
	gibibyte: GIB,
	gibibytes: GIB,
	tebibyte: TIB,
	tebibytes: TIB,
	pebibyte: PIB,
	pebibytes: PIB,
} as const;

/**
 * Unit symbols in bytes, case-sensitive as SI and IEC write them. `KB` is left
 * out because it means 1000 or 1024 depending on who wrote it, so a kilo size
 * names its base as `kB` or `KiB`.
 */
export const SHORT_UNIT_BYTES = {
	B: 1,
	kB: KB,
	MB,
	GB,
	TB,
	PB,
	KiB: KIB,
	MiB: MIB,
	GiB: GIB,
	TiB: TIB,
	PiB: PIB,
} as const;

/** A unit spelled out after a single space, as in `"10 megabytes"`. */
export type ByteUnit = keyof typeof LONG_UNIT_BYTES;

/** A unit symbol, written with or without a space, as in `"10 MB"` or `"10MiB"`. */
export type ByteUnitShort = keyof typeof SHORT_UNIT_BYTES;

/**
 * Long unit names in bytes as bigints, adding exa through yotta and exbi through
 * yobi, which only a bigint holds exactly.
 */
export const BIG_LONG_UNIT_BYTES = {
	byte: 1n,
	bytes: 1n,
	kilobyte: 1000n,
	kilobytes: 1000n,
	megabyte: 1000n ** 2n,
	megabytes: 1000n ** 2n,
	gigabyte: 1000n ** 3n,
	gigabytes: 1000n ** 3n,
	terabyte: 1000n ** 4n,
	terabytes: 1000n ** 4n,
	petabyte: 1000n ** 5n,
	petabytes: 1000n ** 5n,
	exabyte: 1000n ** 6n,
	exabytes: 1000n ** 6n,
	zettabyte: 1000n ** 7n,
	zettabytes: 1000n ** 7n,
	yottabyte: 1000n ** 8n,
	yottabytes: 1000n ** 8n,
	kibibyte: 1024n,
	kibibytes: 1024n,
	mebibyte: 1024n ** 2n,
	mebibytes: 1024n ** 2n,
	gibibyte: 1024n ** 3n,
	gibibytes: 1024n ** 3n,
	tebibyte: 1024n ** 4n,
	tebibytes: 1024n ** 4n,
	pebibyte: 1024n ** 5n,
	pebibytes: 1024n ** 5n,
	exbibyte: 1024n ** 6n,
	exbibytes: 1024n ** 6n,
	zebibyte: 1024n ** 7n,
	zebibytes: 1024n ** 7n,
	yobibyte: 1024n ** 8n,
	yobibytes: 1024n ** 8n,
} as const;

/** Unit symbols in bytes as bigints, through `YB` and `YiB`, with `KB` left out. */
export const BIG_SHORT_UNIT_BYTES = {
	B: 1n,
	kB: 1000n,
	MB: 1000n ** 2n,
	GB: 1000n ** 3n,
	TB: 1000n ** 4n,
	PB: 1000n ** 5n,
	EB: 1000n ** 6n,
	ZB: 1000n ** 7n,
	YB: 1000n ** 8n,
	KiB: 1024n,
	MiB: 1024n ** 2n,
	GiB: 1024n ** 3n,
	TiB: 1024n ** 4n,
	PiB: 1024n ** 5n,
	EiB: 1024n ** 6n,
	ZiB: 1024n ** 7n,
	YiB: 1024n ** 8n,
} as const;

/** A unit name a bigint size may spell out, as in `"2 exabytes"`. */
export type BigByteUnit = keyof typeof BIG_LONG_UNIT_BYTES;

/** A unit symbol a bigint size may use, as in `"2 EiB"`. */
export type BigByteUnitShort = keyof typeof BIG_SHORT_UNIT_BYTES;

/** The long table widened so arbitrary runtime text can be looked up in it. */
const LONG_UNIT_LOOKUP: Record<string, number | undefined> = LONG_UNIT_BYTES;

/** The short table widened so arbitrary runtime text can be looked up in it. */
const SHORT_UNIT_LOOKUP: Record<string, number | undefined> = SHORT_UNIT_BYTES;

/**
 * Bytes covered by one of a long unit name, resolving only the table's own keys
 * so a lookup like `"toString"` stays scoped to the table.
 *
 * @param unit - Candidate name, e.g. `"megabytes"`.
 * @returns The size in bytes, or `undefined` when the text is not a unit name.
 *
 * @example
 * longUnitToBytes("kibibytes"); // 1024
 */
export function longUnitToBytes(unit: string): number | undefined {
	if (!Object.hasOwn(LONG_UNIT_BYTES, unit)) return undefined;
	return LONG_UNIT_LOOKUP[unit];
}

/**
 * Bytes covered by one of a unit symbol, resolving the table's own keys only.
 *
 * @param unit - Candidate symbol, e.g. `"MiB"`.
 * @returns The size in bytes, or `undefined` when the text is not a symbol this
 * package accepts, `"KB"` and lowercase `"mb"` included.
 *
 * @example
 * shortUnitToBytes("MiB"); // 1048576
 * @example
 * shortUnitToBytes("KB"); // undefined
 */
export function shortUnitToBytes(unit: string): number | undefined {
	if (!Object.hasOwn(SHORT_UNIT_BYTES, unit)) return undefined;
	return SHORT_UNIT_LOOKUP[unit];
}

/** The bigint long table widened so arbitrary runtime text can be looked up in it. */
const BIG_LONG_UNIT_LOOKUP: Record<string, bigint | undefined> = BIG_LONG_UNIT_BYTES;

/** The bigint short table widened so arbitrary runtime text can be looked up in it. */
const BIG_SHORT_UNIT_LOOKUP: Record<string, bigint | undefined> = BIG_SHORT_UNIT_BYTES;

/**
 * Bytes covered by one of a long unit name as a bigint, through `yobibyte`,
 * resolving the table's own keys only.
 *
 * @param unit - Candidate name, e.g. `"exabytes"`.
 * @returns The size in bytes, or `undefined` when the text is not a unit name.
 *
 * @example
 * bigLongUnitToBytes("exbibyte"); // 1152921504606846976n
 */
export function bigLongUnitToBytes(unit: string): bigint | undefined {
	if (!Object.hasOwn(BIG_LONG_UNIT_BYTES, unit)) return undefined;
	return BIG_LONG_UNIT_LOOKUP[unit];
}

/**
 * Bytes covered by one of a unit symbol as a bigint, through `YiB`, resolving
 * the table's own keys only.
 *
 * @param unit - Candidate symbol, e.g. `"EiB"`.
 * @returns The size in bytes, or `undefined` when the text is not a symbol this
 * package accepts.
 *
 * @example
 * bigShortUnitToBytes("EB"); // 1000000000000000000n
 */
export function bigShortUnitToBytes(unit: string): bigint | undefined {
	if (!Object.hasOwn(BIG_SHORT_UNIT_BYTES, unit)) return undefined;
	return BIG_SHORT_UNIT_LOOKUP[unit];
}

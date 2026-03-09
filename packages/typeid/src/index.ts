import type { Base32 } from "./lib/base32";
import type { UUID } from "./lib/uuid";

import { decode, encode } from "./lib/base32";
import {
	EmptyPrefixError,
	InvalidPrefixError,
	InvalidSuffixLengthError,
	MissingSeparatorError,
	PrefixMismatchError,
} from "./lib/errors";
import { isValidPrefix } from "./lib/is-valid-prefix";
import { assertUUID } from "./lib/uuid";

const SEPARATOR = "_";
const SUFFIX_LENGTH = 26;

export class TypeID<const prefix extends string> {
	#prefix: prefix;
	#suffix: Base32;

	constructor(prefix: prefix, suffix: Base32) {
		if (!isValidPrefix(prefix)) throw new InvalidPrefixError(prefix);
		this.#prefix = prefix;
		this.#suffix = suffix;
	}

	public get prefix() {
		return this.#prefix;
	}

	public get suffix() {
		return this.#suffix;
	}

	toUUID(): UUID {
		let decoded = decode(this.suffix);
		assertUUID(decoded);
		return decoded;
	}

	toString() {
		let suffix = encode(this.toUUID());
		if (this.prefix.length === 0) return suffix;
		return [this.prefix, suffix].join(SEPARATOR);
	}

	static fromString<const prefix extends string>(value: string, prefix?: prefix): TypeID<prefix> {
		let separator = value.lastIndexOf(SEPARATOR);

		if (separator === -1) {
			if (value.length < SUFFIX_LENGTH) throw new InvalidSuffixLengthError(value.length);
			if (value.length > SUFFIX_LENGTH) throw new MissingSeparatorError(value);
			decode(value as Base32);
			return new TypeID("" as prefix, value as Base32);
		}

		let actualPrefix = value.slice(0, separator);
		let suffix = value.slice(separator + 1);
		if (!actualPrefix) throw new EmptyPrefixError(value);
		if (suffix.length !== SUFFIX_LENGTH) throw new InvalidSuffixLengthError(suffix.length);
		if (prefix && actualPrefix !== prefix) throw new PrefixMismatchError(prefix, actualPrefix);
		decode(suffix as Base32);
		return new TypeID(actualPrefix as prefix, suffix as Base32);
	}

	static fromUUID<const prefix extends string>(prefix: prefix, uuid: UUID) {
		let suffix = encode(uuid);
		return new TypeID(prefix, suffix);
	}
}

export function typeid<prefix extends string>(prefix: prefix) {
	return (uuid: UUID) => TypeID.fromUUID(prefix, uuid);
}

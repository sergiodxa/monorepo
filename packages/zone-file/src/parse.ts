/**
 * Reads an RFC 1035 master file into the records it declares and the entries it could not
 * use: directives, inherited owners, TTLs and classes, `$INCLUDE` through a caller-supplied
 * reader, and names qualified in owners and in typed RDATA.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Entry, Token } from "./lexer.js";
import type { RelativeNames } from "./names.js";
import type * as ZoneFile from "./types.js";

import { ZoneFileError } from "./errors.js";
import { lex } from "./lexer.js";
import { absoluteName, canonicalName, qualifyName } from "./names.js";
import { parseRecordData } from "./parse-record-data.js";
import { isTypedType } from "./record-types.js";
import { looksLikeTtl, readTtl } from "./ttl.js";

/** Measures input in the UTF-8 bytes `maxBytes` counts. */
const ENCODER = new TextEncoder();

/** @default 1 MiB, larger than any zone a DNS provider accepts for import. */
const DEFAULT_MAX_BYTES = 1024 * 1024;

/** How deep `$INCLUDE` may nest; the text passed to `parse` is depth 0. */
const MAX_INCLUDE_DEPTH = 8;

/** The RDATA fields of each typed type that hold a name, which a relative spelling qualifies. */
const NAME_FIELDS: Record<string, number[]> = {
	CNAME: [0],
	NS: [0],
	PTR: [0],
	DNAME: [0],
	MX: [1],
	SRV: [3],
	SOA: [0, 1],
};

/** The class numbers with a mnemonic, so `CLASS1` and `IN` read as one class. */
const CLASS_NAMES: Record<string, string> = { "1": "IN", "2": "CS", "3": "CH", "4": "HS" };

/** What the reader carries from one entry to the next within one file. */
interface ReaderState {
	origin: string;
	/** The `$TTL` in force, `null` before any. */
	defaultTtl: number | null;
	/** The last TTL a record had, which RFC 1035 gives a record that states none. */
	lastTtl: number | null;
	/** The last owner read, which a blank-owner entry takes. */
	lastOwner: string | null;
	/** The last class read, which a record that states none takes. */
	lastClass: string;
}

/**
 * Reads a zone file. The only failure is `too-large`; every unreadable entry is a
 * `Rejection` beside the records that did parse, so one bad line never costs the rest, and
 * a caller that wants all-or-nothing checks `rejected.length`.
 *
 * Records outside the origin, repeats, non-`IN` classes and every record type are all
 * returned: which of them to keep is the caller's decision.
 *
 * @param text - The zone file's contents.
 * @param options - The origin, and how to read TTLs, includes and relative names.
 * @returns The records and rejections, or the size that passed `maxBytes`.
 * @example parse("www 300 IN A 192.0.2.1", { origin: "example.com" }) // records: [{ name: "www.example.com", ttl: 300, … }]
 */
export function parse(
	text: string,
	options: ZoneFile.ParseOptions,
): Result<ZoneFile.Zone, ZoneFileError> {
	let reader = new ZoneReader(options);
	let state: ReaderState = {
		origin: canonicalName(options.origin) ?? options.origin.toLowerCase(),
		defaultTtl: null,
		lastTtl: null,
		lastOwner: null,
		lastClass: "IN",
	};

	let read = reader.read(text, null, state, 0);
	if (isFailure(read)) return read;

	return success({ origin: state.origin, records: reader.records, rejected: reader.rejected });
}

/** Reads one file's entries into shared record and rejection lists, recursing into includes. */
class ZoneReader {
	readonly records: ZoneFile.Record[] = [];
	readonly rejected: ZoneFile.Rejection[] = [];

	#options: ZoneFile.ParseOptions;
	#maxBytes: number;
	#mode: RelativeNames;
	#bytes = 0;

	/** @param options - The options `parse` was called with. */
	constructor(options: ZoneFile.ParseOptions) {
		this.#options = options;
		this.#maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
		this.#mode = options.relativeNames ?? "rfc1035";
	}

	/**
	 * Reads one file, mutating `state` as its directives and records do; an included file
	 * reads with a copy, so the origin, `$TTL` and owner revert after it.
	 *
	 * @param text - The file's contents.
	 * @param file - The included file's name; `null` for the text passed to `parse`.
	 * @param state - The state the file starts with.
	 * @param depth - How many `$INCLUDE`s led here.
	 */
	read(
		text: string,
		file: string | null,
		state: ReaderState,
		depth: number,
	): Result<void, ZoneFileError> {
		this.#bytes += ENCODER.encode(text).byteLength;
		if (this.#bytes > this.#maxBytes)
			return failure(new ZoneFileError(this.#bytes, this.#maxBytes));

		for (let entry of lex(text)) {
			let reject = (reason: ZoneFile.RejectionReason, message: string) => {
				this.rejected.push({
					file,
					line: entry.line,
					endLine: entry.endLine,
					input: entry.input,
					reason,
					message,
				});
			};

			if (entry.error !== null) {
				reject("malformed", entry.error);
				continue;
			}

			let first = entry.tokens[0];
			if (!entry.blankOwner && first && !first.quoted && first.text.startsWith("$")) {
				let included = this.#directive(entry, file, state, depth, reject);
				if (isFailure(included)) return included;
				continue;
			}

			this.#record(entry, file, state, reject);
		}

		return success(undefined);
	}

	/** Applies one `$` directive to `state`, reading an included file through the option. */
	#directive(
		entry: Entry,
		file: string | null,
		state: ReaderState,
		depth: number,
		reject: (reason: ZoneFile.RejectionReason, message: string) => void,
	): Result<void, ZoneFileError> {
		let [directive, ...args] = entry.tokens;
		let word = (directive?.text ?? "").toUpperCase();

		switch (word) {
			case "$ORIGIN": {
				let origin = args.length === 1 ? this.#name(args[0], state.origin) : null;
				if (origin === null) reject("malformed", "$ORIGIN needs one domain name");
				else state.origin = origin;
				break;
			}

			case "$TTL": {
				let ttl = args.length === 1 && args[0] && !args[0].quoted ? readTtl(args[0].text) : null;
				if (ttl === null) reject("malformed", "$TTL needs one TTL of at most 2147483647 seconds");
				else state.defaultTtl = ttl;
				break;
			}

			case "$INCLUDE": {
				let [fileToken, originToken] = args;
				let fileName = fileToken ? unquote(fileToken) : "";
				let origin = originToken ? this.#name(originToken, state.origin) : state.origin;

				if (args.length < 1 || args.length > 2 || fileName === "" || origin === null) {
					reject("malformed", "$INCLUDE needs a file name and an optional origin");
					break;
				}
				if (!this.#options.include) {
					reject("include", "$INCLUDE needs the include option to read a file");
					break;
				}
				if (depth >= MAX_INCLUDE_DEPTH) {
					reject("include", `$INCLUDE nests deeper than ${MAX_INCLUDE_DEPTH} files`);
					break;
				}

				let included = this.#options.include(fileName, origin);
				if (included === null) {
					reject("include", `The include option returned no text for ${JSON.stringify(fileName)}`);
					break;
				}

				let read = this.read(included, fileName, { ...state, origin }, depth + 1);
				if (isFailure(read)) return read;
				break;
			}

			default:
				reject("unsupported-directive", `${directive?.text ?? word} is not a supported directive`);
		}

		return success(undefined);
	}

	/** Reads one record entry, or rejects it with the reason it cannot be one. */
	#record(
		entry: Entry,
		file: string | null,
		state: ReaderState,
		reject: (reason: ZoneFile.RejectionReason, message: string) => void,
	): void {
		let tokens = entry.tokens;
		let cursor = 0;
		let owner: string | null;

		if (entry.blankOwner) {
			owner = state.lastOwner;
			if (owner === null) {
				reject("missing-owner", "A blank owner needs an earlier record to take it from");
				return;
			}
		} else {
			let ownerToken = tokens[0];
			cursor = 1;
			owner = ownerToken ? this.#name(ownerToken, state.origin) : null;
			if (owner === null) {
				reject("malformed", `Invalid owner name ${JSON.stringify(ownerToken?.text ?? "")}`);
				return;
			}
			state.lastOwner = owner;
		}

		let ttl: number | null = null;
		let recordClass: string | null = null;
		let ttlRead = false;

		while (cursor < tokens.length) {
			let token = tokens[cursor];
			if (!token || token.quoted) break;

			if (!ttlRead && looksLikeTtl(token.text)) {
				ttl = readTtl(token.text);
				if (ttl === null) {
					reject("malformed", `TTL ${token.text} is over 2147483647 seconds`);
					return;
				}
				ttlRead = true;
				cursor += 1;
				continue;
			}

			let classMatch = /^(IN|CH|HS|CS|CLASS(\d+))$/i.exec(token.text);
			if (recordClass === null && classMatch) {
				let number = classMatch[2];
				recordClass =
					number === undefined
						? token.text.toUpperCase()
						: (CLASS_NAMES[String(Number(number))] ?? `CLASS${Number(number)}`);
				cursor += 1;
				continue;
			}

			break;
		}

		let typeToken = tokens[cursor];
		if (!typeToken || typeToken.quoted || !/^[A-Za-z][A-Za-z0-9-]*$/.test(typeToken.text)) {
			let found = typeToken ? `found ${JSON.stringify(typeToken.text)}` : "found nothing";
			reject("malformed", `Expected a record type, ${found}`);
			return;
		}

		let rdata = tokens.slice(cursor + 1);
		if (rdata.length === 0) {
			reject("malformed", `${typeToken.text.toUpperCase()} record has no data`);
			return;
		}

		let data = this.#data(typeToken.text, rdata, state.origin);
		if (typeof data === "string") {
			reject("invalid-data", data);
			return;
		}

		if (ttl !== null) state.lastTtl = ttl;
		let resolvedTtl = ttl ?? state.defaultTtl ?? state.lastTtl ?? this.#options.ttl ?? null;
		if (resolvedTtl !== null) state.lastTtl = resolvedTtl;
		if (recordClass !== null) state.lastClass = recordClass;

		let fields: ZoneFile.RecordFields = {
			name: owner,
			ttl: resolvedTtl,
			class: recordClass ?? state.lastClass,
			file,
			line: entry.line,
			endLine: entry.endLine,
			comment: entry.comment,
		};

		this.records.push(
			(isTypedType(data.type)
				? { ...fields, ...data }
				: { ...fields, ...data, origin: state.origin }) as ZoneFile.Record,
		);
	}

	/**
	 * Reads a record's RDATA for its type: name fields qualified against the origin first,
	 * since `parseRecordData` has no origin to qualify them with. RFC 3597 generic data is
	 * read as is, its names being absolute on the wire.
	 *
	 * @returns The data, or the message for an `invalid-data` rejection.
	 */
	#data(type: string, rdata: Token[], origin: string): { type: string } | string {
		let tokens = rdata.map((token) => token.text);
		let generic = rdata[0]?.text === "\\#" && !rdata[0].quoted;
		let upper = type.toUpperCase();

		if (!generic) {
			for (let index of NAME_FIELDS[upper] ?? []) {
				let token = rdata[index];
				if (!token) continue;
				let name = this.#name(token, origin);
				if (name === null) return `Invalid name ${JSON.stringify(token.text)} in ${upper} data`;
				tokens[index] = absoluteName(name);
			}
		}

		let parsed = parseRecordData(type, tokens.join(" "));
		return isFailure(parsed) ? parsed.error.message : parsed.data;
	}

	/** Qualifies a name field, refusing a quoted one: quotes mark a character-string. */
	#name(token: Token | undefined, origin: string): string | null {
		if (!token || token.quoted) return null;
		return qualifyName(token.text, origin, this.#mode);
	}
}

/** The text of a quoted field with `\X` escapes resolved, or a bare field as written. */
function unquote(token: Token): string {
	if (!token.quoted) return token.text;
	return token.text.slice(1, -1).replace(/\\(.)/g, "$1");
}

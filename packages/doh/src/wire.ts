/**
 * RFC 8484 DNS over HTTPS in wire format (`application/dns-message`): the query is an
 * RFC 1035 message with an EDNS(0) OPT record, and the response is read back into the shape
 * `resolve` works from, RFC 8914 extended errors and extended RCODEs included.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, isSuccess, success } from "@sdxc/result";
import { parseRecordData, typeCode } from "@sdxc/zone-file";

import type { Deadline, Message, MessageRecord, Query } from "./exchange.js";
import type { DoH } from "./types.js";

import { TransportError } from "./errors.js";
import { exchange } from "./exchange.js";

/** The media type RFC 8484 sends and answers in. */
const MEDIA_TYPE = "application/dns-message";

/** The EDNS(0) UDP payload size the query advertises, the DNS Flag Day 2020 default. */
const PAYLOAD_SIZE = 1232;

/** The OPT pseudo-record type, which carries EDNS(0) flags, extended RCODE bits and options. */
const OPT = 41;

/** The EDNS option code of an RFC 8914 extended DNS error. */
const EXTENDED_ERROR_OPTION = 15;

/**
 * The RDATA layout of the types whose names a server may compress (RFC 3597 section 4):
 * NS, CNAME, SOA, PTR and MX, each field a name or a run of octets. Expanding those names
 * turns the RDATA into the generic data `parseRecordData` reads.
 */
const COMPRESSIBLE_NAMES: Record<number, ("name" | number)[]> = {
	2: ["name"],
	5: ["name"],
	6: ["name", "name", 20],
	12: ["name"],
	15: [2, "name"],
};

/** How many compression pointers one name may follow, which bounds a looping message. */
const MAX_POINTERS = 64;

/** Encodes the text of names and option text into octets. */
const ENCODER = new TextEncoder();

/** Decodes an extended error's EXTRA-TEXT, which RFC 8914 makes UTF-8. */
const DECODER = new TextDecoder();

/**
 * The labels of a name as written: an optional trailing dot, each label 1 to 63 octets and
 * the whole name at most 255; `null` for a name that does not fit a question.
 */
function encodeName(name: string): Uint8Array | null {
	let trimmed = name.endsWith(".") ? name.slice(0, -1) : name;
	let labels = trimmed === "" ? [] : trimmed.split(".").map((label) => ENCODER.encode(label));
	if (labels.some((label) => label.length === 0 || label.length > 63)) return null;
	let octets = Uint8Array.from([...labels.flatMap((label) => [label.length, ...label]), 0]);
	return octets.length <= 255 ? octets : null;
}

/**
 * The query message for one question: ID 0, as RFC 8484 recommends for cacheable GETs; RD
 * and AD set so the resolver recurses and reports validation; CD and the OPT record's DO bit
 * set from the flags; `null` when the name does not fit a question.
 *
 * @param query - The question and flags.
 */
export function encodeQuery(query: Query): Uint8Array | null {
	let name = encodeName(query.name);
	let type = typeCode(query.type);
	if (!name || type === null) return null;
	let flags = 0x0100 | 0x0020 | (query.checkingDisabled ? 0x0010 : 0);
	let header = [0, 0, flags >> 8, flags & 0xff, 0, 1, 0, 0, 0, 0, 0, 1];
	let question = [type >> 8, type & 0xff, 0, 1];
	let dnssec = query.dnssec ? 0x80 : 0;
	let opt = [0, OPT >> 8, OPT, PAYLOAD_SIZE >> 8, PAYLOAD_SIZE & 0xff, 0, 0, dnssec, 0, 0, 0];
	return Uint8Array.from([...header, ...name, ...question, ...opt]);
}

/** Octets as unpadded base64url, the encoding of RFC 8484's `dns` query parameter. */
function base64Url(octets: Uint8Array): string {
	let base64 = btoa(Array.from(octets, (octet) => String.fromCharCode(octet)).join(""));
	return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Prints a name's labels through `@sdxc/zone-file`'s codec, as the target of RFC 3597
 * generic CNAME data, so owner names read here match the names inside record data exactly.
 */
function printName(labels: Uint8Array[]): string | null {
	let wire = [...labels.flatMap((label) => [label.length, ...label]), 0];
	let parsed = parseRecordData("CNAME", generic(Uint8Array.from(wire)));
	return isSuccess(parsed) ? parsed.data.target : null;
}

/** Octets as RFC 3597 generic data, which `parseRecordData` reads for any type. */
function generic(octets: Uint8Array): string {
	let hex = Array.from(octets, (octet) => octet.toString(16).padStart(2, "0")).join("");
	return hex.length === 0 ? "\\# 0" : `\\# ${octets.length} ${hex}`;
}

/**
 * Reads a DNS message front to back. Names follow compression pointers anywhere in the
 * message. A read past the end, a pointer loop or an unknown label type sets `failed` and
 * reads as zeros, so a caller checks once after reading instead of after every field.
 */
class MessageReader {
	#octets: Uint8Array;
	offset = 0;
	failed = false;

	/** @param octets - The whole message. */
	constructor(octets: Uint8Array) {
		this.#octets = octets;
	}

	/** The next `length` octets, zeros once the message is exhausted. */
	bytes(length: number): Uint8Array {
		if (this.failed || this.offset + length > this.#octets.length) {
			this.failed = true;
			return new Uint8Array(length);
		}
		let bytes = this.#octets.subarray(this.offset, this.offset + length);
		this.offset += length;
		return bytes;
	}

	/** A big-endian unsigned integer of `size` octets. */
	uint(size: number): number {
		return this.bytes(size).reduce((total, byte) => total * 256 + byte, 0);
	}

	/** A name's labels, following compression pointers, leaving the offset after the name as written. */
	labels(): Uint8Array[] {
		let labels: Uint8Array[] = [];
		let resume: number | null = null;
		let pointers = 0;
		while (!this.failed) {
			let length = this.uint(1);
			if (length === 0) break;
			if ((length & 0xc0) === 0xc0) {
				let target = ((length & 0x3f) << 8) | this.uint(1);
				pointers += 1;
				if (pointers > MAX_POINTERS) this.failed = true;
				resume ??= this.offset;
				this.offset = target;
			} else if (length > 63) {
				this.failed = true;
			} else {
				labels.push(this.bytes(length));
			}
		}
		if (resume !== null) this.offset = resume;
		return labels;
	}
}

/** A name's labels as uncompressed wire octets. */
function wireName(labels: Uint8Array[]): number[] {
	return [...labels.flatMap((label) => [label.length, ...label]), 0];
}

/**
 * A record's RDATA with any compressed names expanded, read in place from the message so
 * pointers resolve against it; a layout that overruns the RDATA length fails the reader.
 */
function expandRdata(reader: MessageReader, type: number, length: number): Uint8Array {
	let layout = COMPRESSIBLE_NAMES[type];
	if (!layout) return reader.bytes(length);
	let end = reader.offset + length;
	let octets: number[] = [];
	for (let field of layout)
		octets.push(...(field === "name" ? wireName(reader.labels()) : reader.bytes(field)));
	if (reader.offset !== end) reader.failed = true;
	return Uint8Array.from(octets);
}

/** The RFC 8914 extended errors among an OPT record's options, trailing NULs trimmed from the text. */
function readExtendedErrors(options: Uint8Array): DoH.ExtendedError[] {
	let reader = new MessageReader(options);
	let errors: DoH.ExtendedError[] = [];
	while (reader.offset < options.length && !reader.failed) {
		let code = reader.uint(2);
		let data = reader.bytes(reader.uint(2));
		if (code !== EXTENDED_ERROR_OPTION || data.length < 2 || reader.failed) continue;
		let text = DECODER.decode(data.subarray(2)).replace(/\0+$/, "");
		errors.push({ code: ((data[0] ?? 0) << 8) | (data[1] ?? 0), text: text || null });
	}
	return errors;
}

/**
 * Reads a response message: the header flags, the answer and authority records with their
 * data as RFC 3597 generic data, and the OPT record's extended RCODE bits and extended
 * errors; `null` when the octets are not a well-formed response.
 *
 * @param octets - The response body.
 */
export function decodeResponse(octets: Uint8Array): Message | null {
	let reader = new MessageReader(octets);
	reader.bytes(2);
	let flags = reader.uint(2);
	let questions = reader.uint(2);
	let answers = reader.uint(2);
	let authorities = reader.uint(2);
	let additionals = reader.uint(2);
	if ((flags & 0x8000) === 0) return null;

	for (let index = 0; index < questions && !reader.failed; index++) {
		reader.labels();
		reader.bytes(4);
	}

	let answer: MessageRecord[] = [];
	let authority: MessageRecord[] = [];
	let extendedRcode = 0;
	let extendedErrors: DoH.ExtendedError[] = [];

	for (let index = 0; index < answers + authorities + additionals && !reader.failed; index++) {
		let labels = reader.labels();
		let type = reader.uint(2);
		reader.bytes(2);
		let ttl = reader.uint(4);
		let length = reader.uint(2);

		if (type === OPT) {
			extendedRcode = ttl >>> 24;
			extendedErrors = readExtendedErrors(reader.bytes(length));
			continue;
		}

		let data = generic(expandRdata(reader, type, length));
		let name = printName(labels);
		if (name === null) reader.failed = true;
		else if (index < answers) answer.push({ name, type, ttl, data });
		else if (index < answers + authorities) authority.push({ name, type, ttl, data });
	}

	if (reader.failed) return null;
	return {
		rcode: (extendedRcode << 4) | (flags & 0x000f),
		authenticated: (flags & 0x0020) !== 0,
		truncated: (flags & 0x0200) !== 0,
		answer,
		authority,
		extendedErrors,
	};
}

/**
 * Asks a wire-format resolver one question with an RFC 8484 GET, which shared caches can
 * store under the `dns` parameter.
 *
 * @param resolver - The endpoint, which takes the query in its `dns` parameter.
 * @param query - The question and flags.
 * @param deadline - Aborts the request.
 */
export async function queryWire(
	resolver: DoH.Resolver,
	query: Query,
	deadline: Deadline,
): Promise<Result<Message, TransportError>> {
	let message = encodeQuery(query);
	if (!message) {
		return failure(new TransportError(`${query.name} cannot be sent as a DNS question`, null));
	}

	let url = new URL(resolver.url);
	url.searchParams.set("dns", base64Url(message));

	let response = await exchange(url, MEDIA_TYPE, deadline, async (body) => {
		return new Uint8Array(await body.arrayBuffer());
	});
	if (isFailure(response)) return response;

	let decoded = decodeResponse(response.data.body);
	if (!decoded) {
		return failure(
			new TransportError("The resolver's response is not a DNS message", response.data.status),
		);
	}
	return success(decoded);
}

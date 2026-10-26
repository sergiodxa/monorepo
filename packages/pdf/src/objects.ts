/**
 * The PDF object model and the file writer: values serialize to PDF syntax, an `ObjectTable`
 * numbers indirect objects in allocation order, and `writeFile` lays them out with a classic
 * cross-reference table, so the same objects always produce the same bytes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A reference to an indirect object, written `n 0 R`. */
export class Ref {
	/**
	 * @param id - The object number, starting at 1.
	 */
	constructor(readonly id: number) {}
}

/** A PDF name, written `/Value` with every byte outside the regular set escaped as `#xx`. */
export class Name {
	/**
	 * @param value - The name without its leading slash.
	 */
	constructor(readonly value: string) {}
}

/**
 * A text string: ASCII text is written as a literal `( … )`, anything else as UTF-16BE hex
 * with a byte-order mark, which every viewer reads as Unicode.
 */
export class Text {
	/**
	 * @param value - The text as JavaScript holds it.
	 */
	constructor(readonly value: string) {}
}

/** A byte string written as `< … >` hex, for binary values such as an image palette. */
export class Hex {
	/**
	 * @param bytes - The string's bytes.
	 */
	constructor(readonly bytes: Uint8Array) {}
}

/** A value written verbatim, for operands this model has no type for (a date is a `Text`). */
export class Raw {
	/**
	 * @param value - PDF syntax, written as is.
	 */
	constructor(readonly value: string) {}
}

/** Any direct value. A plain object is a dictionary whose keys are names. */
export type Value =
	| number
	| boolean
	| null
	| Ref
	| Name
	| Text
	| Hex
	| Raw
	| Value[]
	| { [key: string]: Value | undefined };

/** A dictionary; keys whose value is `undefined` are left out of the output. */
export type Dict = { [key: string]: Value | undefined };

/** A stream object: its dictionary, without `Length`, which the writer fills, and its bytes. */
export interface Stream {
	dict: Dict;
	data: Uint8Array;
}

/**
 * Indirect objects in the order they were allocated. A caller allocates a `Ref` first, so
 * objects can point at each other before either is written, then sets each one exactly once.
 */
export class ObjectTable {
	#objects: (Value | Stream | undefined)[] = [];

	/** Reserves the next object number. */
	allocate(): Ref {
		this.#objects.push(undefined);
		return new Ref(this.#objects.length);
	}

	/**
	 * Stores the object a reference stands for.
	 *
	 * @param ref - A reference this table allocated.
	 * @param object - A direct value or a stream.
	 */
	set(ref: Ref, object: Value | Stream): void {
		this.#objects[ref.id - 1] = object;
	}

	/**
	 * Allocates a reference and stores the object in one step.
	 *
	 * @param object - A direct value or a stream.
	 */
	add(object: Value | Stream): Ref {
		let ref = this.allocate();
		this.set(ref, object);
		return ref;
	}

	/** Every object by number; an allocated object never set is written as `null`. */
	entries(): (Value | Stream)[] {
		return this.#objects.map((object) => object ?? null);
	}
}

/** Bytes PDF names write as-is; everything else becomes `#xx`. */
const NAME_REGULAR = /^[!-~]$/;

/** The delimiter bytes a name has to escape even though they are printable. */
const NAME_DELIMITERS = new Set(["#", "/", "%", "(", ")", "<", ">", "[", "]", "{", "}"]);

/** Header comment with four bytes above 127, so transfer tools treat the file as binary. */
const HEADER = "%PDF-1.7\n%âãÏÓ\n";

/**
 * A number in PDF syntax: at most four decimals, no exponent and no negative zero, so output
 * stays readable and identical across runtimes.
 *
 * @param value - Any finite number; anything else is written as `0`.
 * @example num(1 / 3) // "0.3333"
 */
export function num(value: number): string {
	if (!Number.isFinite(value)) return "0";
	let rounded = Math.round(value * 10000) / 10000;
	if (Object.is(rounded, -0) || rounded === 0) return "0";
	if (Number.isInteger(rounded)) return String(rounded);
	return rounded.toFixed(4).replace(/0+$/, "");
}

/**
 * Serializes a direct value to PDF syntax.
 *
 * @param value - The value; dictionaries keep their key order.
 */
export function serialize(value: Value): string {
	if (value === null) return "null";
	if (typeof value === "number") return num(value);
	if (typeof value === "boolean") return value ? "true" : "false";
	if (value instanceof Ref) return `${value.id} 0 R`;
	if (value instanceof Name) return name(value.value);
	if (value instanceof Text) return text(value.value);
	if (value instanceof Hex) return `<${hex(value.bytes)}>`;
	if (value instanceof Raw) return value.value;
	if (Array.isArray(value)) return `[${value.map(serialize).join(" ")}]`;
	let parts: string[] = [];
	for (let [key, entry] of Object.entries(value)) {
		if (entry === undefined) continue;
		parts.push(`${name(key)} ${serialize(entry)}`);
	}
	return `<<${parts.map((part) => ` ${part}`).join("")} >>`;
}

/**
 * A name token, escaping delimiters, whitespace and non-ASCII as UTF-8 `#xx` sequences.
 *
 * @param value - The name without its slash.
 */
export function name(value: string): string {
	let out = "/";
	for (let byte of new TextEncoder().encode(value)) {
		let character = String.fromCharCode(byte);
		if (NAME_REGULAR.test(character) && !NAME_DELIMITERS.has(character)) out += character;
		else out += `#${byte.toString(16).padStart(2, "0").toUpperCase()}`;
	}
	return out;
}

/**
 * A text string token: a literal string when every character is printable ASCII, UTF-16BE hex
 * with a byte-order mark otherwise.
 *
 * @param value - The text.
 */
export function text(value: string): string {
	if (/^[\x20-\x7e]*$/.test(value)) return `(${value.replace(/[\\()]/g, (c) => `\\${c}`)})`;
	let units = "FEFF";
	for (let index = 0; index < value.length; index++) {
		units += value.charCodeAt(index).toString(16).padStart(4, "0").toUpperCase();
	}
	return `<${units}>`;
}

/**
 * Upper-case hex of every byte, two digits each.
 *
 * @param bytes - The bytes.
 */
export function hex(bytes: Uint8Array): string {
	let out = "";
	for (let byte of bytes) out += byte.toString(16).padStart(2, "0").toUpperCase();
	return out;
}

/**
 * Writes a complete PDF file: header, every object of the table by number, the
 * cross-reference table with each object's byte offset, and the trailer.
 *
 * @param table - The document's objects.
 * @param root - The catalog.
 * @param info - The document information dictionary, when the document has metadata.
 * @returns The file's bytes.
 */
export function writeFile(table: ObjectTable, root: Ref, info: Ref | null): Uint8Array {
	let encoder = new TextEncoder();
	let chunks: Uint8Array[] = [];
	let offset = 0;
	let push = (chunk: Uint8Array) => {
		chunks.push(chunk);
		offset += chunk.length;
	};
	push(latin1(HEADER));
	let offsets: number[] = [];
	for (let [index, object] of table.entries().entries()) {
		offsets.push(offset);
		let id = index + 1;
		if (isStream(object)) {
			let dict = { ...object.dict, Length: object.data.length };
			push(encoder.encode(`${id} 0 obj\n${serialize(dict)}\nstream\n`));
			push(object.data);
			push(encoder.encode("\nendstream\nendobj\n"));
		} else {
			push(encoder.encode(`${id} 0 obj\n${serialize(object)}\nendobj\n`));
		}
	}
	let xref = offset;
	let lines = [`xref\n0 ${offsets.length + 1}\n`, "0000000000 65535 f \n"];
	for (let entry of offsets) lines.push(`${String(entry).padStart(10, "0")} 00000 n \n`);
	let trailer: Dict = { Size: offsets.length + 1, Root: root, Info: info ?? undefined };
	lines.push(`trailer\n${serialize(trailer)}\nstartxref\n${xref}\n%%EOF\n`);
	push(encoder.encode(lines.join("")));
	return concat(chunks);
}

/**
 * Encodes a string whose characters are all below 256 one byte per character.
 *
 * @param value - Latin-1 text.
 */
export function latin1(value: string): Uint8Array {
	let bytes = new Uint8Array(value.length);
	for (let index = 0; index < value.length; index++) bytes[index] = value.charCodeAt(index);
	return bytes;
}

/**
 * Joins byte arrays in order.
 *
 * @param chunks - The parts.
 */
export function concat(chunks: Uint8Array[]): Uint8Array {
	let length = 0;
	for (let chunk of chunks) length += chunk.length;
	let out = new Uint8Array(length);
	let offset = 0;
	for (let chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.length;
	}
	return out;
}

/**
 * Tells a stream object apart from a direct value.
 *
 * @param object - A table entry.
 */
function isStream(object: Value | Stream): object is Stream {
	return (
		typeof object === "object" &&
		object !== null &&
		!Array.isArray(object) &&
		"data" in object &&
		object.data instanceof Uint8Array
	);
}

/**
 * Compresses bytes to the zlib format a `FlateDecode` filter reads, through the platform's
 * `CompressionStream`.
 *
 * @param bytes - The uncompressed stream data.
 */
export async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
	let stream = new CompressionStream("deflate");
	let writer = stream.writable.getWriter();
	writer.write(bytes as Uint8Array<ArrayBuffer>).catch(() => undefined);
	writer.close().catch(() => undefined);
	return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

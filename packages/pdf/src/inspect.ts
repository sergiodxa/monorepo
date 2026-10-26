/**
 * Reads back the files this package writes, for its tests: it checks the cross-reference
 * table against the bytes, and answers each object's dictionary text and inflated stream.
 * It understands only the layout `writeFile` produces, not PDF files in general.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One indirect object of a written file. */
export interface InspectedObject {
	id: number;
	/** The object's text up to `stream` or `endobj`, decoded as Latin-1. */
	head: string;
	/** The raw stream bytes, `null` for an object with no stream. */
	stream: Uint8Array | null;
}

/** A written file taken apart. */
export interface InspectedFile {
	text: string;
	objects: Map<number, InspectedObject>;
	/** The trailer dictionary's text. */
	trailer: string;
	/** Whether every cross-reference offset points at its own `n 0 obj` line. */
	xrefValid: boolean;
}

/**
 * Splits a written file into its objects and checks its cross-reference table.
 *
 * @param bytes - A file from `pdf.bytes()`.
 */
export function inspect(bytes: Uint8Array): InspectedFile {
	let text = latin1(bytes);
	let objects = new Map<number, InspectedObject>();
	let pattern = /(\d+) 0 obj\n/g;
	for (let match of text.matchAll(pattern)) {
		let id = Number(match[1]);
		let start = (match.index ?? 0) + match[0].length;
		let end = text.indexOf("\nendobj\n", start);
		let body = text.slice(start, end);
		let streamAt = body.indexOf("\nstream\n");
		if (streamAt === -1) {
			objects.set(id, { id, head: body, stream: null });
			continue;
		}
		let length = Number(/\/Length (\d+)/.exec(body.slice(0, streamAt))?.[1] ?? 0);
		let dataStart = start + streamAt + "\nstream\n".length;
		objects.set(id, {
			id,
			head: body.slice(0, streamAt),
			stream: bytes.slice(dataStart, dataStart + length),
		});
	}
	let startxref = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(text)?.[1] ?? -1);
	let xref = text.slice(startxref);
	let offsets = [...xref.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
	let xrefValid =
		xref.startsWith("xref\n") &&
		offsets.length === objects.size &&
		offsets.every((offset, index) => text.startsWith(`${index + 1} 0 obj\n`, offset));
	let trailer = /trailer\n([\s\S]*?)\nstartxref/.exec(text)?.[1] ?? "";
	return { text, objects, trailer, xrefValid };
}

/**
 * Inflates a `FlateDecode` stream.
 *
 * @param bytes - The zlib data.
 */
export async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
	let stream = new DecompressionStream("deflate");
	let writer = stream.writable.getWriter();
	writer.write(bytes as Uint8Array<ArrayBuffer>).catch(() => undefined);
	writer.close().catch(() => undefined);
	return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

/**
 * The inflated content of every page, in page order, as text.
 *
 * @param file - An inspected file.
 */
export async function pageContents(file: InspectedFile): Promise<string[]> {
	let contents: string[] = [];
	for (let object of file.objects.values()) {
		if (!/\/Type \/Page\b/.test(object.head)) continue;
		let ref = /\/Contents (\d+) 0 R/.exec(object.head)?.[1];
		let stream = file.objects.get(Number(ref))?.stream;
		if (stream) contents.push(latin1(await inflate(stream)));
	}
	return contents;
}

/**
 * Decodes bytes one character per byte, which keeps binary stream data intact in a string.
 *
 * @param bytes - Any bytes.
 */
export function latin1(bytes: Uint8Array): string {
	let out = "";
	for (let index = 0; index < bytes.length; index += 0x8000) {
		out += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
	}
	return out;
}

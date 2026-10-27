/**
 * Reads back the PDFs `@sdxc/pdf` writes, for tests: page count, metadata, link targets and
 * the drawn text decoded through each font's `ToUnicode` map, so a test asserts on what a
 * reader copies out of the file rather than on its bytes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** What a test can assert about a written PDF. */
export interface ReadPdf {
	pages: number;
	title: string;
	author: string;
	lang: string;
	/** Every link annotation's URI, in drawing order. */
	links: string[];
	/** The drawn text, one line per baseline, fragments on one baseline joined as drawn. */
	text: string;
}

/** One indirect object: its dictionary text and, when it has one, its inflated stream. */
interface PdfObject {
	head: string;
	stream: string | null;
}

/**
 * Takes a PDF apart into the fields a test checks. Understands only the uncompressed object
 * layout `@sdxc/pdf` writes, with every stream `FlateDecode`d.
 *
 * @param bytes The file.
 * @returns Its pages, metadata, links and text.
 */
export async function readPdf(bytes: Uint8Array): Promise<ReadPdf> {
	let objects = await parseObjects(bytes);
	let all = [...objects.values()];
	let catalog = all.find((object) => object.head.includes("/Type /Catalog"))?.head ?? "";
	let info = all.find((object) => object.head.includes("/Producer"))?.head ?? "";
	let pages = all.filter((object) => /\/Type \/Page\b/.test(object.head));
	let text: string[] = [];
	for (let page of pages) text.push(pageText(page.head, objects));
	return {
		pages: pages.length,
		title: textString(/\/Title (<[0-9A-F]+>|\([^)]*\))/.exec(info)?.[1] ?? ""),
		author: textString(/\/Author (<[0-9A-F]+>|\([^)]*\))/.exec(info)?.[1] ?? ""),
		lang: /\/Lang \(([^)]*)\)/.exec(catalog)?.[1] ?? "",
		links: all.flatMap((object) => /\/URI \(([^)]*)\)/.exec(object.head)?.[1] ?? []),
		text: text.join("\n"),
	};
}

/** Every object by id, each stream sliced by its `/Length` and inflated. */
async function parseObjects(bytes: Uint8Array): Promise<Map<number, PdfObject>> {
	let source = latin1(bytes);
	let objects = new Map<number, PdfObject>();
	for (let match of source.matchAll(/(\d+) 0 obj\n(<<[\s\S]*?>>)\n(stream\n|endobj)/g)) {
		let head = match[2] ?? "";
		let stream: string | null = null;
		if (match[3] === "stream\n") {
			let start = (match.index ?? 0) + match[0].length;
			let length = Number(/\/Length (\d+)/.exec(head)?.[1] ?? 0);
			stream = latin1(await inflate(bytes.subarray(start, start + length)));
		}
		objects.set(Number(match[1]), { head, stream });
	}
	return objects;
}

/** A page's text: each `TJ` decoded through the `ToUnicode` map of the font it is set in. */
function pageText(head: string, objects: Map<number, PdfObject>): string {
	let maps = new Map<string, Map<string, string>>();
	for (let [, name, ref] of head.matchAll(/\/(F\d+) (\d+) 0 R/g)) {
		let toUnicode = /\/ToUnicode (\d+) 0 R/.exec(objects.get(Number(ref))?.head ?? "")?.[1];
		maps.set(name ?? "", cmap(objects.get(Number(toUnicode))?.stream ?? ""));
	}
	let content = objects.get(Number(/\/Contents (\d+) 0 R/.exec(head)?.[1]))?.stream ?? "";
	let lines: string[] = [];
	let lastY: string | null = null;
	for (let [, font, y, operand] of content.matchAll(
		/\/(F\d+) [\d.]+ Tf\n[\d.-]+ ([\d.-]+) Td\n\[(.*)\] TJ/g,
	)) {
		let map = maps.get(font ?? "") ?? new Map<string, string>();
		let fragment = [...(operand ?? "").matchAll(/<([0-9A-F]+)>/g)]
			.flatMap(([, hex]) => hex?.match(/.{4}/g) ?? [])
			.map((cid) => map.get(cid) ?? "�")
			.join("");
		if (y === lastY) lines[lines.length - 1] += fragment;
		else lines.push(fragment);
		lastY = y ?? null;
	}
	return lines.join("\n");
}

/** A `ToUnicode` CMap's `bfchar` entries, character id to text. */
function cmap(source: string): Map<string, string> {
	let map = new Map<string, string>();
	for (let [, cid, hex] of source.matchAll(/<([0-9A-F]{4})> <([0-9A-F]+)>/g)) {
		map.set(cid ?? "", utf16(hex ?? ""));
	}
	return map;
}

/** A PDF text string, either a UTF-16BE hex string with its byte-order mark or a literal. */
function textString(value: string): string {
	if (value.startsWith("(")) return value.slice(1, -1);
	return utf16(value.slice(1, -1).replace(/^FEFF/, ""));
}

/** UTF-16BE hex as a string. */
function utf16(hex: string): string {
	let units = (hex.match(/.{4}/g) ?? []).map((unit) => Number.parseInt(unit, 16));
	return String.fromCharCode(...units);
}

/** Inflates a zlib stream. */
async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
	let stream = new Blob([bytes as Uint8Array<ArrayBuffer>])
		.stream()
		.pipeThrough(new DecompressionStream("deflate"));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Bytes as one character each, which keeps binary data intact in a string. */
function latin1(bytes: Uint8Array): string {
	let out = "";
	for (let index = 0; index < bytes.length; index += 0x8000) {
		out += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
	}
	return out;
}

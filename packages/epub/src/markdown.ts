/**
 * `fromMarkdown` turns a Markdown file, or a folder of `index.md` and `ch<N>.md` files, into
 * the input `EPUB.build` takes. It does no I/O of its own: every file comes through the
 * caller's `read`, so the same book builds from a disk, a bucket or memory.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { Markdown } from "@sdxc/markdown";
import { toHTML } from "@sdxc/markdown/html";
import { toPlainText } from "@sdxc/markdown/plain";
import { headings, tableOfContents } from "@sdxc/markdown/plugin/headings";
import { failure, success } from "@sdxc/result";
import * as s from "remix/data-schema";

import type { EPUB } from "./epub.js";
import type { EpubError } from "./errors.js";
import type { FontFace } from "./markdown-fonts.js";
import type { BookStructure, SourceChapter, SourceDocument } from "./markdown-structure.js";

import {
	EpubContentError,
	EpubMetadataError,
	EpubMissingResourceError,
	EpubPathError,
	EpubRemoteResourceError,
} from "./errors.js";
import {
	ContainerPaths,
	cssReferences,
	folderOf,
	isFileReference,
	isWebReference,
	mapLimit,
	remotePath,
	resolveSource,
	rewriteCss,
	splitFragment,
} from "./markdown-assets.js";
import { embedFonts, FONT_STYLESHEET, fontFaceRules } from "./markdown-fonts.js";
import { idsIn, OPENING_ID, splitBook, TITLE_PAGE_ID, visit } from "./markdown-structure.js";
import { DEFAULT_STYLESHEET, defaultStylesheet } from "./markdown-style.js";
import { relativePath } from "./paths.js";

/** The types {@link fromMarkdown} takes and answers. */
export namespace MarkdownBook {
	/**
	 * A single Markdown file, or the paths of every file in a book's folder. Paths are relative
	 * to the book's folder and `/`-separated; `text` passes the file's content without a read.
	 */
	export type Source = { file: string; text?: string } | { files: readonly string[] };

	/** A file as `read` answers it; `type` names the media type of a download. */
	export interface File {
		bytes: Uint8Array;
		type?: string;
	}

	/** Metadata that wins over the frontmatter and the `#` title. */
	export interface Metadata {
		title?: string;
		/** @default "en" */
		language?: string;
		/** @default A `urn:uuid:` derived from the title and authors, stable across builds */
		identifier?: string;
		authors?: string[];
		publisher?: string;
		description?: string;
		rights?: string;
		subjects?: string[];
		published?: Date;
		/** @default The time of the call */
		modified?: Date;
	}

	/** The cover image, as a path relative to the book's folder or a URL. */
	export interface Cover {
		path: string;
		/** @default "Cover of <title>" */
		alt?: string;
	}

	/** A stylesheet whose `url()`s resolve from `path`, relative to the book's folder. */
	export interface Style {
		path: string;
		text: string;
	}

	/** A font file to embed, named by where it came from. */
	export interface Font {
		path: string;
		bytes: Uint8Array;
	}

	/** What a build is made from. */
	export interface Options {
		source: Source;
		/**
		 * Answers a file by its path relative to the book's folder (a leading `../` climbs out of
		 * it) or, for a download, by its URL; `null` when there is no such file.
		 */
		read(path: string, init: { signal: AbortSignal }): Promise<File | null>;
		/**
		 * Reads images and fonts referenced by `http(s)` URLs through `read` and stores them in
		 * the book; without it, a web reference fails.
		 *
		 * @default false
		 */
		remote?: boolean;
		metadata?: Metadata;
		cover?: Cover;
		/** Stylesheets linked after the reading stylesheet and a folder's `styles.css`, in order. */
		styles?: Style[];
		/**
		 * Links the reading stylesheet: a centered title page and readable defaults.
		 *
		 * @default true
		 */
		defaultStyle?: boolean;
		/** Fonts declared with `@font-face`; the first one's family becomes the body face. */
		fonts?: Font[];
		/**
		 * How many heading levels the table of contents lists, chapters included.
		 *
		 * @default 3
		 */
		tocDepth?: number;
		signal?: AbortSignal;
		/** Told what is about to be read and when each read finishes, for a progress display. */
		onProgress?(event: Progress): void;
	}

	/**
	 * `sources` lists the Markdown files and stylesheets about to be read, `assets` every image
	 * and font they reference, and `read` reports each finished read.
	 */
	export type Progress =
		| { type: "sources"; paths: string[] }
		| { type: "assets"; local: string[]; remote: string[] }
		| { type: "read"; path: string; remote: boolean; bytes: number };

	/** A built book's input with what went into it, for a report. */
	export interface Book {
		input: EPUB.Input;
		fonts: {
			family: string;
			weight: number;
			style: "normal" | "italic";
			path: string;
			source: string;
		}[];
		downloads: { url: string; path: string; bytes: number }[];
		/** Markdown files in a book's folder that are neither `index.md` nor a `ch<N>.md` chapter. */
		ignored: string[];
	}
}

/** A chapter file's name: `ch`, its number, and an optional `-slug`. */
const CHAPTER_FILE = /^ch(\d+)(?:[-_][^/]*)?\.md$/iu;

/** How many local files and downloads are read at once. */
const LOCAL_READS = 8;

/** How many downloads run at once. */
const REMOTE_READS = 4;

/** The frontmatter keys a book reads; any other key is left alone. */
const FRONTMATTER = s.object({
	title: s.optional(s.string()),
	language: s.optional(s.string()),
	lang: s.optional(s.string()),
	identifier: s.optional(s.string()),
	author: s.optional(s.union([s.string(), s.array(s.string())])),
	authors: s.optional(s.array(s.string())),
	publisher: s.optional(s.string()),
	description: s.optional(s.string()),
	rights: s.optional(s.string()),
	date: s.optional(s.union([s.string(), s.instanceof_(Date)])),
	subjects: s.optional(s.array(s.string())),
	tags: s.optional(s.array(s.string())),
	cover: s.optional(s.string()),
	"cover-alt": s.optional(s.string()),
});

/** The frontmatter as the schema answers it. */
type Frontmatter = Partial<s.InferOutput<typeof FRONTMATTER>>;

/** A position for nodes the book makes up, such as the title of a book without a `#` heading. */
const NOWHERE: Markdown.Position = {
	start: { line: 1, column: 1, offset: 0 },
	end: { line: 1, column: 1, offset: 0 },
};

/** The files a source names, in the roles they play. */
interface SourcePlan {
	/** The file that holds the frontmatter, the title and the opening page. */
	entry: string | undefined;
	/** Chapter files in numeric order. */
	chapters: string[];
	/** A folder's `styles.css`. */
	stylesheet: string | undefined;
	ignored: string[];
}

/** A file read for the book, by the source path or URL that names it. */
interface ReadAsset {
	path: string;
	bytes: Uint8Array;
}

/**
 * Builds the `EPUB.build` input for a Markdown book. A `#` heading is the title, shown alone on
 * a centered title page; each `##` heading opens a chapter; images, stylesheet `url()`s and the
 * cover are read through `read` and stored at paths that mirror the book's folder.
 *
 * @param options - The source, how to read it, and what to override
 * @returns The input with a report of fonts and downloads, or the first `EpubError` the book breaks
 * @example await fromMarkdown({ source: { file: "book.md" }, read: (path) => readFromDisk(path) })
 */
export async function fromMarkdown(
	options: MarkdownBook.Options,
): Promise<Result<MarkdownBook.Book, EpubError>> {
	let controller = new AbortController();
	let abort = () => controller.abort(options.signal?.reason);
	if (options.signal?.aborted) abort();
	options.signal?.addEventListener("abort", abort, { once: true });
	try {
		return await build(options, controller);
	} finally {
		options.signal?.removeEventListener("abort", abort);
	}
}

/** Runs the build in its four steps: sources, references, assets, then the input. */
async function build(
	options: MarkdownBook.Options,
	controller: AbortController,
): Promise<Result<MarkdownBook.Book, EpubError>> {
	let plan = sourcePlan(options.source);
	if (plan.status === "failure") return plan;

	let texts = await readSources(options, plan.data, controller);
	if (texts.status === "failure") return texts;

	let parsed = parseSources(plan.data, texts.data);
	if (parsed.status === "failure") return parsed;
	let structure = splitBook(parsed.data.documents);
	if (structure.status === "failure") return structure;

	let metadata = await bookMetadata(options, parsed.data.frontmatter, structure.data.title);
	if (metadata.status === "failure") return metadata;

	let styleSources: MarkdownBook.Style[] = [
		...(plan.data.stylesheet === undefined
			? []
			: [{ path: plan.data.stylesheet, text: texts.data.get(plan.data.stylesheet) ?? "" }]),
		...(options.styles ?? []),
	];
	let cover = coverSource(options, parsed.data.frontmatter, metadata.data.title);
	let references = collectReferences(structure.data, styleSources, cover?.path);
	let unread = webReferenceProblem(references, options.remote === true);
	if (unread) return failure(unread);

	let assets = await readAssets(options, references, controller);
	if (assets.status === "failure") return assets;

	return await assemble({
		options,
		plan: plan.data,
		structure: structure.data,
		metadata: metadata.data,
		styleSources,
		cover,
		assets: assets.data,
	});
}

/**
 * The roles of the files a source names. A folder needs an `index.md` or at least one chapter
 * file; chapters sort by their number as an integer, so `ch10.md` follows `ch9.md`.
 */
function sourcePlan(source: MarkdownBook.Source): Result<SourcePlan, EpubError> {
	if ("file" in source) {
		return success({ entry: source.file, chapters: [], stylesheet: undefined, ignored: [] });
	}

	let numbered = new Map<number, string>();
	let entry: string | undefined;
	let stylesheet: string | undefined;
	let ignored: string[] = [];
	for (let path of source.files) {
		if (path.includes("/")) continue;
		if (path === "index.md") entry = path;
		else if (path === "styles.css") stylesheet = path;
		else if (CHAPTER_FILE.test(path)) {
			let number = Number(CHAPTER_FILE.exec(path)?.[1]);
			let other = numbered.get(number);
			if (other !== undefined) {
				return failure(
					new EpubPathError(`"${other}" and "${path}" are both chapter ${number}`, path),
				);
			}
			numbered.set(number, path);
		} else if (path.toLowerCase().endsWith(".md")) ignored.push(path);
	}
	if (entry === undefined && numbered.size === 0) {
		return failure(
			new EpubContentError(
				'The folder holds neither an "index.md" nor a "ch1.md"-style chapter file',
			),
		);
	}
	let chapters = [...numbered.entries()].sort(([a], [b]) => a - b).map(([, path]) => path);
	return success({ entry, chapters, stylesheet, ignored: ignored.sort() });
}

/** Reads every Markdown file and the folder's stylesheet, as text. */
async function readSources(
	options: MarkdownBook.Options,
	plan: SourcePlan,
	controller: AbortController,
): Promise<Result<Map<string, string>, EpubError>> {
	let given = "file" in options.source ? options.source.text : undefined;
	let paths = [
		...(plan.entry === undefined || given !== undefined ? [] : [plan.entry]),
		...plan.chapters,
		...(plan.stylesheet === undefined ? [] : [plan.stylesheet]),
	];
	options.onProgress?.({ type: "sources", paths });

	let decoder = new TextDecoder("utf-8", { ignoreBOM: false });
	let read = await mapLimit(paths, LOCAL_READS, async (path) => {
		let file = await readOne(options, path, false, "the book", controller);
		return file.status === "failure" ? file : success(decoder.decode(file.data.bytes));
	});
	if (read.status === "failure") {
		controller.abort();
		return read;
	}
	let texts = new Map(paths.map((path, index) => [path, read.data[index] ?? ""]));
	if (plan.entry !== undefined && given !== undefined) texts.set(plan.entry, given);
	return success(texts);
}

/** Reads one file through the caller, turning a missing file or a thrown error into a failure. */
async function readOne(
	options: MarkdownBook.Options,
	path: string,
	remote: boolean,
	referrer: string,
	controller: AbortController,
): Promise<Result<MarkdownBook.File, EpubError>> {
	let file: MarkdownBook.File | null;
	try {
		file = await options.read(path, { signal: controller.signal });
	} catch (error) {
		let reason = error instanceof Error ? error.message : String(error);
		return failure(new EpubMissingResourceError(`Cannot read "${path}": ${reason}`, path));
	}
	if (file === null) {
		return failure(
			new EpubMissingResourceError(`"${path}", referenced by ${referrer}, does not exist`, path),
		);
	}
	options.onProgress?.({ type: "read", path, remote, bytes: file.bytes.byteLength });
	return success(file);
}

/**
 * Parses every Markdown file and gives every heading in the book an id unique across all of
 * them, so a `#fragment` link finds one heading whichever chapter it lands in. Footnote names
 * are made per file, since two chapter files may both write `[^1]`.
 */
function parseSources(
	plan: SourcePlan,
	texts: ReadonlyMap<string, string>,
): Result<{ documents: SourceDocument[]; frontmatter: Frontmatter }, EpubError> {
	let frontmatter: Frontmatter = {};
	let documents: SourceDocument[] = [];
	let files = [...(plan.entry === undefined ? [] : [plan.entry]), ...plan.chapters];

	for (let [index, path] of files.entries()) {
		let text = texts.get(path) ?? "";
		let entry = path === plan.entry;
		let parsed = entry ? Markdown.parse(text, { frontmatter: FRONTMATTER }) : Markdown.parse(text);
		if (parsed.status === "failure") {
			let error = entry
				? new EpubMetadataError(`"${path}" cannot be read: ${parsed.error.message}`, path)
				: new EpubContentError(`"${path}" cannot be read: ${parsed.error.message}`, path, {
						cause: parsed.error,
					});
			return failure(error);
		}
		if (entry) frontmatter = parsed.data.frontmatter as Frontmatter;
		let blocks =
			files.length === 1
				? parsed.data.document.children
				: scopeFootnotes(parsed.data.document, index);
		documents.push({ path, entry, blocks });
	}

	let combined: Markdown.Document = {
		type: "document",
		children: documents.flatMap((document) => document.blocks),
		position: NOWHERE,
	};
	let walked = Markdown.walk(combined, headings());
	if (walked.status === "failure") {
		return failure(new EpubContentError(walked.error.message, undefined, { cause: walked.error }));
	}
	let offset = 0;
	for (let document of documents) {
		document.blocks = walked.data.children.slice(offset, offset + document.blocks.length);
		offset += document.blocks.length;
	}
	return success({ documents, frontmatter });
}

/** A file's blocks with every footnote name prefixed by the file's position in the book. */
function scopeFootnotes(document: Markdown.Document, index: number): Markdown.Block[] {
	let walked = Markdown.walk(document, {
		footnoteReference: (node) => ({ ...node, identifier: `f${index}-${node.identifier}` }),
		footnoteDefinition: (node) => ({ ...node, identifier: `f${index}-${node.identifier}` }),
	});
	return walked.status === "success" ? walked.data.children : document.children;
}

/**
 * The publication metadata: the caller's values first, then the frontmatter, then the `#`
 * heading for the title. Without an identifier, one is derived from the title and authors so
 * every build of the same book is the same book in a reader's library.
 */
async function bookMetadata(
	options: MarkdownBook.Options,
	frontmatter: Frontmatter,
	heading: Markdown.Heading | undefined,
): Promise<Result<EPUB.Metadata, EpubError>> {
	let given = options.metadata ?? {};
	let title =
		given.title ?? frontmatter.title ?? (heading ? toPlainText(heading).trim() : undefined);
	if (title === undefined || title === "") {
		return failure(
			new EpubMetadataError(
				'The book has no title; write a "#" heading or a `title` in the frontmatter',
				"title",
			),
		);
	}
	let authors =
		given.authors ??
		frontmatter.authors ??
		(typeof frontmatter.author === "string" ? [frontmatter.author] : frontmatter.author) ??
		[];

	let published = given.published;
	if (published === undefined && frontmatter.date !== undefined) {
		published = frontmatter.date instanceof Date ? frontmatter.date : new Date(frontmatter.date);
		if (Number.isNaN(published.getTime())) {
			return failure(
				new EpubMetadataError(
					`The frontmatter date "${String(frontmatter.date)}" is not a date`,
					"date",
				),
			);
		}
	}

	return success({
		identifier:
			given.identifier ?? frontmatter.identifier ?? (await derivedIdentifier(title, authors)),
		title,
		language: given.language ?? frontmatter.language ?? frontmatter.lang ?? "en",
		modified: given.modified ?? new Date(),
		published,
		creators: authors.map((name) => ({ name, role: "aut" })),
		publisher: given.publisher ?? frontmatter.publisher,
		description: given.description ?? frontmatter.description,
		rights: given.rights ?? frontmatter.rights,
		subjects: given.subjects ?? frontmatter.subjects ?? frontmatter.tags,
	});
}

/**
 * A `urn:uuid:` taken from the SHA-256 of the title and authors, shaped as a version 8 UUID,
 * which RFC 9562 leaves to an application to fill.
 */
async function derivedIdentifier(title: string, authors: readonly string[]): Promise<string> {
	let text = [title, ...authors].join("\n");
	let digest = new Uint8Array(
		await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
	);
	let bytes = digest.slice(0, 16);
	bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x80;
	bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
	let hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
	return `urn:uuid:${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The cover the caller or the frontmatter names, resolved from the entry file's folder. */
function coverSource(
	options: MarkdownBook.Options,
	frontmatter: Frontmatter,
	title: string,
): { path: string; alt: string } | undefined {
	let alt = options.cover?.alt ?? frontmatter["cover-alt"] ?? `Cover of ${title}`;
	if (options.cover) return { path: options.cover.path, alt };
	if (frontmatter.cover === undefined) return undefined;
	if (isWebReference(frontmatter.cover)) return { path: frontmatter.cover.trim(), alt };
	let entry = "file" in options.source ? options.source.file : "index.md";
	let path = resolveSource(folderOf(entry), frontmatter.cover);
	return path === undefined ? undefined : { path, alt };
}

/** Every file the book references, with the first file that referenced it. */
interface References {
	local: Map<string, string>;
	remote: Map<string, string>;
}

/** Collects every image, stylesheet `url()` and the cover, local and remote apart. */
function collectReferences(
	structure: BookStructure,
	styles: readonly MarkdownBook.Style[],
	cover: string | undefined,
): References {
	let references: References = { local: new Map(), remote: new Map() };
	let add = (folder: string, value: string, referrer: string) => {
		if (!isFileReference(value)) return;
		if (isWebReference(value)) {
			if (!references.remote.has(value.trim())) references.remote.set(value.trim(), referrer);
			return;
		}
		let source = resolveSource(folder, value);
		if (source !== undefined && !references.local.has(source))
			references.local.set(source, referrer);
	};

	let parts = [
		...(structure.opening
			? [{ file: structure.opening.file, blocks: structure.opening.blocks }]
			: []),
		...structure.chapters,
	];
	for (let part of parts) {
		visit(part.blocks, (node) => {
			if (node.type === "image") add(folderOf(part.file), node.src, `"${part.file}"`);
		});
	}
	for (let style of styles) {
		for (let value of cssReferences(style.text))
			add(folderOf(style.path), value, `"${style.path}"`);
	}
	if (cover !== undefined) {
		if (isWebReference(cover)) references.remote.set(cover, "the cover");
		else references.local.set(cover, "the cover");
	}
	return references;
}

/** The failure for a web reference when downloads are off, naming the first one. */
function webReferenceProblem(references: References, remote: boolean): EpubError | undefined {
	if (remote) return undefined;
	let first = references.remote.entries().next().value;
	if (first === undefined) return undefined;
	let [url, referrer] = first;
	return new EpubRemoteResourceError(
		`${referrer} loads "${url}" from the web; download it into the book or allow remote files`,
		url,
	);
}

/** Reads every referenced file, local ones and downloads side by side, stopping on the first failure. */
async function readAssets(
	options: MarkdownBook.Options,
	references: References,
	controller: AbortController,
): Promise<Result<{ local: Map<string, ReadAsset>; remote: Map<string, ReadAsset> }, EpubError>> {
	let local = [...references.local.keys()];
	let remote = [...references.remote.keys()];
	options.onProgress?.({ type: "assets", local, remote });

	let stopOnFailure = <T>(result: Result<T, EpubError>): Result<T, EpubError> => {
		if (result.status === "failure") controller.abort();
		return result;
	};
	let [localRead, remoteRead] = await Promise.all([
		mapLimit(local, LOCAL_READS, async (path) =>
			stopOnFailure(
				await readOne(options, path, false, references.local.get(path) ?? "the book", controller),
			),
		),
		mapLimit(remote, REMOTE_READS, async (url): Promise<Result<ReadAsset, EpubError>> => {
			let file = await readOne(
				options,
				url,
				true,
				references.remote.get(url) ?? "the book",
				controller,
			);
			if (file.status === "failure") return stopOnFailure(file);
			let path = await remotePath(url, file.data.type);
			if (path.status === "failure") return stopOnFailure(path);
			return success({ path: path.data, bytes: file.data.bytes });
		}),
	]);
	if (localRead.status === "failure") return localRead;
	if (remoteRead.status === "failure") return remoteRead;

	return success({
		local: new Map(
			local.map((path, index) => [
				path,
				{ path, bytes: localRead.data[index]?.bytes ?? new Uint8Array() },
			]),
		),
		remote: new Map(
			remote.map((url, index) => [
				url,
				remoteRead.data[index] ?? { path: "", bytes: new Uint8Array() },
			]),
		),
	});
}

/** Everything the last step puts together. */
interface Assembly {
	options: MarkdownBook.Options;
	plan: SourcePlan;
	structure: BookStructure;
	metadata: EPUB.Metadata;
	styleSources: MarkdownBook.Style[];
	cover: { path: string; alt: string } | undefined;
	assets: { local: Map<string, ReadAsset>; remote: Map<string, ReadAsset> };
}

/** Places every file, renders every page and puts the `EPUB.build` input together. */
async function assemble(assembly: Assembly): Promise<Result<MarkdownBook.Book, EpubError>> {
	let { options, structure, metadata, assets } = assembly;
	let paths = new ContainerPaths();
	let placed = new Map<string, string>();
	for (let [source] of assets.local) placed.set(source, paths.claim(source));
	for (let [url, asset] of assets.remote) placed.set(url, paths.claim(asset.path));

	let pages = renderPages(structure, metadata, placed, options.tocDepth ?? 3);

	let faces = embedFonts(options.fonts ?? [], paths);
	if (faces.status === "failure") return faces;

	let styles = bookStyles(assembly, faces.data, paths, placed);

	let coverPath = assembly.cover ? placed.get(assembly.cover.path) : undefined;
	let resources: EPUB.Resource[] = [
		...[...assets.local.entries(), ...assets.remote.entries()]
			.map(([source, asset]) => ({ path: placed.get(source) ?? asset.path, bytes: asset.bytes }))
			.filter((resource) => resource.path !== coverPath),
		...faces.data.map((face) => ({ path: face.path, bytes: face.bytes })),
	];
	let cover =
		assembly.cover && coverPath !== undefined
			? {
					image: {
						path: coverPath,
						bytes:
							(assets.local.get(assembly.cover.path) ?? assets.remote.get(assembly.cover.path))
								?.bytes ?? new Uint8Array(),
					},
					alt: assembly.cover.alt,
				}
			: undefined;

	return success({
		input: { metadata, cover, styles, chapters: pages, resources },
		fonts: faces.data.map(({ family, weight, style, path, source }) => ({
			family,
			weight,
			style,
			path,
			source,
		})),
		downloads: [...assets.remote.entries()].map(([url, asset]) => ({
			url,
			path: placed.get(url) ?? asset.path,
			bytes: asset.bytes.byteLength,
		})),
		ignored: assembly.plan.ignored,
	});
}

/** The pages in reading order: the title page, the opening page, then each chapter. */
function renderPages(
	structure: BookStructure,
	metadata: EPUB.Metadata,
	placed: ReadonlyMap<string, string>,
	tocDepth: number,
): EPUB.Chapter[] {
	let chapters = structure.chapters;
	let opening = structure.opening;
	if (chapters.length === 0 && opening) {
		let heading: Markdown.Heading = {
			type: "heading",
			level: 2,
			attributes: {},
			children: [{ type: "text", value: metadata.title, position: NOWHERE }],
			position: NOWHERE,
		};
		chapters = [{ id: "chapter-1", file: opening.file, heading, blocks: opening.blocks }];
		opening = undefined;
	}

	let owners = new Map<string, string>();
	let firstOfFile = new Map<string, string>();
	if (structure.title) for (let id of idsIn([structure.title])) owners.set(id, TITLE_PAGE_ID);
	if (opening) for (let id of idsIn(opening.blocks)) owners.set(id, OPENING_ID);
	for (let chapter of chapters) {
		for (let id of idsIn(chapter.blocks)) if (!owners.has(id)) owners.set(id, chapter.id);
		if (!firstOfFile.has(chapter.file)) firstOfFile.set(chapter.file, chapter.id);
	}
	if (opening && !firstOfFile.has(opening.file)) firstOfFile.set(opening.file, OPENING_ID);
	let links = { owners, firstOfFile, placed };

	let pages: EPUB.Chapter[] = [
		{
			id: TITLE_PAGE_ID,
			title: metadata.title,
			body: titlePage(structure.title, metadata),
			toc: false,
		},
	];
	if (opening) {
		pages.push({
			id: OPENING_ID,
			title: metadata.title,
			body: renderBlocks(opening.blocks, OPENING_ID, opening.file, links),
			toc: false,
		});
	}
	let levels = Array.from({ length: Math.max(0, tocDepth - 1) }, (_, index) => index + 3).filter(
		(level) => level <= 6,
	) as Markdown.Heading["level"][];
	for (let chapter of chapters) {
		let body = renderBlocks(chapter.blocks, chapter.id, chapter.file, links);
		pages.push({
			id: chapter.id,
			title: toPlainText(chapter.heading).trim() || metadata.title,
			body,
			sections: sectionsOf(chapter, levels),
		});
	}
	return pages;
}

/** How links and images find their targets once every page and file has its place. */
interface Links {
	/** The page each element `id` is written on. */
	owners: ReadonlyMap<string, string>;
	/** The first page of each Markdown file, for a link to the file itself. */
	firstOfFile: ReadonlyMap<string, string>;
	/** The container path of each source path and URL. */
	placed: ReadonlyMap<string, string>;
}

/**
 * Renders a page's blocks as XHTML, pointing each image at its container path and each link to
 * a heading or a Markdown file at the page that holds it.
 */
function renderBlocks(blocks: Markdown.Block[], page: string, file: string, links: Links): string {
	let pagePath = `text/${page}.xhtml`;
	let folder = folderOf(file);
	let document: Markdown.Document = { type: "document", children: blocks, position: NOWHERE };
	let walked = Markdown.walk(document, {
		image(node) {
			let key = isWebReference(node.src) ? node.src.trim() : resolveSource(folder, node.src);
			let target = key === undefined ? undefined : links.placed.get(key);
			return target === undefined ? undefined : { ...node, src: relativePath(pagePath, target) };
		},
		link(node) {
			let href = linkTarget(node.href, page, folder, links);
			return href === undefined ? undefined : { ...node, href };
		},
	});
	return toHTML(walked.status === "success" ? walked.data : document, { syntax: "xhtml" });
}

/** Where a link lands once the book is split into pages, or `undefined` to keep it as written. */
function linkTarget(href: string, page: string, folder: string, links: Links): string | undefined {
	if (isWebReference(href) || href.trim().startsWith("data:")) return undefined;
	let { target, fragment } = splitFragment(href.trim());
	let id = fragment === "" ? undefined : safeDecode(fragment.slice(1));

	if (target === "") {
		let owner = id === undefined ? undefined : links.owners.get(id);
		return owner === undefined || owner === page ? undefined : `${owner}.xhtml${fragment}`;
	}
	let source = resolveSource(folder, target);
	if (source === undefined || !source.toLowerCase().endsWith(".md")) return undefined;
	let owner =
		(id === undefined ? undefined : links.owners.get(id)) ?? links.firstOfFile.get(source);
	if (owner === undefined) return undefined;
	if (owner === page) return fragment === "" ? "#" : fragment;
	return `${owner}.xhtml${fragment}`;
}

/** A percent-decoded fragment, or the fragment as written when it holds a malformed escape. */
function safeDecode(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

/** The chapter's deeper headings as contents entries, down to the listed levels. */
function sectionsOf(
	chapter: SourceChapter,
	levels: Markdown.Heading["level"][],
): EPUB.Section[] | undefined {
	if (levels.length === 0) return undefined;
	let document: Markdown.Document = {
		type: "document",
		children: chapter.blocks,
		position: NOWHERE,
	};
	let toSection = (entry: ReturnType<typeof tableOfContents>[number]): EPUB.Section => ({
		title: entry.text.trim() || entry.id,
		fragment: entry.id,
		sections: entry.children.map(toSection),
	});
	let sections = tableOfContents(document, { levels }).map(toSection);
	return sections.length > 0 ? sections : undefined;
}

/** The title page: the `#` heading, or the title as text, and the authors below it. */
function titlePage(heading: Markdown.Heading | undefined, metadata: EPUB.Metadata): string {
	let title: Markdown.Heading = heading ?? {
		type: "heading",
		level: 1,
		attributes: {},
		children: [{ type: "text", value: metadata.title, position: NOWHERE }],
		position: NOWHERE,
	};
	let h1 = toHTML(title, { syntax: "xhtml" });
	let names = (metadata.creators ?? []).map((creator) => creator.name);
	let authors =
		names.length === 0 ? "" : `<p class="title-page-authors">${escapeText(names.join(", "))}</p>`;
	return `<section class="title-page">${h1}${authors}</section>`;
}

/** Text with the three characters XML gives meaning to escaped. */
function escapeText(text: string): string {
	return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/**
 * The stylesheets in the order they cascade: `@font-face` rules, the reading stylesheet, the
 * folder's `styles.css`, then the caller's. Every `url()` is rewritten to the container path of
 * the file it names, relative to where the stylesheet is written.
 */
function bookStyles(
	assembly: Assembly,
	faces: readonly FontFace[],
	paths: ContainerPaths,
	placed: ReadonlyMap<string, string>,
): EPUB.Style[] {
	let styles: EPUB.Style[] = [];
	if (faces.length > 0) styles.push({ path: FONT_STYLESHEET, text: fontFaceRules(faces) });
	if (assembly.options.defaultStyle !== false) {
		styles.push({ path: DEFAULT_STYLESHEET, text: defaultStylesheet(faces[0]?.family) });
	}
	for (let style of assembly.styleSources) {
		let path = paths.claim(style.path);
		let text = rewriteCss(style.text, (value) => {
			let key = isWebReference(value) ? value.trim() : resolveSource(folderOf(style.path), value);
			let target = key === undefined ? undefined : placed.get(key);
			return target === undefined
				? undefined
				: `${relativePath(path, target)}${splitFragment(value).fragment}`;
		});
		styles.push({ path, text });
	}
	return styles;
}

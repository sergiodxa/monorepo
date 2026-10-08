/**
 * `EPUB.build` turns metadata, XHTML chapters and resources into a complete EPUB 3.3
 * publication, refusing at build time what epubcheck reports as an error, so a successful
 * `Result` is a file reading systems open. The container is written through `@sdxc/zip`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type { XML } from "@sdxc/xml";
import type { ZipError } from "@sdxc/zip";

import { failure, success } from "@sdxc/result";
import { Zip } from "@sdxc/zip";

import type { ParsedBody, Reference } from "./content.js";
import type { Landmark, ManifestItem, SpineItem, TocEntry } from "./documents.js";
import type { EpubError } from "./errors.js";

import { hasForbiddenCharacter, parseBody } from "./content.js";
import {
	chapterDocument,
	containerDocument,
	coverDocument,
	element,
	navigationDocument,
	ncxDocument,
	packageDocument,
} from "./documents.js";
import {
	EpubContentError,
	EpubMediaTypeError,
	EpubMetadataError,
	EpubMissingResourceError,
	EpubPathError,
	EpubRemoteResourceError,
} from "./errors.js";
import { isNCName, isRemote, mediaTypeOf, pathProblem, resolveReference } from "./paths.js";

/** The public types of {@link EPUB}, under the class's name. */
export namespace EPUB {
	/** Everything a publication is built from. */
	export interface Input {
		metadata: Metadata;
		/** An image shown as the first page and named as the cover to every reading system. */
		cover?: Cover;
		/** Stylesheets every chapter links, in order. */
		styles?: Style[];
		/** The reading order; at least one chapter is linear and one is in the table of contents. */
		chapters: Chapter[];
		/** Images, fonts and other files the chapters and stylesheets reference. */
		resources?: Resource[];
		/**
		 * Writes `toc.ncx`, the EPUB 2 table of contents older reading systems read.
		 *
		 * @default true
		 */
		legacyNcx?: boolean;
		/** Text of the navigation headings and landmarks, for a book not written in English. */
		labels?: Labels;
	}

	/** The package metadata. */
	export interface Metadata {
		/**
		 * What a reading system recognises the book by, such as `urn:uuid:…` or `urn:isbn:…`.
		 * Keep it stable per book: a new one per download makes every download a new book.
		 */
		identifier: string;
		title: string;
		/** A BCP 47 tag such as `en` or `es-419`, also the default language of every chapter. */
		language: string;
		/** When the publication last changed, written as `dcterms:modified` to the second. */
		modified: Date;
		/** The original publication date, written as `dc:date`. */
		published?: Date;
		creators?: Creator[];
		publisher?: string;
		description?: string;
		rights?: string;
		subjects?: string[];
		/** EPUB Accessibility 1.1 metadata; none is written unless given. */
		accessibility?: Accessibility;
	}

	/** An author or other creator, in the order they are credited. */
	export interface Creator {
		name: string;
		/** A MARC relator code such as `aut`, `edt` or `ill`. */
		role?: string;
		/** The sortable form, such as `Doe, Jane`. */
		fileAs?: string;
	}

	/** The schema.org accessibility properties EPUB Accessibility 1.1 asks for. */
	export interface Accessibility {
		/** `schema:accessibilitySummary`, a sentence a person reads before buying. */
		summary?: string;
		/** `schema:accessMode` values, such as `textual` and `visual`. */
		modes?: string[];
		/** `schema:accessModeSufficient` sets, such as `textual` or `textual,visual`. */
		modesSufficient?: string[];
		/** `schema:accessibilityFeature` values, such as `structuralNavigation` and `tableOfContents`. */
		features?: string[];
		/** `schema:accessibilityHazard` values, such as `none`. */
		hazards?: string[];
		/** A conformance claim written as `dcterms:conformsTo`, e.g. `EPUB Accessibility 1.1 - WCAG 2.1 Level AA`. */
		conformsTo?: string;
	}

	/** The cover image and its text alternative. */
	export interface Cover {
		image: Resource;
		alt: string;
	}

	/** A stylesheet, written at `EPUB/<path>`. */
	export interface Style {
		path: string;
		text: string;
	}

	/** A file written at `EPUB/<path>`, its media type taken from the extension. */
	export interface Resource {
		path: string;
		bytes: Uint8Array;
	}

	/** One content document, written at `EPUB/text/<id>.xhtml`. */
	export interface Chapter {
		/** An XML name (letters, digits, `.`, `_`, `-`) naming both the file and the manifest item. */
		id: string;
		/** The table-of-contents entry and the document's `<title>`. */
		title: string;
		/**
		 * The XHTML inside `<body>`. References resolve from `text/`, so an image at
		 * `images/a.png` is `../images/a.png`.
		 */
		body: string;
		/** A BCP 47 tag, when the chapter's language differs from the publication's. */
		language?: string;
		/**
		 * `false` takes the chapter out of the default reading order, for supplementary content.
		 *
		 * @default true
		 */
		linear?: boolean;
		/**
		 * `false` leaves the chapter out of the table of contents, for a copyright page.
		 *
		 * @default true
		 */
		toc?: boolean;
		/** Entries nested below the chapter's own, each pointing at an `id` inside it. */
		sections?: Section[];
	}

	/** A table-of-contents entry inside a chapter. */
	export interface Section {
		title: string;
		/** The `id` of the element the entry opens at. */
		fragment: string;
		sections?: Section[];
	}

	/** Text the navigation document shows or announces. */
	export interface Labels {
		/** @default "Contents" */
		contents?: string;
		/** @default "Landmarks" */
		landmarks?: string;
		/** @default "Cover" */
		cover?: string;
		/** @default "Start of Content" */
		start?: string;
	}

	/** One file of the container, in the order it is written. */
	export interface File {
		/** The full path in the container, such as `EPUB/text/intro.xhtml`. */
		path: string;
		bytes: Uint8Array;
	}
}

/** BCP 47 in the shape reading systems match on: a primary subtag and optional subtags. */
const LANGUAGE_TAG = /^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/;

/** Where every file the caller names lives inside the container. */
const ROOT = "EPUB/";

/**
 * A complete EPUB 3.3 publication. `EPUB.build` is the only way to get one, so every instance
 * holds a publication that passed the package's verification.
 */
export class EPUB {
	/** Every file of the container, `mimetype` first, as the archive holds them. */
	readonly files: readonly EPUB.File[];
	#zip: Zip;

	private constructor(files: EPUB.File[], zip: Zip) {
		this.files = files;
		this.#zip = zip;
	}

	/**
	 * Build a publication. Each chapter body is parsed and re-serialized, which proves it
	 * well-formed and turns named entities into characters; references, fragments, media
	 * types and manifest properties are checked against the files given.
	 *
	 * @param input - Metadata, chapters, stylesheets, resources and an optional cover
	 * @returns The publication, or the `EpubError` subclass for the first rule the input breaks
	 * @example EPUB.build({ metadata, chapters: [{ id: "one", title: "One", body: "<p>Hi</p>" }] })
	 */
	static build(input: EPUB.Input): Result<EPUB, EpubError> {
		let metadata = checkMetadata(input.metadata);
		if (metadata) return failure(metadata);

		let chapters = checkChapters(input.chapters, input.metadata.language);
		if (chapters.status === "failure") return chapters;

		let assets = checkAssets(input);
		if (assets.status === "failure") return assets;

		let documents = new Map<string, Set<string>>([["nav.xhtml", new Set(["toc"])]]);
		if (input.cover) documents.set("cover.xhtml", new Set());
		for (let chapter of chapters.data) documents.set(chapter.path, chapter.parsed.ids);

		for (let chapter of chapters.data) {
			for (let reference of chapter.parsed.references) {
				let problem = checkReference(chapter, reference, assets.data, documents);
				if (problem) return failure(problem);
			}
			let sections = checkSections(chapter, chapter.input.sections ?? []);
			if (sections) return failure(sections);
		}
		let unreachable = unreachableChapter(chapters.data);
		if (unreachable) return failure(unreachable);
		for (let style of input.styles ?? []) {
			let problem = checkStylesheet(style, assets.data);
			if (problem) return failure(problem);
		}

		let files = writeFiles(input, chapters.data, assets.data);
		if (files.status === "failure") return files;

		let zip = new Zip();
		let modified = zipTimestamp(input.metadata.modified);
		for (let file of files.data) {
			let added = zip.add(file.path, file.bytes, modified ? { modified } : {});
			if (added.status === "failure") {
				return failure(new EpubPathError(added.error.message, file.path));
			}
		}
		return success(new EPUB(files.data, zip));
	}

	/**
	 * The publication as a stream of `application/epub+zip` bytes, `mimetype` first and every
	 * entry stored. Every file is in memory, so the stream never waits on a source.
	 */
	stream(): ReadableStream<Uint8Array> {
		return this.#zip.stream();
	}

	/**
	 * The publication in one buffer.
	 *
	 * @returns The `.epub` bytes, or the `ZipError` for an archive past 4 GiB
	 */
	async bytes(): Promise<Result<Uint8Array, ZipError>> {
		return await this.#zip.bytes();
	}
}

/** A chapter that passed its own checks, with the container path it is written at. */
interface CheckedChapter {
	input: EPUB.Chapter;
	/** Relative to `EPUB/`: `text/<id>.xhtml`. */
	path: string;
	language: string;
	parsed: ParsedBody;
}

/** A style or resource with its media type, relative to `EPUB/`. */
interface CheckedAsset {
	path: string;
	mediaType: string;
	bytes: Uint8Array;
	kind: "style" | "resource" | "cover";
}

/** The first problem with the publication metadata. */
function checkMetadata(metadata: EPUB.Metadata): EpubMetadataError | undefined {
	if (metadata.identifier.trim() === "")
		return new EpubMetadataError("identifier is empty", "identifier");
	if (metadata.title.trim() === "") return new EpubMetadataError("title is empty", "title");
	if (!LANGUAGE_TAG.test(metadata.language)) {
		return new EpubMetadataError(`"${metadata.language}" is not a BCP 47 language tag`, "language");
	}
	if (!isWritableDate(metadata.modified)) {
		return new EpubMetadataError("modified must be a valid date in years 0–9999", "modified");
	}
	if (metadata.published && !isWritableDate(metadata.published)) {
		return new EpubMetadataError("published must be a valid date in years 0–9999", "published");
	}
	for (let [index, creator] of (metadata.creators ?? []).entries()) {
		if (creator.name.trim() === "")
			return new EpubMetadataError("A creator's name is empty", `creators[${index}]`);
		if (creator.role !== undefined && !/^[a-z]{3}$/.test(creator.role)) {
			return new EpubMetadataError(
				`"${creator.role}" is not a MARC relator code such as "aut"`,
				`creators[${index}]`,
			);
		}
	}
	for (let [field, value] of metadataStrings(metadata)) {
		if (hasForbiddenCharacter(value)) {
			return new EpubMetadataError(`${field} contains a character XML forbids`, field);
		}
	}
	return undefined;
}

/** Every string the package document will carry, named by the field it came from. */
function metadataStrings(metadata: EPUB.Metadata): [string, string][] {
	let a11y = metadata.accessibility ?? {};
	let optional: [string, string | undefined][] = [
		["identifier", metadata.identifier],
		["title", metadata.title],
		["publisher", metadata.publisher],
		["description", metadata.description],
		["rights", metadata.rights],
		["accessibility.summary", a11y.summary],
		["accessibility.conformsTo", a11y.conformsTo],
		...(metadata.subjects ?? []).map((value): [string, string] => ["subjects", value]),
		...(metadata.creators ?? []).flatMap((creator): [string, string | undefined][] => [
			["creators", creator.name],
			["creators", creator.fileAs],
		]),
		...[a11y.modes, a11y.modesSufficient, a11y.features, a11y.hazards]
			.flatMap((values) => values ?? [])
			.map((value): [string, string] => ["accessibility", value]),
	];
	return optional.filter((entry): entry is [string, string] => entry[1] !== undefined);
}

/** A date `dcterms:modified` can write: valid, with a four-digit year. */
function isWritableDate(date: Date): boolean {
	let year = date.getUTCFullYear();
	return !Number.isNaN(year) && year >= 0 && year <= 9999;
}

/** Checks each chapter's id, title and language, then parses and verifies its body. */
function checkChapters(
	chapters: readonly EPUB.Chapter[],
	language: string,
): Result<CheckedChapter[], EpubError> {
	if (chapters.length === 0)
		return failure(new EpubContentError("A publication needs at least one chapter"));

	let checked: CheckedChapter[] = [];
	let ids = new Set<string>();
	for (let chapter of chapters) {
		if (!isNCName(chapter.id)) {
			return failure(
				new EpubPathError(
					`"${chapter.id}" is not a valid chapter id; start with a letter or "_" and use letters, digits, ".", "_" or "-"`,
					chapter.id,
				),
			);
		}
		if (ids.has(chapter.id.toLowerCase())) {
			return failure(new EpubPathError(`The chapter id "${chapter.id}" is used twice`, chapter.id));
		}
		ids.add(chapter.id.toLowerCase());
		if (chapter.title.trim() === "" || hasForbiddenCharacter(chapter.title)) {
			return failure(
				new EpubMetadataError(`Chapter "${chapter.id}" needs a title of plain text`, chapter.id),
			);
		}
		if (chapter.language !== undefined && !LANGUAGE_TAG.test(chapter.language)) {
			return failure(
				new EpubMetadataError(`"${chapter.language}" is not a BCP 47 language tag`, chapter.id),
			);
		}

		let parsed = parseBody(chapter.id, chapter.body);
		if (parsed.status === "failure") return parsed;
		checked.push({
			input: chapter,
			path: `text/${chapter.id}.xhtml`,
			language: chapter.language ?? language,
			parsed: parsed.data,
		});
	}

	if (!checked.some((chapter) => chapter.input.linear !== false)) {
		return failure(new EpubContentError("At least one chapter must be linear"));
	}
	if (!checked.some((chapter) => chapter.input.toc !== false)) {
		return failure(new EpubContentError("At least one chapter must be in the table of contents"));
	}
	return success(checked);
}

/**
 * Checks every style, resource and the cover image: a usable path, unique once case is
 * folded (archives extract onto case-insensitive file systems), and a core media type.
 */
function checkAssets(input: EPUB.Input): Result<Map<string, CheckedAsset>, EpubError> {
	let encoder = new TextEncoder();
	let candidates: { path: string; bytes: Uint8Array; kind: CheckedAsset["kind"] }[] = [
		...(input.styles ?? []).map((style) => ({
			path: style.path,
			bytes: encoder.encode(style.text),
			kind: "style" as const,
		})),
		...(input.cover ? [{ ...input.cover.image, kind: "cover" as const }] : []),
		...(input.resources ?? []).map((resource) => ({ ...resource, kind: "resource" as const })),
	];

	let assets = new Map<string, CheckedAsset>();
	let folded = new Set<string>();
	for (let candidate of candidates) {
		let problem = pathProblem(candidate.path);
		if (problem) return failure(new EpubPathError(problem, candidate.path));
		if (folded.has(candidate.path.toLowerCase())) {
			return failure(new EpubPathError(`"${candidate.path}" is used twice`, candidate.path));
		}
		folded.add(candidate.path.toLowerCase());

		let mediaType = mediaTypeOf(candidate.path);
		if (!mediaType) {
			return failure(
				new EpubMediaTypeError(
					`"${candidate.path}" has no EPUB core media type; use CSS, JPEG, PNG, GIF, WebP, SVG, WOFF, WOFF2, OTF, TTF, MP3 or M4A`,
					candidate.path,
				),
			);
		}
		if (candidate.kind === "style" && mediaType !== "text/css") {
			return failure(
				new EpubMediaTypeError(
					`The stylesheet "${candidate.path}" must end in .css`,
					candidate.path,
				),
			);
		}
		if (candidate.kind === "cover" && !mediaType.startsWith("image/")) {
			return failure(
				new EpubMediaTypeError(`The cover "${candidate.path}" must be an image`, candidate.path),
			);
		}
		assets.set(candidate.path, { ...candidate, mediaType });
	}
	return success(assets);
}

/**
 * Checks one reference in a chapter. A resource must be a file of the publication (or a
 * `data:` URL); a link may leave it, and otherwise must land on a content document and, with
 * a fragment, on an `id` inside it.
 */
function checkReference(
	chapter: CheckedChapter,
	reference: Reference,
	assets: ReadonlyMap<string, CheckedAsset>,
	documents: ReadonlyMap<string, ReadonlySet<string>>,
): EpubError | undefined {
	let id = chapter.input.id;
	let value = reference.value.trim();

	if (reference.kind === "resource") {
		if (value.startsWith("data:")) return undefined;
		if (isRemote(value)) {
			return new EpubRemoteResourceError(
				`Chapter "${id}" loads "${value}" from the web; pass its bytes as a resource instead`,
				id,
			);
		}
		let target = resolveReference(chapter.path, value);
		if (!target?.path || !(assets.has(target.path) || documents.has(target.path))) {
			return new EpubMissingResourceError(
				`Chapter "${id}" references "${value}", which the publication does not hold`,
				id,
			);
		}
		return undefined;
	}

	if (value.startsWith("data:")) {
		return new EpubRemoteResourceError(
			`Chapter "${id}" links to a data: URL, which reading systems cannot open`,
			id,
		);
	}
	if (isRemote(value)) return undefined;

	let target = resolveReference(chapter.path, value);
	if (!target)
		return new EpubMissingResourceError(
			`Chapter "${id}" links to "${value}", which leaves the publication`,
			id,
		);
	let ids = target.path === undefined ? chapter.parsed.ids : documents.get(target.path);
	if (!ids) {
		let what =
			target.path !== undefined && assets.has(target.path)
				? "a file outside the reading order"
				: "a file the publication does not hold";
		return new EpubMissingResourceError(`Chapter "${id}" links to "${value}", ${what}`, id);
	}
	if (target.fragment && !ids.has(target.fragment)) {
		return new EpubMissingResourceError(
			`Chapter "${id}" links to "${value}", but no element has the id "${target.fragment}"`,
			id,
		);
	}
	return undefined;
}

/**
 * The first chapter a reader could never open: out of the reading order, out of the table of
 * contents, and the target of no link from another chapter.
 */
function unreachableChapter(chapters: readonly CheckedChapter[]): EpubError | undefined {
	let linked = new Set<string>();
	for (let chapter of chapters) {
		for (let reference of chapter.parsed.references) {
			if (reference.kind !== "link" || isRemote(reference.value)) continue;
			let target = resolveReference(chapter.path, reference.value.trim());
			if (target?.path && target.path !== chapter.path) linked.add(target.path);
		}
	}
	let hidden = chapters.find(
		(chapter) =>
			chapter.input.linear === false && chapter.input.toc === false && !linked.has(chapter.path),
	);
	if (!hidden) return undefined;
	return new EpubContentError(
		`Chapter "${hidden.input.id}" is out of the reading order and the table of contents, and no chapter links to it`,
		hidden.input.id,
	);
}

/** Checks that every table-of-contents section opens at an `id` its chapter holds. */
function checkSections(
	chapter: CheckedChapter,
	sections: readonly EPUB.Section[],
): EpubError | undefined {
	for (let section of sections) {
		if (section.title.trim() === "" || hasForbiddenCharacter(section.title)) {
			return new EpubMetadataError(
				`A section of chapter "${chapter.input.id}" needs a title of plain text`,
				chapter.input.id,
			);
		}
		if (!chapter.parsed.ids.has(section.fragment)) {
			return new EpubMissingResourceError(
				`Section "${section.title}" points at "#${section.fragment}", which chapter "${chapter.input.id}" does not hold`,
				chapter.input.id,
			);
		}
		let nested = checkSections(chapter, section.sections ?? []);
		if (nested) return nested;
	}
	return undefined;
}

/**
 * Checks the `url()` and `@import` references in a stylesheet: fonts and images from the web
 * are refused like any remote resource, and relative ones must be files of the publication.
 */
function checkStylesheet(
	style: EPUB.Style,
	assets: ReadonlyMap<string, CheckedAsset>,
): EpubError | undefined {
	let css = style.text.replaceAll(/\/\*[\s\S]*?\*\//gu, "");
	let references = [
		...[...css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gu)].map((match) => match[2] ?? ""),
		...[...css.matchAll(/@import\s+(['"])(.*?)\1/gu)].map((match) => match[2] ?? ""),
	];
	for (let reference of references) {
		let value = reference.trim();
		if (value === "" || value.startsWith("data:") || value.startsWith("#")) continue;
		if (isRemote(value)) {
			return new EpubRemoteResourceError(
				`The stylesheet "${style.path}" loads "${value}" from the web; pass its bytes as a resource instead`,
				style.path,
			);
		}
		let target = resolveReference(style.path, value);
		if (!target?.path || !assets.has(target.path)) {
			return new EpubMissingResourceError(
				`The stylesheet "${style.path}" references "${value}", which the publication does not hold`,
				style.path,
			);
		}
	}
	return undefined;
}

/** An id for a package document element, unique against every id already taken. */
function uniqueId(base: string, taken: Set<string>): string {
	let id = base;
	for (let suffix = 2; taken.has(id.toLowerCase()); suffix++) id = `${base}-${suffix}`;
	taken.add(id.toLowerCase());
	return id;
}

/** Writes every file of the container, in the order the archive holds them. */
function writeFiles(
	input: EPUB.Input,
	chapters: readonly CheckedChapter[],
	assets: ReadonlyMap<string, CheckedAsset>,
): Result<EPUB.File[], EpubError> {
	let { metadata } = input;
	let labels = {
		contents: input.labels?.contents ?? "Contents",
		landmarks: input.labels?.landmarks ?? "Landmarks",
		cover: input.labels?.cover ?? "Cover",
		start: input.labels?.start ?? "Start of Content",
	};
	let legacyNcx = input.legacyNcx !== false;
	let styles = [...assets.values()].filter((asset) => asset.kind === "style");

	let taken = new Set(chapters.map((chapter) => chapter.input.id.toLowerCase()));
	let ids = {
		publication: uniqueId("pub-id", taken),
		nav: uniqueId("nav", taken),
		ncx: legacyNcx ? uniqueId("ncx", taken) : undefined,
		cover: input.cover ? uniqueId("cover", taken) : undefined,
	};

	let manifest: ManifestItem[] = [
		{ id: ids.nav, href: "nav.xhtml", mediaType: "application/xhtml+xml", properties: ["nav"] },
	];
	if (ids.ncx)
		manifest.push({
			id: ids.ncx,
			href: "toc.ncx",
			mediaType: "application/x-dtbncx+xml",
			properties: [],
		});
	if (ids.cover)
		manifest.push({
			id: ids.cover,
			href: "cover.xhtml",
			mediaType: "application/xhtml+xml",
			properties: [],
		});
	for (let chapter of chapters) {
		manifest.push({
			id: chapter.input.id,
			href: chapter.path,
			mediaType: "application/xhtml+xml",
			properties: [...chapter.parsed.properties].sort(),
		});
	}
	let coverImageId: string | undefined;
	for (let [index, asset] of [...assets.values()].entries()) {
		let id = uniqueId(
			asset.kind === "cover"
				? "cover-image"
				: asset.kind === "style"
					? `style-${index + 1}`
					: `resource-${index + 1}`,
			taken,
		);
		if (asset.kind === "cover") coverImageId = id;
		manifest.push({
			id,
			href: asset.path,
			mediaType: asset.mediaType,
			properties: asset.kind === "cover" ? ["cover-image"] : [],
		});
	}

	let spine: SpineItem[] = [
		...(ids.cover ? [{ idref: ids.cover, linear: true }] : []),
		{ idref: ids.nav, linear: false },
		...chapters.map((chapter) => ({
			idref: chapter.input.id,
			linear: chapter.input.linear !== false,
		})),
	];

	let toc = chapters
		.filter((chapter) => chapter.input.toc !== false)
		.map((chapter) => ({
			title: chapter.input.title,
			href: chapter.path,
			children: sectionEntries(chapter.path, chapter.input.sections ?? []),
		}));
	let start =
		chapters.find((chapter) => chapter.input.toc !== false && chapter.input.linear !== false) ??
		chapters.find((chapter) => chapter.input.linear !== false);
	let landmarks: Landmark[] = [
		...(input.cover ? [{ type: "cover" as const, title: labels.cover, href: "cover.xhtml" }] : []),
		{ type: "toc", title: labels.contents, href: "nav.xhtml#toc" },
		...(start ? [{ type: "bodymatter" as const, title: labels.start, href: start.path }] : []),
	];

	let written: [string, Result<string, Error>][] = [
		["META-INF/container.xml", containerDocument()],
		[
			"EPUB/package.opf",
			packageDocument({
				language: metadata.language,
				uniqueIdentifier: ids.publication,
				metadata: metadataElements(metadata, ids.publication, coverImageId, taken),
				manifest,
				spine,
				ncxId: ids.ncx,
			}),
		],
		[
			"EPUB/nav.xhtml",
			navigationDocument({
				language: metadata.language,
				title: metadata.title,
				contentsLabel: labels.contents,
				landmarksLabel: labels.landmarks,
				toc,
				landmarks,
			}),
		],
	];
	if (legacyNcx) {
		written.push([
			"EPUB/toc.ncx",
			ncxDocument({
				identifier: metadata.identifier,
				language: metadata.language,
				title: metadata.title,
				toc,
			}),
		]);
	}
	if (input.cover) {
		written.push([
			"EPUB/cover.xhtml",
			coverDocument({
				language: metadata.language,
				title: metadata.title,
				image: input.cover.image.path,
				alt: input.cover.alt,
			}),
		]);
	}
	for (let chapter of chapters) {
		written.push([
			`${ROOT}${chapter.path}`,
			chapterDocument({
				path: chapter.path,
				language: chapter.language,
				title: chapter.input.title,
				stylesheets: styles.map((style) => style.path),
				body: chapter.parsed.nodes,
			}),
		]);
	}

	let encoder = new TextEncoder();
	let files: EPUB.File[] = [{ path: "mimetype", bytes: encoder.encode("application/epub+zip") }];
	for (let [path, text] of written) {
		if (text.status === "failure") {
			let chapter = chapters.find((candidate) => `${ROOT}${candidate.path}` === path);
			return failure(
				new EpubContentError(
					`"${path}" cannot be written as XML: ${text.error.message}`,
					chapter?.input.id ?? path,
					{
						cause: text.error,
					},
				),
			);
		}
		files.push({ path, bytes: encoder.encode(text.data) });
	}
	for (let asset of assets.values())
		files.push({ path: `${ROOT}${asset.path}`, bytes: asset.bytes });
	return success(files);
}

/** A chapter's sections as table-of-contents entries pointing into its document. */
function sectionEntries(path: string, sections: readonly EPUB.Section[]): TocEntry[] {
	return sections.map((section) => ({
		title: section.title,
		href: `${path}#${encodeURIComponent(section.fragment)}`,
		children: sectionEntries(path, section.sections ?? []),
	}));
}

/**
 * The package metadata as Dublin Core and `<meta>` elements. Creator roles and sort names
 * refine their creator by id, and the cover is named by `<meta name="cover">` too, which EPUB
 * 2 reading systems and Kindle's converter read.
 */
function metadataElements(
	metadata: EPUB.Metadata,
	publicationId: string,
	coverImageId: string | undefined,
	taken: Set<string>,
): XML.Element[] {
	let elements: XML.Element[] = [
		element("dc:identifier", { id: publicationId }, [metadata.identifier]),
		element("dc:title", {}, [metadata.title]),
		element("dc:language", {}, [metadata.language]),
	];
	for (let creator of metadata.creators ?? []) {
		let id = uniqueId("creator", taken);
		elements.push(element("dc:creator", { id }, [creator.name]));
		if (creator.role) {
			elements.push(
				element("meta", { refines: `#${id}`, property: "role", scheme: "marc:relators" }, [
					creator.role,
				]),
			);
		}
		if (creator.fileAs) {
			elements.push(element("meta", { refines: `#${id}`, property: "file-as" }, [creator.fileAs]));
		}
	}
	if (metadata.publisher) elements.push(element("dc:publisher", {}, [metadata.publisher]));
	if (metadata.published)
		elements.push(element("dc:date", {}, [metadata.published.toISOString().slice(0, 10)]));
	if (metadata.description) elements.push(element("dc:description", {}, [metadata.description]));
	if (metadata.rights) elements.push(element("dc:rights", {}, [metadata.rights]));
	for (let subject of metadata.subjects ?? []) elements.push(element("dc:subject", {}, [subject]));
	elements.push(
		element("meta", { property: "dcterms:modified" }, [
			metadata.modified.toISOString().replace(/\.\d{3}Z$/u, "Z"),
		]),
	);
	if (coverImageId) elements.push(element("meta", { name: "cover", content: coverImageId }));

	let a11y = metadata.accessibility;
	if (a11y) {
		let meta = (property: string, value: string) => element("meta", { property }, [value]);
		for (let mode of a11y.modes ?? []) elements.push(meta("schema:accessMode", mode));
		for (let modes of a11y.modesSufficient ?? [])
			elements.push(meta("schema:accessModeSufficient", modes));
		for (let feature of a11y.features ?? [])
			elements.push(meta("schema:accessibilityFeature", feature));
		for (let hazard of a11y.hazards ?? [])
			elements.push(meta("schema:accessibilityHazard", hazard));
		if (a11y.summary) elements.push(meta("schema:accessibilitySummary", a11y.summary));
		if (a11y.conformsTo) elements.push(meta("dcterms:conformsTo", a11y.conformsTo));
	}
	return elements;
}

/** The archive timestamp for every entry: `modified`, when DOS dates can record it. */
function zipTimestamp(modified: Date): Date | undefined {
	let year = modified.getUTCFullYear();
	return year >= 1980 && year <= 2107 ? modified : undefined;
}

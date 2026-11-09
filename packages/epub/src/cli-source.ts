/**
 * What `build` and `check` share: finding the book a path names (a file, a folder or stdin),
 * reading its files from disk and the web, and turning each step of `fromMarkdown` into a
 * progress line on stderr, so a long read or a download never runs silently.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { basename, dirname, relative, resolve, sep } from "node:path";

import type { ChainContext, ExitError, Task } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { exit } from "@sdxc/cli";
import { failure, isFailure, success } from "@sdxc/result";

import type { EpubError } from "./errors.js";
import type { MarkdownBook } from "./markdown.js";

import { fromMarkdown } from "./markdown.js";

/** How long one download may take. */
const DOWNLOAD_TIMEOUT_MS = 30_000;

/** The largest file a download may be. */
const DOWNLOAD_LIMIT_BYTES = 20 * 1024 * 1024;

/** The parts of a running command the shared steps use. */
export type SourceContext = Pick<
	ChainContext,
	"cwd" | "env" | "stdin" | "stderr" | "task" | "signal"
>;

/** The flags `build` and `check` share, as the contract types them. */
export interface BookFlags {
	title?: string;
	author: string[];
	language?: string;
	identifier?: string;
	publisher?: string;
	description?: string;
	cover?: string;
	coverAlt?: string;
	font: string[];
	style: string[];
	defaultStyle: boolean;
	tocDepth: number;
	ncx: boolean;
	allowRemote: boolean;
}

/** Where a book was found. */
export interface BookLocation {
	/** The folder every reference resolves from. */
	root: string;
	source: MarkdownBook.Source;
	/** How diagnostics name the input: the path as typed, or `<stdin>`. */
	name: string;
	/** Where `build` writes by default, or `undefined` for stdin. */
	output: string | undefined;
}

/** A prepared book: the `EPUB.build` input and the report of what went into it. */
export interface PreparedBook {
	location: BookLocation;
	book: MarkdownBook.Book;
}

/**
 * Finds the book a path names: a folder, a Markdown file, or stdin for `-`. A file's
 * references resolve from its folder; stdin's resolve from the working directory.
 *
 * @param ctx - The running command, for its directory and stdin
 * @param path - The argument as typed
 * @returns The book's location, or an exit 2 naming the path that cannot be read
 */
export async function locateBook(
	ctx: SourceContext,
	path: string,
): Promise<Result<BookLocation, ExitError>> {
	if (path === "-") {
		if (ctx.stdin.isTTY)
			return exit(2, "Pass a Markdown file or a book folder, or pipe Markdown on stdin");
		let text = await ctx.stdin.text();
		return success({
			root: ctx.cwd,
			source: { file: "stdin.md", text },
			name: "<stdin>",
			output: undefined,
		});
	}

	let absolute = resolve(ctx.cwd, path);
	let info;
	try {
		info = await stat(absolute);
	} catch (error) {
		return exit(2, `Cannot read ${path}: ${reason(error)}`);
	}
	if (info.isDirectory()) {
		let files = await listFiles(absolute);
		let name = basename(absolute);
		return success({
			root: absolute,
			source: { files },
			name: path,
			output: resolve(dirname(absolute), `${name}.epub`),
		});
	}
	let file = basename(absolute);
	return success({
		root: dirname(absolute),
		source: { file },
		name: path,
		output: resolve(dirname(absolute), `${file.replace(/\.(md|markdown)$/iu, "")}.epub`),
	});
}

/** Every file under a folder as a `/`-separated relative path, skipping dotfiles and `node_modules`. */
async function listFiles(root: string): Promise<string[]> {
	let entries = await readdir(root, { recursive: true, withFileTypes: true });
	return entries
		.filter((entry) => entry.isFile())
		.map((entry) => relative(root, resolve(entry.parentPath, entry.name)).split(sep).join("/"))
		.filter(
			(path) => !path.split("/").some((part) => part.startsWith(".") || part === "node_modules"),
		)
		.sort();
}

/**
 * Reads the book through `fromMarkdown`, with a progress line per step: the Markdown files, the
 * fonts, the local files and the downloads, each counting its reads against its total.
 *
 * @param ctx - The running command
 * @param location - Where the book was found
 * @param flags - What the command line asked for
 * @returns The prepared book, or the failure to report: an `ExitError` for unreadable flags, an `EpubError` for the book
 */
export async function prepareBook(
	ctx: SourceContext,
	location: BookLocation,
	flags: BookFlags,
): Promise<Result<PreparedBook, ExitError | EpubError>> {
	let extras = await readExtras(ctx, location, flags);
	if (isFailure(extras)) return extras;

	let progress = new Progress(ctx, location.name);
	let book = await fromMarkdown({
		source: location.source,
		read: (path, init) => readBookFile(location.root, path, init.signal),
		remote: flags.allowRemote,
		metadata: {
			title: flags.title,
			authors: flags.author.length > 0 ? flags.author : undefined,
			language: flags.language,
			identifier: flags.identifier,
			publisher: flags.publisher,
			description: flags.description,
			modified: sourceDate(ctx.env.SOURCE_DATE_EPOCH),
		},
		cover:
			flags.cover === undefined
				? undefined
				: { path: extras.data.cover ?? flags.cover, alt: flags.coverAlt },
		styles: extras.data.styles,
		defaultStyle: flags.defaultStyle,
		fonts: extras.data.fonts,
		tocDepth: flags.tocDepth,
		signal: ctx.signal,
		onProgress: (event) => progress.on(event),
	});
	progress.finish(book.status === "success");
	await progress.settled();
	if (isFailure(book)) return book;

	for (let path of book.data.ignored) {
		ctx.stderr(`Ignored ${path}: a book folder reads index.md and ch<N>.md files\n`);
	}
	book.data.input.legacyNcx = flags.ncx;
	return success({ location, book: book.data });
}

/** The fonts and stylesheets named by flags, read under one progress line. */
async function readExtras(
	ctx: SourceContext,
	location: BookLocation,
	flags: BookFlags,
): Promise<
	Result<
		{ fonts: MarkdownBook.Font[]; styles: MarkdownBook.Style[]; cover: string | undefined },
		ExitError
	>
> {
	let cover =
		flags.cover === undefined || /^https?:\/\//iu.test(flags.cover)
			? undefined
			: bookPath(location, resolve(ctx.cwd, flags.cover));
	let total = flags.font.length + flags.style.length;
	if (total === 0) return success({ fonts: [], styles: [], cover });

	let label = flags.font.length > 0 ? "Reading fonts and stylesheets" : "Reading stylesheets";
	let read = await ctx.task(label, async (task) => {
		task.total(total);
		let fonts: MarkdownBook.Font[] = [];
		for (let path of flags.font) {
			fonts.push({ path, bytes: new Uint8Array(await readFile(resolve(ctx.cwd, path))) });
			task.advance();
		}
		let styles: MarkdownBook.Style[] = [];
		for (let path of flags.style) {
			let absolute = resolve(ctx.cwd, path);
			styles.push({ path: bookPath(location, absolute), text: await readFile(absolute, "utf8") });
			task.advance();
		}
		return { fonts, styles, cover };
	});
	if (isFailure(read))
		return exit(2, `Cannot read a --font or --style file: ${read.error.message}`);
	return read;
}

/** An absolute path as the book sees it: relative to its folder, `/`-separated. */
function bookPath(location: BookLocation, absolute: string): string {
	return relative(location.root, absolute).split(sep).join("/");
}

/** `modified` from `SOURCE_DATE_EPOCH`, so two builds of one source are byte for byte equal. */
function sourceDate(value: string | undefined): Date | undefined {
	if (value === undefined || !/^\d+$/u.test(value)) return undefined;
	return new Date(Number(value) * 1000);
}

/**
 * Reads one file of the book: a path from the book's folder, or a URL downloaded with a deadline
 * and a size cap. A missing file answers `null`, so the error names what referenced it.
 */
async function readBookFile(
	root: string,
	path: string,
	signal: AbortSignal,
): Promise<MarkdownBook.File | null> {
	if (/^https?:\/\//iu.test(path)) return await download(path, signal);
	try {
		return { bytes: new Uint8Array(await readFile(resolve(root, path))) };
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
		throw error;
	}
}

/** Downloads a file, refusing one past the size cap as soon as it is known to be. */
async function download(url: string, signal: AbortSignal): Promise<MarkdownBook.File> {
	let response = await fetch(url, {
		signal: AbortSignal.any([signal, AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS)]),
	});
	if (!response.ok)
		throw new Error(`the server answered ${response.status} ${response.statusText}`.trim());
	if (Number(response.headers.get("content-length") ?? 0) > DOWNLOAD_LIMIT_BYTES) {
		throw new Error(`it is larger than ${DOWNLOAD_LIMIT_BYTES / 1024 / 1024} MB`);
	}

	let chunks: Uint8Array[] = [];
	let size = 0;
	for await (let chunk of response.body ?? []) {
		size += chunk.byteLength;
		if (size > DOWNLOAD_LIMIT_BYTES)
			throw new Error(`it is larger than ${DOWNLOAD_LIMIT_BYTES / 1024 / 1024} MB`);
		chunks.push(chunk);
	}
	let bytes = new Uint8Array(size);
	let offset = 0;
	for (let chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return { bytes, type: response.headers.get("content-type") ?? undefined };
}

/** Why a file could not be read, as one line. */
function reason(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/**
 * A progress line that the code reporting progress opens and closes, rather than a callback
 * that holds it open: it counts reads against a total and ends with ✓ or ✗.
 */
class Phase {
	#task: Task | undefined;
	#pending = 0;
	#count = 0;
	#end: (result: Result<undefined, Error>) => void = () => {};
	readonly total: number;
	readonly done: Promise<unknown>;

	/**
	 * @param ctx - The running command, whose `task` draws the line
	 * @param label - What the line says
	 * @param total - How many reads complete it
	 */
	constructor(ctx: SourceContext, label: string, total: number) {
		this.total = total;
		let finished = new Promise<Result<undefined, Error>>((resolve) => {
			this.#end = resolve;
		});
		this.done = ctx.task(label, (task) => {
			this.#task = task;
			task.total(total);
			if (this.#pending > 0) task.advance(this.#pending);
			return finished;
		});
	}

	/** Counts one finished read. */
	advance(): void {
		this.#count++;
		if (this.#task) this.#task.advance();
		else this.#pending++;
	}

	/** Ends the line: ✓ when it succeeded, ✗ when the build stopped before every read finished. */
	close(succeeded: boolean): void {
		let complete = succeeded || this.#count >= this.total;
		this.#end(complete ? success(undefined) : failure(new Error("stopped")));
	}
}

/** Turns `fromMarkdown`'s progress events into one line per step. */
class Progress {
	#ctx: SourceContext;
	#name: string;
	#sources: Phase | undefined;
	#local: Phase | undefined;
	#remote: Phase | undefined;
	#phases: Phase[] = [];

	/**
	 * @param ctx - The running command
	 * @param name - How the book's input is named
	 */
	constructor(ctx: SourceContext, name: string) {
		this.#ctx = ctx;
		this.#name = name;
	}

	/** Opens a step's line when its total is known, and counts each read on the open step. */
	on(event: MarkdownBook.Progress): void {
		if (event.type === "sources") {
			if (event.paths.length > 0)
				this.#sources = this.#open(`Reading ${this.#name}`, event.paths.length);
			return;
		}
		if (event.type === "assets") {
			this.#sources?.close(true);
			this.#sources = undefined;
			if (event.local.length > 0)
				this.#local = this.#open("Reading images, stylesheets and fonts", event.local.length);
			if (event.remote.length > 0)
				this.#remote = this.#open("Downloading remote files", event.remote.length);
			return;
		}
		let phase = this.#sources ?? (event.remote ? this.#remote : this.#local);
		phase?.advance();
	}

	/** Closes every line still open, as ✓ when the build succeeded. */
	finish(succeeded: boolean): void {
		for (let phase of this.#phases) phase.close(succeeded);
	}

	/** Waits for every line to print its final state. */
	async settled(): Promise<void> {
		await Promise.all(this.#phases.map((phase) => phase.done));
	}

	/** Starts a line and remembers it, so `finish` closes it. */
	#open(label: string, total: number): Phase {
		let phase = new Phase(this.#ctx, label, total);
		this.#phases.push(phase);
		return phase;
	}
}

/**
 * The line a failed book prints: the file or chapter it concerns, the rule's code and the
 * message, with the flag that lifts a refused download.
 */
export function describeFailure(error: EpubError): string {
	let where = error.path === undefined ? "" : `${error.path}: `;
	let hint =
		error.code === "remote-resource"
			? "\nPass --allow-remote to download it into the book, at your own risk."
			: "";
	return `${where}${error.code} ${error.message}${hint}`;
}

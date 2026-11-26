/**
 * The encyclopedia: one book for everything the reader has learned. Pages down its edge open the
 * cast, the novel's own topics (places, magic, terms), the CGs and the music; a topic lists its
 * learned entries beside the open article, which keeps its unlearned ones hidden.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { intl } from "@sdxc/i18n/ui";
import { css, on } from "remix/component";

import type { Novel } from "../novel.js";

import { INTERNALS } from "../novel.js";

import type { LibraryEntry, LibraryTopic } from "./library.js";
import type { NovelLabels } from "./settings.js";

import { Characters } from "./characters.js";
import { Gallery } from "./gallery.js";
import { libraryReader, librarySource } from "./library.js";
import { Message } from "./message.js";
import { MusicRoom } from "./music-room.js";
import { NovelPlayer } from "./player.js";
import { DEFAULT_LABELS } from "./settings.js";
import { resolveSource } from "./source.js";
import { themeVar } from "./theme.js";

/** The pages every encyclopedia offers, beside the novel's topics. */
const BUILT_IN_PAGES = ["all", "characters", "gallery", "music"] as const;

/** The pages an encyclopedia shows unless told otherwise; `topics` stands for every topic. */
const DEFAULT_PAGES: readonly string[] = ["all", "characters", "topics", "gallery", "music"];

export namespace Encyclopedia {
	/** Props {@link Encyclopedia} accepts. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** The novel; inside a player it defaults to the player's. */
		novel?: Novel;
		/**
		 * The stored `Persistent` value; inside a player it defaults to the play's. Keep one value
		 * while the screen shows, since a new value reads the library again.
		 */
		persistent?: unknown;
		/**
		 * The pages down the book's edge, in order: `all` (every learned entry), `characters`,
		 * `gallery`, `music`, a topic's id, or `topics` for every topic not named elsewhere. The
		 * gallery and the music room show only when the novel declares an image or a track.
		 *
		 * @default ["all", "characters", "topics", "gallery", "music"]
		 */
		pages?: readonly string[];
		/** Each track's title as a message key, by asset id, for the music page. */
		titles?: Readonly<Record<string, string>>;
		labels?: Partial<NovelLabels>;
	}

	/** One of the built-in pages. */
	export type BuiltInPage = (typeof BUILT_IN_PAGES)[number];
}

/**
 * The page a player asked the book to open on: the topic of the entry `showEntry()` named, or the
 * characters page after `showCharacter()`.
 */
function openingPage(player: NovelPlayer.Context | undefined): string | undefined {
	if (player?.entry !== undefined) return player.entry.split(".")[0];
	if (player?.character !== undefined) return "characters";
	return undefined;
}

/** A page down the book's edge: a built-in one, or one of the novel's topics. */
type Page = { id: Encyclopedia.BuiltInPage } | { id: string; topic: LibraryTopic };

/**
 * Shows the encyclopedia. Inside a player it opens on the entry `showEntry()` or the character
 * `showCharacter()` last asked for, and otherwise on its first page.
 *
 * @example <Encyclopedia pages={["characters", "places", "terms", "gallery"]} />
 */
export function Encyclopedia(handle: Handle<Encyclopedia.Props>) {
	let read = libraryReader(handle);
	let player = handle.context.get(NovelPlayer) as NovelPlayer.Context | undefined;
	let current = openingPage(player);

	/** Turns to `id`. */
	function turn(id: string): void {
		current = id;
		void handle.update();
	}

	return () => {
		let {
			novel: _novel,
			persistent: _persistent,
			pages: wanted = DEFAULT_PAGES,
			titles,
			labels: overrides,
			mix,
			...rest
		} = handle.props;
		let source = librarySource(player, handle.props);
		if (source === undefined) return null;
		let labels = { ...DEFAULT_LABELS, ...player?.labels, ...overrides };
		let locale = intl(handle).locale;
		let library = read(source.novel, source.persistent, locale);
		let declared = new Set(
			[...source.novel[INTERNALS]().assets.values()].map((asset) => asset.kind),
		);
		let pages = resolvePages(wanted, library?.topics ?? []).filter(
			(item) =>
				(item.id !== "gallery" || declared.has("image")) &&
				(item.id !== "music" || declared.has("music")),
		);
		let page = pages.find((item) => item.id === current) ?? pages[0];
		let shared = { novel: source.novel, persistent: source.persistent, labels };
		return (
			<div
				{...rest}
				data-novel-encyclopedia=""
				aria-busy={library === undefined ? "true" : undefined}
				mix={[
					css({
						containerType: "inline-size",
						display: "grid",
						gridTemplateColumns: "auto minmax(0, 1fr)",
						gap: "1rem",
						blockSize: "min(64vh, 38rem)",
						"@container (max-width: 36rem)": {
							gridTemplateColumns: "minmax(0, 1fr)",
							gridTemplateRows: "auto minmax(0, 1fr)",
						},
					}),
					mix,
				]}
			>
				<div
					role="tablist"
					aria-orientation="vertical"
					aria-label={labels.encyclopedia}
					mix={css({
						display: "flex",
						flexDirection: "column",
						gap: "0.5rem",
						overflowY: "auto",
						"@container (max-width: 36rem)": { flexDirection: "row", overflowX: "auto" },
					})}
				>
					{pages.map((item) => (
						<button
							key={item.id}
							type="button"
							role="tab"
							aria-selected={item === page ? "true" : "false"}
							data-novel-encyclopedia-page={item.id}
							mix={[
								css({
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									gap: "0.25rem",
									minInlineSize: "6rem",
									padding: "0.5rem 0.75rem",
									border: themeVar("--novel-settings-tab-border"),
									borderRadius: themeVar("--novel-settings-tab-radius"),
									background: themeVar("--novel-settings-tab-background"),
									color: themeVar("--novel-settings-tab-color"),
									font: themeVar("--novel-settings-tab-font"),
									cursor: "pointer",
									"&:hover, &:focus-visible, &[aria-selected='true']": {
										background: themeVar("--novel-settings-tab-selected-background"),
										color: themeVar("--novel-settings-tab-selected-color"),
									},
								}),
								on("click", () => turn(item.id)),
							]}
						>
							{"topic" in item && item.topic.topic.icon !== undefined ? (
								<img
									alt=""
									src={resolveSource(item.topic.topic.icon, locale)}
									mix={css({ inlineSize: "1.75rem", blockSize: "1.75rem", objectFit: "contain" })}
								/>
							) : null}
							<PageName page={item} labels={labels} />
						</button>
					))}
				</div>
				<div
					role="tabpanel"
					data-novel-encyclopedia-content={page?.id ?? ""}
					style={
						page?.id === "characters"
							? { overflowY: "hidden", "--novel-characters-height": "100%" }
							: undefined
					}
					mix={css({
						minInlineSize: 0,
						minBlockSize: 0,
						overflowY: "auto",
						padding: themeVar("--novel-encyclopedia-page-padding"),
						background: themeVar("--novel-settings-panel-background"),
						color: themeVar("--novel-settings-panel-color"),
					})}
				>
					{library === undefined ? <p>{labels.loading}</p> : null}
					<PageContent
						page={page}
						library={library?.topics ?? []}
						shared={shared}
						titles={titles}
						entry={player?.entry}
					/>
				</div>
			</div>
		);
	};
}

/**
 * Expands `wanted` into pages: built-in ones as named, topics by id, `topics` as the rest. A
 * novel without topics has no `all` page, since it would always be empty.
 */
function resolvePages(wanted: readonly string[], topics: readonly LibraryTopic[]): Page[] {
	let named = new Set(wanted);
	let pages: Page[] = [];
	for (let id of wanted) {
		if (id === "all" && topics.length === 0) continue;
		if ((BUILT_IN_PAGES as readonly string[]).includes(id)) {
			pages.push({ id: id as Encyclopedia.BuiltInPage });
			continue;
		}
		if (id === "topics") {
			for (let topic of topics) {
				if (!named.has(topic.topic.id)) pages.push({ id: topic.topic.id, topic });
			}
			continue;
		}
		let topic = topics.find((item) => item.topic.id === id);
		if (topic !== undefined) pages.push({ id, topic });
	}
	return pages;
}

/** Props of {@link PageName}. */
interface PageNameProps {
	page: Page;
	labels: NovelLabels;
}

/** A page's name on its tab: a topic's message, or the built-in page's label. */
function PageName(handle: Handle<PageNameProps>) {
	return () => {
		let { page, labels } = handle.props;
		if ("topic" in page) return <Message i18nKey={page.topic.topic.name} />;
		let names: Record<Encyclopedia.BuiltInPage, string> = {
			all: labels.encyclopediaAll,
			characters: labels.characters,
			gallery: labels.gallery,
			music: labels.musicRoom,
		};
		return <>{names[page.id as Encyclopedia.BuiltInPage]}</>;
	};
}

/** Props of {@link PageContent}. */
interface PageContentProps {
	page: Page | undefined;
	library: readonly LibraryTopic[];
	shared: { novel: Novel; persistent: unknown; labels: NovelLabels };
	/** The entry a player asked the book to open on. */
	entry: string | undefined;
	titles: Readonly<Record<string, string>> | undefined;
}

/** What a page shows: a built-in screen, every learned entry, or one topic's entries. */
function PageContent(handle: Handle<PageContentProps>) {
	return () => {
		let { page, library, shared, titles, entry } = handle.props;
		if (page === undefined) return null;
		if ("topic" in page) {
			return (
				<Entries
					key={page.id}
					entries={page.topic.entries}
					labels={shared.labels}
					initial={entry}
				/>
			);
		}
		if (page.id === "characters") return <Characters {...shared} />;
		if (page.id === "gallery") return <Gallery {...shared} />;
		if (page.id === "music") {
			return titles === undefined ? (
				<MusicRoom {...shared} />
			) : (
				<MusicRoom {...shared} titles={titles} />
			);
		}
		let all = library.flatMap((topic) =>
			topic.entries.map((entry) => ({ ...entry, topicName: topic.topic.name })),
		);
		return <Entries key="all" entries={all} labels={shared.labels} initial={entry} />;
	};
}

/** An entry as a page lists it, with its topic's name on the page of every entry. */
interface ListedEntry extends LibraryEntry {
	topicName?: string;
}

/** Props of {@link Entries}. */
interface EntriesProps {
	entries: readonly ListedEntry[];
	labels: NovelLabels;
	/** The entry the page opens on, such as the one a toast's click asked for. */
	initial?: string | undefined;
}

/**
 * A topic's learned entries, filtered by the search field as the reader types, beside the
 * chosen entry's article.
 */
function Entries(handle: Handle<EntriesProps>) {
	let query = "";
	let chosen: string | undefined = handle.props.initial;

	return () => {
		let { entries, labels } = handle.props;
		let t = intl(handle).t as (key: string) => string;
		let needle = query.trim().toLocaleLowerCase();
		let learned = entries.filter((item) => item.learned);
		let shown =
			needle === ""
				? learned
				: learned.filter((item) => t(item.entry.title).toLocaleLowerCase().includes(needle));
		let open = learned.find((item) => item.entry.id === chosen) ?? shown[0];
		return (
			<div
				data-novel-encyclopedia-entries=""
				mix={css({
					display: "grid",
					gridTemplateColumns: "minmax(10rem, 2fr) minmax(0, 3fr)",
					gap: "1.5rem",
					blockSize: "100%",
					"@container (max-width: 44rem)": { gridTemplateColumns: "minmax(0, 1fr)" },
				})}
			>
				<div
					mix={css({ display: "flex", flexDirection: "column", gap: "0.5rem", minBlockSize: 0 })}
				>
					<input
						type="search"
						data-novel-encyclopedia-search=""
						placeholder={labels.search}
						aria-label={labels.search}
						value={query}
						mix={[
							css({
								padding: "0.4rem 0.6rem",
								border: 0,
								borderBlockEnd: `1px solid ${themeVar("--novel-settings-divider")}`,
								background: "transparent",
								color: "inherit",
								font: "inherit",
							}),
							on("input", (event) => {
								query = event.currentTarget.value;
								void handle.update();
							}),
						]}
					/>
					{learned.length === 0 ? <p>{labels.noEntries}</p> : null}
					<ul
						mix={css({
							margin: 0,
							padding: 0,
							listStyle: "none",
							display: "flex",
							flexDirection: "column",
							gap: "0.25rem",
							overflowY: "auto",
						})}
					>
						{shown.map((item) => (
							<li key={item.entry.id}>
								<button
									type="button"
									data-entry={item.entry.id}
									aria-current={item === open ? "true" : undefined}
									mix={[
										css({
											display: "flex",
											gap: "0.6rem",
											alignItems: "baseline",
											inlineSize: "100%",
											padding: "0.5rem 0.75rem",
											border: 0,
											borderBlockEnd: `1px solid ${themeVar("--novel-settings-divider")}`,
											background: "transparent",
											color: "inherit",
											font: "inherit",
											textAlign: "start",
											cursor: "pointer",
											"&:hover, &[aria-current='true']": {
												background: themeVar("--novel-encyclopedia-current-background"),
												color: themeVar("--novel-encyclopedia-current-color"),
											},
										}),
										on("click", () => {
											chosen = item.entry.id;
											void handle.update();
										}),
									]}
								>
									{item.topicName === undefined ? null : (
										<span mix={css({ fontSize: "0.85em", opacity: 0.7 })}>
											<Message i18nKey={item.topicName} />
										</span>
									)}
									<span>
										<Message i18nKey={item.entry.title} />
									</span>
								</button>
							</li>
						))}
					</ul>
				</div>
				{open === undefined ? null : <Article key={open.entry.id} entry={open} labels={labels} />}
			</div>
		);
	};
}

/** Props of {@link Article}. */
interface ArticleProps {
	entry: ListedEntry;
	labels: NovelLabels;
}

/** One entry: its topic, title and summary, a contents list of its sections, then its text. */
function Article(handle: Handle<ArticleProps>) {
	let prefix = handle.id.replace(/[^\w-]/g, "-");
	return () => {
		let { entry, labels } = handle.props;
		let { title, summary, body, sections, image } = entry.entry;
		let locale = intl(handle).locale;
		return (
			<article
				data-novel-encyclopedia-article={entry.entry.id}
				mix={css({
					display: "flex",
					flexDirection: "column",
					gap: "0.75rem",
					minBlockSize: 0,
					overflowY: "auto",
					lineHeight: 1.55,
				})}
			>
				<header mix={css({ textAlign: "center" })}>
					{entry.topicName === undefined ? null : (
						<p
							data-novel-encyclopedia-topic=""
							mix={css({ margin: 0, fontSize: "0.85em", letterSpacing: "0.1em", opacity: 0.7 })}
						>
							<Message i18nKey={entry.topicName} />
						</p>
					)}
					<h3 mix={css({ margin: 0, fontSize: "1.6em", lineHeight: 1.2 })}>
						<Message i18nKey={title} />
					</h3>
					{summary === undefined ? null : (
						<p data-novel-encyclopedia-summary="" mix={css({ margin: "0.35rem 0 0" })}>
							<Message i18nKey={summary} />
						</p>
					)}
				</header>
				{image === undefined ? null : (
					<img
						alt=""
						src={resolveSource(image, locale)}
						mix={css({ maxInlineSize: "100%", maxBlockSize: "16rem", objectFit: "contain" })}
					/>
				)}
				{sections.length === 0 ? null : (
					<details data-novel-encyclopedia-contents="">
						<summary mix={css({ cursor: "pointer" })}>{labels.contents}</summary>
						<ol mix={css({ margin: "0.5rem 0 0", paddingInlineStart: "1.5rem" })}>
							{sections.map((section, index) => (
								<li key={index}>
									<a href={`#${prefix}-${index}`} mix={css({ color: "inherit" })}>
										<Message i18nKey={section.title} />
									</a>
								</li>
							))}
						</ol>
					</details>
				)}
				{body === undefined ? null : <Prose i18nKey={body} />}
				{sections.map((section, index) => (
					<section key={index} id={`${prefix}-${index}`}>
						<h4 mix={css({ margin: "0.5rem 0", fontSize: "1.15em" })}>
							{`${index + 1}. `}
							<Message i18nKey={section.title} />
						</h4>
						<Prose i18nKey={section.body} />
					</section>
				))}
			</article>
		);
	};
}

/** Props of {@link Prose}. */
interface ProseProps {
	i18nKey: string;
}

/** A message set as prose, where a blank line in the message starts a new paragraph. */
function Prose(handle: Handle<ProseProps>) {
	return () => (
		<p mix={css({ margin: 0, whiteSpace: "pre-line" })}>
			<Message i18nKey={handle.props.i18nKey} />
		</p>
	);
}

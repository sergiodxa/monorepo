/**
 * Chapter select and scene replay: the novel's titled chapters and titled scenes in declaration
 * order, the ones the reader has reached offered to play again and the rest shown locked. A pick
 * leaves as a cancelable `novel:replay` event, which a player starts as a replay by default.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { intl } from "@sdxc/i18n/ui";
import { css, on } from "remix/component";

import type { SceneDeclaration } from "../declarations.js";
import type { ReplayScope } from "../frames.js";
import type { Novel } from "../novel.js";

import type { LibraryChapter } from "./library.js";
import type { NovelLabels } from "./settings.js";

import { ArcSection, LibraryHeading } from "./arc-section.js";
import { NovelReplayEvent } from "./events.js";
import { libraryReader, librarySource } from "./library.js";
import { Message } from "./message.js";
import { NovelPlayer } from "./player.js";
import { DEFAULT_LABELS } from "./settings.js";

export namespace ChapterSelect {
	/** Props {@link ChapterSelect} and {@link SceneReplay} accept. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** The novel; inside a player it defaults to the player's. */
		novel?: Novel;
		/**
		 * The stored `Persistent` value; inside a player it defaults to the play's. Keep one value
		 * while the screen shows, since a new value reads the library again.
		 */
		persistent?: unknown;
		labels?: Partial<Pick<NovelLabels, "loading" | "locked">>;
	}
}

export namespace SceneReplay {
	/** Props {@link SceneReplay} accepts. */
	export type Props = ChapterSelect.Props;
}

/** Props of one row of a chapter or scene list. */
interface EntryProps {
	title: string;
	name: string;
	reached: boolean;
	lockedLabel: string;
	/** The scene a pick starts from, and how much the replay plays. */
	scene: SceneDeclaration;
	scope: ReplayScope;
}

/**
 * One row of a chapter or scene list: its title, and a button while it is reached. A pick
 * dispatches `novel:replay`, then starts the replay in the enclosing player unless a listener
 * prevented it; outside a player the listener alone acts.
 */
function Entry(handle: Handle<EntryProps>) {
	let player = handle.context.get(NovelPlayer) as NovelPlayer.Context | undefined;

	/** Reports the pick from `button` and runs the player's default unless a listener prevented it. */
	function select(button: HTMLButtonElement): void {
		let { scene, scope } = handle.props;
		let proceed = button.dispatchEvent(new NovelReplayEvent(scene, scope));
		if (proceed) void player?.replay(scene, scope);
	}

	return () => {
		let { title, name, reached, lockedLabel } = handle.props;
		return (
			<li data-name={name} data-reached={String(reached)}>
				<button
					type="button"
					disabled={!reached}
					aria-label={reached ? undefined : lockedLabel}
					mix={[
						css({
							inlineSize: "100%",
							padding: "0.6rem 0.8rem",
							border: "1px solid var(--ui-border, rgb(127 127 127 / 0.4))",
							borderRadius: "0.5rem",
							background: "transparent",
							color: "inherit",
							font: "inherit",
							textAlign: "start",
							cursor: "pointer",
							"&:disabled": { opacity: 0.5, cursor: "not-allowed" },
						}),
						on("click", (event) => select(event.currentTarget)),
					]}
				>
					{reached ? <Message i18nKey={title} /> : lockedLabel}
				</button>
			</li>
		);
	};
}

/**
 * Lists the titled chapters, under a heading per arc when the story has arcs; picking a reached
 * one dispatches `novel:replay` with its first mapped scene and the `"chapter"` scope.
 *
 * @example <ChapterSelect novel={novel} persistent={stored} mix={on("novel:replay", (event) => start(event.scene))} />
 */
export function ChapterSelect(handle: Handle<ChapterSelect.Props>) {
	let read = libraryReader(handle);
	let player = handle.context.get(NovelPlayer) as NovelPlayer.Context | undefined;
	return () => {
		let { novel: _novel, persistent: _persistent, labels: overrides, mix, ...rest } = handle.props;
		let source = librarySource(player, handle.props);
		if (source === undefined) return null;
		let labels = { ...DEFAULT_LABELS, ...player?.labels, ...overrides };
		let library = read(source.novel, source.persistent, intl(handle).locale);
		let arcs = (library?.arcs ?? [])
			.map((arc) => ({ ...arc, chapters: titledChapters(arc.chapters) }))
			.filter((arc) => arc.chapters.length > 0);
		return (
			<div
				{...rest}
				data-novel-chapters=""
				aria-busy={library === undefined ? "true" : undefined}
				mix={[css({ display: "grid", gap: "1rem" }), mix]}
			>
				{library === undefined ? <p>{labels.loading}</p> : null}
				{arcs.map((group) => {
					let list = (
						<ol
							mix={css({
								margin: 0,
								padding: 0,
								listStyle: "none",
								display: "grid",
								gap: "0.5rem",
							})}
						>
							{group.chapters.map((chapter) => (
								<Entry
									key={chapter.name}
									title={chapter.title}
									name={chapter.name}
									reached={chapter.reached}
									lockedLabel={labels.locked}
									scene={chapter.scene}
									scope="chapter"
								/>
							))}
						</ol>
					);
					return group.arc === null ? (
						list
					) : (
						<ArcSection
							key={group.arc.name}
							arc={group.arc}
							reached={group.reached}
							lockedLabel={labels.locked}
						>
							{list}
						</ArcSection>
					);
				})}
			</div>
		);
	};
}

/** The chapters of a library group with a title and a mapped scene, each with its first scene. */
function titledChapters(
	chapters: readonly LibraryChapter[],
): { name: string; title: string; reached: boolean; scene: SceneDeclaration }[] {
	return chapters.flatMap((group) => {
		let first = group.scenes[0];
		let title = group.chapter?.title;
		return group.chapter === null || title === undefined || first === undefined
			? []
			: [{ name: group.chapter.name, title, reached: group.reached, scene: first.scene }];
	});
}

/**
 * Lists the titled scenes under their chapters, and those under their arcs; picking a reached one
 * dispatches `novel:replay` with it and the `"scene"` scope.
 *
 * @example <SceneReplay novel={novel} persistent={stored} mix={on("novel:replay", (event) => start(event.scene))} />
 */
export function SceneReplay(handle: Handle<SceneReplay.Props>) {
	let read = libraryReader(handle);
	let player = handle.context.get(NovelPlayer) as NovelPlayer.Context | undefined;
	return () => {
		let { novel: _novel, persistent: _persistent, labels: overrides, mix, ...rest } = handle.props;
		let source = librarySource(player, handle.props);
		if (source === undefined) return null;
		let labels = { ...DEFAULT_LABELS, ...player?.labels, ...overrides };
		let library = read(source.novel, source.persistent, intl(handle).locale);
		let arcs = (library?.arcs ?? [])
			.map((arc) => ({
				...arc,
				chapters: arc.chapters
					.map((group) => ({
						chapter: group.chapter,
						scenes: group.scenes.filter((entry) => entry.scene.title !== undefined),
					}))
					.filter((group) => group.scenes.length > 0),
			}))
			.filter((arc) => arc.chapters.length > 0);
		return (
			<div
				{...rest}
				data-novel-scenes=""
				aria-busy={library === undefined ? "true" : undefined}
				mix={[css({ display: "grid", gap: "1rem" }), mix]}
			>
				{library === undefined ? <p>{labels.loading}</p> : null}
				{arcs.map((arc) => {
					let sections = arc.chapters.map((group) => (
						<section key={group.chapter?.name ?? ""} mix={css({ display: "grid", gap: "0.5rem" })}>
							{group.chapter?.title === undefined ? null : (
								<LibraryHeading level={arc.arc === null ? 3 : 4}>
									<Message i18nKey={group.chapter.title} />
								</LibraryHeading>
							)}
							<ol
								mix={css({
									margin: 0,
									padding: 0,
									listStyle: "none",
									display: "grid",
									gap: "0.5rem",
								})}
							>
								{group.scenes.map((entry) => (
									<Entry
										key={entry.scene.name}
										title={entry.scene.title as string}
										name={entry.scene.name}
										reached={entry.reached}
										lockedLabel={labels.locked}
										scene={entry.scene}
										scope="scene"
									/>
								))}
							</ol>
						</section>
					));
					return arc.arc === null ? (
						sections
					) : (
						<ArcSection
							key={arc.arc.name}
							arc={arc.arc}
							reached={arc.reached}
							lockedLabel={labels.locked}
						>
							{sections}
						</ArcSection>
					);
				})}
			</div>
		);
	};
}

/**
 * Chapter select and scene replay: the novel's titled chapters and titled scenes in declaration
 * order, the ones the reader has reached offered to play again and the rest shown locked. Each
 * reports the scene to start from; the player starts it as a replay.
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

import type { NovelLabels } from "./settings.js";

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
		/**
		 * Called with the scene to start: a chapter's first mapped scene, or the scene picked.
		 * Inside a player it defaults to starting that scene as a replay.
		 */
		onSelect?: (scene: SceneDeclaration) => void;
		labels?: Partial<Pick<NovelLabels, "loading" | "locked">>;
	}
}

export namespace SceneReplay {
	/** Props {@link SceneReplay} accepts. */
	export type Props = ChapterSelect.Props;
}

/** Starts a picked scene as a replay of `scope` in the player, or does nothing outside one. */
function replayIn(
	player: NovelPlayer.Context | undefined,
	scope: ReplayScope,
): (scene: SceneDeclaration) => void {
	return (scene) => void player?.replay(scene, scope);
}

/** One row of a chapter or scene list: its title, and a button while it is reached. */
function Entry(
	handle: Handle<{
		title: string;
		name: string;
		reached: boolean;
		lockedLabel: string;
		onSelect: () => void;
	}>,
) {
	return () => {
		let { title, name, reached, lockedLabel, onSelect } = handle.props;
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
						on("click", onSelect),
					]}
				>
					{reached ? <Message i18nKey={title} /> : lockedLabel}
				</button>
			</li>
		);
	};
}

/**
 * Lists the titled chapters; picking a reached one reports its first mapped scene.
 *
 * @example <ChapterSelect novel={novel} persistent={stored} onSelect={(scene) => start({ scene, replay: "chapter" })} />
 */
export function ChapterSelect(handle: Handle<ChapterSelect.Props>) {
	let read = libraryReader(handle);
	let player = handle.context.get(NovelPlayer) as NovelPlayer.Context | undefined;
	return () => {
		let {
			novel: _novel,
			persistent: _persistent,
			onSelect = replayIn(player, "chapter"),
			labels: overrides,
			mix,
			...rest
		} = handle.props;
		let source = librarySource(player, handle.props);
		if (source === undefined) return null;
		let labels = { ...DEFAULT_LABELS, ...player?.labels, ...overrides };
		let library = read(source.novel, source.persistent, intl(handle).locale);
		let chapters = (library?.chapters ?? []).flatMap((group) => {
			let first = group.scenes[0];
			let title = group.chapter?.title;
			return group.chapter === null || title === undefined || first === undefined
				? []
				: [{ name: group.chapter.name, title, reached: group.reached, scene: first.scene }];
		});
		return (
			<div
				{...rest}
				data-novel-chapters=""
				aria-busy={library === undefined ? "true" : undefined}
				mix={mix}
			>
				{library === undefined ? <p>{labels.loading}</p> : null}
				<ol mix={css({ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.5rem" })}>
					{chapters.map((chapter) => (
						<Entry
							key={chapter.name}
							title={chapter.title}
							name={chapter.name}
							reached={chapter.reached}
							lockedLabel={labels.locked}
							onSelect={() => onSelect(chapter.scene)}
						/>
					))}
				</ol>
			</div>
		);
	};
}

/**
 * Lists the titled scenes under their chapters; picking a reached one reports it.
 *
 * @example <SceneReplay novel={novel} persistent={stored} onSelect={(scene) => start({ scene, replay: "scene" })} />
 */
export function SceneReplay(handle: Handle<SceneReplay.Props>) {
	let read = libraryReader(handle);
	let player = handle.context.get(NovelPlayer) as NovelPlayer.Context | undefined;
	return () => {
		let {
			novel: _novel,
			persistent: _persistent,
			onSelect = replayIn(player, "scene"),
			labels: overrides,
			mix,
			...rest
		} = handle.props;
		let source = librarySource(player, handle.props);
		if (source === undefined) return null;
		let labels = { ...DEFAULT_LABELS, ...player?.labels, ...overrides };
		let library = read(source.novel, source.persistent, intl(handle).locale);
		let groups = (library?.chapters ?? [])
			.map((group) => ({
				chapter: group.chapter,
				scenes: group.scenes.filter((entry) => entry.scene.title !== undefined),
			}))
			.filter((group) => group.scenes.length > 0);
		return (
			<div
				{...rest}
				data-novel-scenes=""
				aria-busy={library === undefined ? "true" : undefined}
				mix={[css({ display: "grid", gap: "1rem" }), mix]}
			>
				{library === undefined ? <p>{labels.loading}</p> : null}
				{groups.map((group) => (
					<section key={group.chapter?.name ?? ""} mix={css({ display: "grid", gap: "0.5rem" })}>
						{group.chapter?.title === undefined ? null : (
							<h3 mix={css({ margin: 0 })}>
								<Message i18nKey={group.chapter.title} />
							</h3>
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
									onSelect={() => onSelect(entry.scene)}
								/>
							))}
						</ol>
					</section>
				))}
			</div>
		);
	};
}

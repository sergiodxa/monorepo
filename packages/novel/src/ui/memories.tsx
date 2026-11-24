/**
 * Memories: every scene the reader has reached, grouped by chapter and arc, with the lines read
 * in it in the order the scene declares them, each shown with the values it was read with, its
 * speakers, and its voice to play again as a `novel:replay-voice` event. Lines never read stay
 * hidden, so the screen spoils nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { intl } from "@sdxc/i18n/ui";
import { Volume2Icon } from "@sdxc/icons";
import { Button } from "@sdxc/ui";
import { css, on, ref } from "remix/component";

import type { Novel } from "../novel.js";

import type { MemoryLine } from "./library.js";
import type { NovelLabels } from "./settings.js";

import { ArcSection, LibraryHeading } from "./arc-section.js";
import { AudioMixer } from "./audio.js";
import { NovelReplayVoiceEvent } from "./events.js";
import { libraryReader, librarySource } from "./library.js";
import { Message } from "./message.js";
import { NovelPlayer } from "./player.js";
import { DEFAULT_LABELS, DEFAULT_SETTINGS } from "./settings.js";

export namespace Memories {
	/** Props {@link Memories} accepts. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** The novel; inside a player it defaults to the player's. */
		novel?: Novel;
		/**
		 * The stored `Persistent` value; inside a player it defaults to the play's. Keep one value
		 * while the screen shows, since a new value reads the library again.
		 */
		persistent?: unknown;
		labels?: Partial<Pick<NovelLabels, "loading" | "locked" | "noMemories" | "replayVoice">>;
	}
}

/**
 * Lists what the reader has read, scene by scene, opening scrolled to the newest line. Lazily
 * mapped scenes load as the screen opens, and it says so until they have.
 *
 * @example <Memories novel={novel} persistent={stored} mix={on("novel:replay-voice", (event) => play(event.line.voice))} />
 */
export function Memories(handle: Handle<Memories.Props>) {
	let read = libraryReader(handle);
	let player = handle.context.get(NovelPlayer) as NovelPlayer.Context | undefined;

	let own: AudioMixer | undefined;
	let root: HTMLElement | undefined;
	let scrolledToNewest = false;

	handle.signal.addEventListener("abort", () => own?.dispose());

	/** The player's mixer, or outside one the screen's own, made on first use. */
	function mixer(): AudioMixer {
		if (player !== undefined) return player.mixer;
		own ??= new AudioMixer(DEFAULT_SETTINGS.volume);
		return own;
	}

	/**
	 * Reports a voice replay from `button`, then plays it through {@link mixer} unless a listener
	 * prevented it.
	 */
	function replayVoice(button: EventTarget, line: MemoryLine): void {
		let proceed = button.dispatchEvent(new NovelReplayVoiceEvent(line));
		if (!proceed || line.voice === null) return;
		let target = mixer();
		void target.resume();
		void target.playVoice(line.voice);
	}

	/**
	 * Scrolls the nearest scrolling box around the screen, such as its dialog's body, to the end,
	 * where the newest lines are; a screen that fits its box scrolls nothing.
	 */
	function scrollToNewest(): void {
		for (let node = root?.parentElement; node; node = node.parentElement) {
			let overflow = getComputedStyle(node).overflowY;
			if (overflow !== "auto" && overflow !== "scroll") continue;
			if (node.scrollHeight <= node.clientHeight) continue;
			node.scrollTop = node.scrollHeight;
			return;
		}
	}

	return () => {
		let { novel: _novel, persistent: _persistent, labels: overrides, mix, ...rest } = handle.props;
		let source = librarySource(player, handle.props);
		if (source === undefined) return null;
		let labels = { ...DEFAULT_LABELS, ...player?.labels, ...overrides };
		let library = read(source.novel, source.persistent, intl(handle).locale);
		if (library !== undefined && !scrolledToNewest) {
			scrolledToNewest = true;
			handle.queueTask(scrollToNewest);
		}
		let arcs = (library?.arcs ?? [])
			.map((arc) => ({
				...arc,
				chapters: arc.chapters
					.map((group) => ({
						...group,
						scenes: group.scenes.filter((entry) => entry.lines.length > 0),
					}))
					.filter((group) => group.scenes.length > 0),
			}))
			.filter((arc) => arc.chapters.length > 0);
		return (
			<div
				{...rest}
				data-novel-memories=""
				aria-busy={library === undefined ? "true" : undefined}
				mix={[
					css({ display: "grid", gap: "1.25rem" }),
					ref((node) => {
						root = node;
					}),
					mix,
				]}
			>
				{library === undefined ? <p>{labels.loading}</p> : null}
				{library !== undefined && arcs.length === 0 ? <p>{labels.noMemories}</p> : null}
				{arcs.map((arc) => {
					let depth = arc.arc === null ? 0 : 1;
					let sections = arc.chapters.map((group) => (
						<section
							key={group.chapter?.name ?? ""}
							data-chapter={group.chapter?.name}
							mix={css({ display: "grid", gap: "0.75rem" })}
						>
							{group.chapter?.title === undefined ? null : (
								<LibraryHeading level={depth === 0 ? 3 : 4}>
									<Message i18nKey={group.chapter.title} />
								</LibraryHeading>
							)}
							{group.scenes.map((entry) => (
								<section
									key={entry.scene.name}
									data-scene={entry.scene.name}
									mix={css({ display: "grid", gap: "0.5rem" })}
								>
									{entry.scene.title === undefined ? null : (
										<LibraryHeading level={depth === 0 ? 4 : 5} faded>
											<Message i18nKey={entry.scene.title} />
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
										{entry.lines.map((line) => (
											<li
												key={line.key}
												data-key={line.key}
												mix={css({ display: "flex", gap: "0.75rem", alignItems: "start" })}
											>
												<div mix={css({ flex: 1 })}>
													{line.speakers.length === 0 ? null : (
														<strong mix={css({ display: "block" })}>
															{line.speakers.map((speaker, index) => (
																<span key={speaker.id} style={{ color: speaker.color }}>
																	{index > 0 ? " & " : null}
																	<Message i18nKey={speaker.name} />
																</span>
															))}
														</strong>
													)}
													<Message i18nKey={line.key} values={line.values} />
												</div>
												{line.voice === null ? null : (
													<Button
														size="sm"
														variant="ghost"
														aria-label={labels.replayVoice}
														mix={on("click", (event) => replayVoice(event.currentTarget, line))}
													>
														<Volume2Icon size={16} />
													</Button>
												)}
											</li>
										))}
									</ol>
								</section>
							))}
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

/**
 * Memories: every scene the reader has reached, grouped by chapter, with the lines read in it in
 * the order the scene declares them, each shown with the values it was read with, its speakers,
 * and its voice to play again as a `novel:replay-voice` event. Lines never read stay hidden, so
 * the screen spoils nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { intl } from "@sdxc/i18n/ui";
import { Volume2Icon } from "@sdxc/icons";
import { Button } from "@sdxc/ui";
import { css, on } from "remix/component";

import type { Novel } from "../novel.js";

import type { MemoryLine } from "./library.js";
import type { NovelLabels } from "./settings.js";

import { NovelReplayVoiceEvent } from "./events.js";
import { libraryReader, librarySource } from "./library.js";
import { Message } from "./message.js";
import { NovelPlayer } from "./player.js";
import { DEFAULT_LABELS } from "./settings.js";

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
		/**
		 * Whether a voiced line offers its voice again, which dispatches `novel:replay-voice`.
		 * Inside a player the mixer plays it unless a listener prevents that; outside one, set
		 * it and play the voice from the listener.
		 *
		 * @default true inside a player, false elsewhere
		 */
		voices?: boolean;
		labels?: Partial<Pick<NovelLabels, "loading" | "noMemories" | "replayVoice">>;
	}
}

/**
 * Lists what the reader has read, scene by scene. Lazily mapped scenes load as the screen
 * opens, and it says so until they have.
 *
 * @example <Memories novel={novel} persistent={stored} voices mix={on("novel:replay-voice", (event) => play(event.line.voice))} />
 */
export function Memories(handle: Handle<Memories.Props>) {
	let read = libraryReader(handle);
	let player = handle.context.get(NovelPlayer) as NovelPlayer.Context | undefined;

	/** Reports a voice replay from `button`, then plays it through the player's mixer unless prevented. */
	function replayVoice(button: EventTarget, line: MemoryLine): void {
		let proceed = button.dispatchEvent(new NovelReplayVoiceEvent(line));
		if (!proceed || line.voice === null || player === undefined) return;
		void player.mixer.resume();
		void player.mixer.playVoice(line.voice);
	}

	return () => {
		let {
			novel: _novel,
			persistent: _persistent,
			voices = player !== undefined,
			labels: overrides,
			mix,
			...rest
		} = handle.props;
		let source = librarySource(player, handle.props);
		if (source === undefined) return null;
		let labels = { ...DEFAULT_LABELS, ...player?.labels, ...overrides };
		let library = read(source.novel, source.persistent, intl(handle).locale);
		let chapters = (library?.chapters ?? [])
			.map((group) => ({
				...group,
				scenes: group.scenes.filter((entry) => entry.lines.length > 0),
			}))
			.filter((group) => group.scenes.length > 0);
		return (
			<div
				{...rest}
				data-novel-memories=""
				aria-busy={library === undefined ? "true" : undefined}
				mix={[css({ display: "grid", gap: "1.25rem" }), mix]}
			>
				{library === undefined ? <p>{labels.loading}</p> : null}
				{library !== undefined && chapters.length === 0 ? <p>{labels.noMemories}</p> : null}
				{chapters.map((group) => (
					<section
						key={group.chapter?.name ?? ""}
						data-chapter={group.chapter?.name}
						mix={css({ display: "grid", gap: "0.75rem" })}
					>
						{group.chapter?.title === undefined ? null : (
							<h3 mix={css({ margin: 0 })}>
								<Message i18nKey={group.chapter.title} />
							</h3>
						)}
						{group.scenes.map((entry) => (
							<section
								key={entry.scene.name}
								data-scene={entry.scene.name}
								mix={css({ display: "grid", gap: "0.5rem" })}
							>
								{entry.scene.title === undefined ? null : (
									<h4 mix={css({ margin: 0, opacity: 0.8 })}>
										<Message i18nKey={entry.scene.title} />
									</h4>
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
											{line.voice === null || !voices ? null : (
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
				))}
			</div>
		);
	};
}

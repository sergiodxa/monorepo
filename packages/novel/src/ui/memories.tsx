/**
 * Memories: every scene the reader has reached, grouped by chapter, with the lines read in it in
 * the order the scene declares them, each shown with the values it was read with, its speakers,
 * and its voice to play again. Lines never read stay hidden, so the screen spoils nothing.
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

import { libraryReader } from "./library.js";
import { Message } from "./message.js";
import { DEFAULT_LABELS } from "./settings.js";

export namespace Memories {
	/** Props {@link Memories} accepts. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		novel: Novel;
		/** The stored `Persistent` value, or a play's `persistent`; keep one value while it shows. */
		persistent: unknown;
		/** Plays a line's voice again; without it no line offers its voice. */
		onReplayVoice?: (line: MemoryLine) => void;
		labels?: Partial<Pick<NovelLabels, "loading" | "noMemories" | "replayVoice">>;
	}
}

/**
 * Lists what the reader has read, scene by scene. Lazily mapped scenes load as the screen
 * opens, and it says so until they have.
 *
 * @example <Memories novel={novel} persistent={stored} onReplayVoice={(line) => mixer.playVoice(line.voice!)} />
 */
export function Memories(handle: Handle<Memories.Props>) {
	let read = libraryReader(handle);
	return () => {
		let { novel, persistent, onReplayVoice, labels: overrides, mix, ...rest } = handle.props;
		let labels = { ...DEFAULT_LABELS, ...overrides };
		let library = read(novel, persistent, intl(handle).locale);
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
											{line.voice === null || onReplayVoice === undefined ? null : (
												<Button
													size="sm"
													variant="ghost"
													aria-label={labels.replayVoice}
													mix={on("click", () => onReplayVoice(line))}
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

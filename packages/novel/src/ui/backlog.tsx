/**
 * The backlog: the recent lines in the order they were read, each with its speakers and a
 * button that plays its voice again. It is a native modal `<dialog>`, opened by the player's
 * key, button or swipe, and scrolled to the newest line when it opens.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { Volume2Icon } from "@sdxc/icons";
import { Button, Dialog } from "@sdxc/ui";
import { css, on, ref } from "remix/component";

import type { Speaker } from "../frames.js";

import { Message } from "./message.js";

/** A line as the backlog keeps it, with the values it was shown with. */
export interface BacklogEntry {
	/** The frame id the line was shown on. */
	id: string;
	scene: string;
	key: string;
	values: Record<string, unknown> | undefined;
	speakers: Speaker[];
	/** The voice file, resolved for the reader's locale, or `null` for an unvoiced line. */
	voice: string | null;
}

export namespace Backlog {
	/** Props {@link Backlog} accepts. */
	export interface Props {
		/** The dialog's id, which a `commandfor` button opens it by. */
		id: string;
		entries: BacklogEntry[];
		onReplayVoice?: (entry: BacklogEntry) => void;
		labels: { backlog: string; close: string; replayVoice: string };
	}
}

/**
 * Lists the recent lines, oldest first.
 *
 * @example <Backlog id="backlog" entries={entries} labels={labels} onReplayVoice={(entry) => mixer.playVoice(entry.voice)} />
 */
export function Backlog(handle: Handle<Backlog.Props>) {
	let list: HTMLElement | undefined;
	return () => {
		let { id, entries, onReplayVoice, labels } = handle.props;
		return (
			<Dialog
				id={id}
				aria-labelledby={`${id}-title`}
				data-novel-backlog=""
				mix={[
					css({ inlineSize: "min(48rem, 92vw)" }),
					on("toggle", () => {
						if (list !== undefined) list.scrollTop = list.scrollHeight;
					}),
				]}
			>
				<Dialog.Header>
					<Dialog.Title id={`${id}-title`}>{labels.backlog}</Dialog.Title>
				</Dialog.Header>
				<ol
					mix={[
						ref((node) => {
							list = node;
						}),
						css({
							margin: 0,
							padding: 0,
							listStyle: "none",
							display: "grid",
							gap: "0.75rem",
							maxBlockSize: "60vh",
							overflowY: "auto",
						}),
					]}
				>
					{entries.map((entry) => (
						<li
							key={entry.id}
							data-key={entry.key}
							mix={css({ display: "flex", gap: "0.75rem", alignItems: "start" })}
						>
							<div mix={css({ flex: 1 })}>
								{entry.speakers.length === 0 ? null : (
									<strong mix={css({ display: "block" })}>
										{entry.speakers.map((speaker, index) => (
											<span key={speaker.id} style={{ color: speaker.color }}>
												{index > 0 ? " & " : null}
												<Message i18nKey={speaker.name} />
											</span>
										))}
									</strong>
								)}
								<Message i18nKey={entry.key} values={entry.values} />
							</div>
							{entry.voice === null || onReplayVoice === undefined ? null : (
								<Button
									size="sm"
									variant="ghost"
									aria-label={labels.replayVoice}
									mix={on("click", () => onReplayVoice(entry))}
								>
									<Volume2Icon size={16} />
								</Button>
							)}
						</li>
					))}
				</ol>
				<Dialog.Close commandfor={id} aria-label={labels.close} />
			</Dialog>
		);
	};
}

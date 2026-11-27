/**
 * The backlog: the recent lines in the order they were read, each with its speakers and a
 * button that plays its voice again. It is a native modal `<dialog>`, opened by the player's
 * key, button or swipe, and scrolled to the newest line when it opens. Its entries come from
 * the player's `backlog` model.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { Volume2Icon } from "@sdxc/icons";
import { Button, Dialog } from "@sdxc/ui";
import { css, on, ref } from "remix/component";

import { Message } from "./message.js";
import { NovelPlayer } from "./player.js";
import { listenerSignal } from "./signal.js";
import { dialogSurface, dialogTitle, themeVar } from "./theme.js";

export namespace Backlog {
	/** Props {@link Backlog} accepts. */
	export interface Props extends Omit<Dialog.Props, "id" | "children"> {}
}

/**
 * Lists the player's backlog, oldest first, in a modal dialog the quick menu, the `l` key or a
 * downward swipe opens; a voiced line offers its voice again through the player's mixer, and a
 * line read in an earlier playthrough carries `data-novel-read` and takes `--novel-read-color`.
 *
 * @example <NovelPlayer.Backlog mix={css({ "--novel-dialog-background": "#111" })} />
 */
export function Backlog(handle: Handle<Backlog.Props>) {
	let player = handle.context.get(NovelPlayer);
	let list: HTMLElement | undefined;
	player.read.addEventListener("change", () => void handle.update(), {
		signal: listenerSignal(handle),
	});
	return () => {
		let { mix, ...rest } = handle.props;
		let { labels } = player;
		let id = player.ids.backlog;
		return (
			<Dialog
				{...rest}
				id={id}
				aria-labelledby={`${id}-title`}
				data-novel-backlog=""
				data-novel-theme-surface="dialog"
				style={dialogSurface()}
				mix={[
					css({
						inlineSize: "min(48rem, 92vw)",
						cursor: "auto",
						userSelect: "text",
					}),
					on("toggle", () => {
						if (list !== undefined) list.scrollTop = list.scrollHeight;
					}),
					mix,
				]}
			>
				<Dialog.Header>
					<Dialog.Title id={`${id}-title`} style={dialogTitle()}>
						{labels.backlog}
					</Dialog.Title>
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
					{player.backlog.entries.map((entry) => (
						<li
							key={entry.id}
							data-key={entry.key}
							data-novel-read={player.read.isRead(entry.id) ? "" : undefined}
							mix={css({
								display: "flex",
								gap: "0.75rem",
								alignItems: "start",
								"&[data-novel-read]": { color: themeVar("--novel-read-color") },
							})}
						>
							<div mix={css({ flex: 1 })}>
								{entry.speakers.length === 0 ? null : (
									<strong mix={css({ display: "block" })}>
										{entry.speakers.map((speaker, index) => (
											<span key={speaker.id} style={{ color: speaker.color }}>
												{index > 0 ? " & " : null}
												{speaker.introduced ? (
													<Message i18nKey={speaker.name} />
												) : (
													labels.unknownName
												)}
											</span>
										))}
									</strong>
								)}
								<Message i18nKey={entry.key} values={entry.values} />
							</div>
							{entry.voice === null ? null : (
								<Button
									size="sm"
									variant="ghost"
									aria-label={labels.replayVoice}
									mix={on("click", () => {
										if (entry.voice === null) return;
										void player.mixer.resume();
										void player.mixer.playVoice(entry.voice);
									})}
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

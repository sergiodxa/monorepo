/**
 * Save and load slots: one button per slot showing a miniature of the saved stage, drawn by the
 * same stage component as the play, with the scene's title and when it was saved. Storage is
 * the app's: the screens read the player's `saves` model, and a save leaves as `novel:save`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { Dialog } from "@sdxc/ui";
import { css, on } from "remix/component";

import type { GameState } from "../frames.js";

import type { NovelLabels } from "./settings.js";

import { QUICK_SLOT, SaveSlots } from "./behaviors/save-slots.js";
import { stillStage } from "./layout.js";
import { Message } from "./message.js";
import { NovelPlayer } from "./player.js";
import { listenerSignal } from "./signal.js";
import { Stage } from "./stage.js";
import { dialogSurface } from "./theme.js";

export namespace SaveScreen {
	/** Props {@link SaveScreen} accepts. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/**
		 * How many numbered slots the screens show, beside the quick slot.
		 *
		 * @default 6
		 */
		slots?: number;
	}

	/** Props {@link SlotThumbnail} accepts. */
	export interface ThumbnailProps {
		state: GameState;
		locale: string;
	}

	/** Props {@link SaveSummary} accepts. */
	export interface SummaryProps {
		state: GameState;
		/** The locale the date is formatted in. */
		locale: string;
	}
}

/** Props of one of the two slot dialogs. */
interface SlotDialogProps {
	mode: "save" | "load";
	slots: string[];
}

/**
 * The save and load screens: two modal dialogs over the player's `saves` model, opened by the
 * quick menu or the `s` and `o` keys. Saving writes the current play into the slot picked;
 * loading resumes a filled one. The autosave slot comes first and is load-only.
 *
 * @example <NovelPlayer.Saves slots={3} />
 */
export function SaveScreen(handle: Handle<SaveScreen.Props>) {
	let player = handle.context.get(NovelPlayer);
	return () => {
		let { slots = 6, mix, ...rest } = handle.props;
		let names = SaveSlots.names(slots);
		if (!names.includes(player.autosave.slot)) names.unshift(player.autosave.slot);
		return (
			<div {...rest} data-novel-save-screens="" mix={[css({ display: "contents" }), mix]}>
				<SlotDialog mode="save" slots={names} />
				<SlotDialog mode="load" slots={names} />
			</div>
		);
	};
}

/**
 * One of the slot dialogs, listing every slot with its thumbnail, scene and time. An empty slot
 * is disabled when loading, and the autosave slot when saving, since only autosave writes it.
 */
function SlotDialog(handle: Handle<SlotDialogProps>) {
	let player = handle.context.get(NovelPlayer);
	player.saves.addEventListener("change", () => void handle.update(), {
		signal: listenerSignal(handle),
	});
	return () => {
		let { mode, slots } = handle.props;
		let { labels, locale } = player;
		let id = mode === "save" ? player.ids.save : player.ids.load;
		return (
			<Dialog
				id={id}
				aria-labelledby={`${id}-title`}
				data-novel-saves={mode}
				style={dialogSurface()}
				mix={css({ inlineSize: "min(56rem, 94vw)", fontSize: "1rem", cursor: "auto" })}
			>
				<Dialog.Header>
					<Dialog.Title id={`${id}-title`}>
						{mode === "save" ? labels.save : labels.load}
					</Dialog.Title>
				</Dialog.Header>
				<ul
					mix={css({
						margin: 0,
						padding: 0,
						listStyle: "none",
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(12rem, 1fr))",
						gap: "1rem",
					})}
				>
					{slots.map((slot) => {
						let saved = player.saves.get(slot);
						return (
							<li key={slot}>
								<button
									type="button"
									data-slot-name={slot}
									data-autosave={slot === player.autosave.slot ? "" : undefined}
									disabled={mode === "load" ? saved === undefined : slot === player.autosave.slot}
									commandfor={id}
									command="close"
									mix={[
										css({
											display: "grid",
											gap: "0.4rem",
											inlineSize: "100%",
											padding: "0.5rem",
											border: "1px solid var(--ui-border, rgb(127 127 127 / 0.4))",
											borderRadius: "0.5rem",
											background: "transparent",
											color: "inherit",
											font: "inherit",
											textAlign: "start",
											cursor: "pointer",
											"&:disabled": { opacity: 0.5, cursor: "not-allowed" },
										}),
										on("click", () => {
											if (mode === "save") player.save(slot);
											else void player.load(slot);
										}),
									]}
								>
									<span
										mix={css({
											display: "block",
											aspectRatio: "16 / 9",
											background: "#000",
											borderRadius: "0.25rem",
											overflow: "hidden",
										})}
									>
										{saved === undefined ? null : <SlotThumbnail state={saved} locale={locale} />}
									</span>
									<strong>{slotName(slot, player.autosave.slot, labels)}</strong>
									{saved === undefined ? (
										<span>{labels.emptySlot}</span>
									) : (
										<SaveSummary state={saved} locale={locale} />
									)}
								</button>
							</li>
						);
					})}
				</ul>
				<Dialog.Close commandfor={id} aria-label={labels.close} />
			</Dialog>
		);
	};
}

/** The name a slot shows: the autosave and quick slots by label, the rest numbered. */
function slotName(slot: string, autosave: string, labels: NovelLabels): string {
	if (slot === autosave) return labels.autosave;
	if (slot === QUICK_SLOT) return labels.quickSave;
	return `${labels.slot} ${slot}`;
}

/**
 * What a save holds, as every screen that offers one shows it: the scene's title, then when it was
 * saved in the reader's locale, in `data-novel-save-scene` and `data-novel-save-time` for styling.
 *
 * @example <SaveSummary state={saves["1"]} locale="en" />
 */
export function SaveSummary(handle: Handle<SaveScreen.SummaryProps>) {
	return () => {
		let { state, locale } = handle.props;
		let date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
		return (
			<span data-novel-save-summary="">
				<span data-novel-save-scene="">
					<Message i18nKey={state.meta.scene} />
				</span>
				{" · "}
				<time data-novel-save-time="" dateTime={state.meta.savedAt}>
					{date.format(new Date(state.meta.savedAt))}
				</time>
			</span>
		);
	};
}

/**
 * A miniature of a saved stage, scaled to whatever box holds it.
 *
 * @example <SlotThumbnail state={saves["1"]} locale="en" />
 */
export function SlotThumbnail(handle: Handle<SaveScreen.ThumbnailProps>) {
	return () => (
		<Stage
			stage={stillStage(handle.props.state.stage)}
			locale={handle.props.locale}
			focus={false}
			transitions={false}
			instant
			aria-hidden="true"
		/>
	);
}

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

import { QUICK_SLOT, SaveSlots } from "./behaviors/save-slots.js";
import { stillStage } from "./layout.js";
import { Message } from "./message.js";
import { NovelPlayer } from "./player.js";
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
}

/** Props of one of the two slot dialogs. */
interface SlotDialogProps {
	mode: "save" | "load";
	slots: string[];
}

/**
 * The save and load screens: two modal dialogs over the player's `saves` model, opened by the
 * quick menu or the `s` and `o` keys. Saving writes the current play into the slot picked;
 * loading resumes a filled one, and an empty slot is disabled there.
 *
 * @example <NovelPlayer.Saves slots={3} />
 */
export function SaveScreen(handle: Handle<SaveScreen.Props>) {
	return () => {
		let { slots = 6, mix, ...rest } = handle.props;
		let names = SaveSlots.names(slots);
		return (
			<div {...rest} data-novel-save-screens="" mix={[css({ display: "contents" }), mix]}>
				<SlotDialog mode="save" slots={names} />
				<SlotDialog mode="load" slots={names} />
			</div>
		);
	};
}

/** One of the slot dialogs, listing every slot with its thumbnail, scene and time. */
function SlotDialog(handle: Handle<SlotDialogProps>) {
	let player = handle.context.get(NovelPlayer);
	player.saves.addEventListener("change", () => void handle.update(), { signal: handle.signal });
	return () => {
		let { mode, slots } = handle.props;
		let { labels, locale } = player;
		let id = mode === "save" ? player.ids.save : player.ids.load;
		let date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
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
									disabled={mode === "load" && saved === undefined}
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
									<strong>
										{slot === QUICK_SLOT ? labels.quickSave : `${labels.slot} ${slot}`}
									</strong>
									{saved === undefined ? (
										<span>{labels.emptySlot}</span>
									) : (
										<span>
											<Message i18nKey={saved.meta.scene} />
											{" · "}
											<time dateTime={saved.meta.savedAt}>
												{date.format(new Date(saved.meta.savedAt))}
											</time>
										</span>
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

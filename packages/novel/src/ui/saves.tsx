/**
 * Save and load slots: one button per slot showing a miniature of the saved stage, drawn by the
 * same stage component as the play, with the scene's title and when it was saved. Storage is
 * the app's; this screen only reports the slot the reader picked.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { Dialog } from "@sdxc/ui";
import { css, on } from "remix/component";

import type { GameState } from "../frames.js";

import { stillStage } from "./layout.js";
import { Message } from "./message.js";
import { Stage } from "./stage.js";

/** The slot quick save writes and quick load reads. */
export const QUICK_SLOT = "quick";

export namespace SaveScreen {
	/** Props {@link SaveScreen} accepts. */
	export interface Props {
		/** The dialog's id, which a `commandfor` button opens it by. */
		id: string;
		/** Saving writes the current play into a slot; loading resumes a filled one. */
		mode: "save" | "load";
		/** The slot names, in the order they are shown; {@link QUICK_SLOT} is labeled as the quick save. */
		slots: string[];
		/** What each slot holds. */
		saves: Readonly<Record<string, GameState | undefined>>;
		locale: string;
		onSelect: (slot: string) => void;
		labels: {
			save: string;
			load: string;
			close: string;
			slot: string;
			emptySlot: string;
			quickSave: string;
		};
	}

	/** Props {@link SlotThumbnail} accepts. */
	export interface ThumbnailProps {
		state: GameState;
		locale: string;
	}
}

/**
 * Lists the slots; in load mode an empty slot is disabled.
 *
 * @example <SaveScreen id="saves" mode="save" slots={["1", "2"]} saves={saves} locale="en" onSelect={save} labels={labels} />
 */
export function SaveScreen(handle: Handle<SaveScreen.Props>) {
	return () => {
		let { id, mode, slots, saves, locale, onSelect, labels } = handle.props;
		let date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
		return (
			<Dialog
				id={id}
				aria-labelledby={`${id}-title`}
				data-novel-saves={mode}
				mix={css({ inlineSize: "min(56rem, 94vw)" })}
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
						let saved = saves[slot];
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
										on("click", () => onSelect(slot)),
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

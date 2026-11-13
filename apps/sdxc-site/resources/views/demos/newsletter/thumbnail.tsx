/**
 * Undercurrent's gallery miniature: a sheet of the letter, its title and ruled lines of
 * text, with the episode player's progress line under it, so the card shows a quiet page
 * that is read and heard.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";

import { UndercurrentMark } from "~/resources/views/demos/newsletter/logo";

/** How far each ruled line of the letter runs, as a share of the column. */
const LINES = [100, 92, 64];

/** Renders the letter sheet centred on the card, one column wide. */
export default function NewsletterThumbnail() {
	return () => (
		<div
			mix={[
				raw({
					position: "absolute",
					insetBlock: "1rem -1rem",
					insetInline: "18%",
					display: "flex",
					flexDirection: "column",
					gap: "0.5rem",
					padding: "1rem 1.25rem",
					backgroundColor: "var(--ui-bg)",
					boxShadow: "0 0 0 1px var(--ui-neutral-border)",
					borderRadius: "4px 4px 0 0",
				}),
			]}
		>
			<span
				mix={[
					raw({
						display: "flex",
						alignItems: "center",
						gap: "0.375rem",
						fontWeight: "600",
						color: "var(--ui-neutral-fg-emphasis)",
					}),
				]}
			>
				<UndercurrentMark />
				Undercurrent
			</span>
			<span
				mix={[
					raw({
						fontSize: "1.0625rem",
						lineHeight: "1.2",
						fontWeight: "500",
						color: "var(--ui-neutral-fg-emphasis)",
					}),
				]}
			>
				Letters from under the street
			</span>
			{LINES.map((width, index) => (
				<span
					key={index}
					mix={[
						raw({
							blockSize: "2px",
							inlineSize: `${width}%`,
							backgroundColor: "var(--ui-neutral-fg-muted)",
							opacity: "0.35",
						}),
					]}
				/>
			))}
			<span
				mix={[
					raw({
						display: "flex",
						alignItems: "center",
						gap: "0.5rem",
					}),
				]}
			>
				<span
					mix={[
						raw({
							inlineSize: "0",
							blockSize: "0",
							borderBlock: "5px solid transparent",
							borderInlineStart: "8px solid var(--ui-color-brand-600)",
						}),
					]}
				/>
				<span
					mix={[
						raw({
							flex: "1",
							blockSize: "2px",
							background:
								"linear-gradient(to right, var(--ui-color-brand-600) 35%, var(--ui-neutral-border-strong) 35%)",
						}),
					]}
				/>
			</span>
		</div>
	);
}

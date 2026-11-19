/**
 * Hangwell's gallery miniature: the header with the mark and a bag count, and three posters
 * on a gallery wall, one framed, so the card reads as a print shop before its name is read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";

import { FramedArt } from "./art";
import { findPoster } from "./data";
import { HangwellMark } from "./shell";

/** The posters the miniature hangs, with the frame each one gets. */
const HUNG = [
	{ id: "port-anselm", frame: "black" },
	{ id: "ninefold-sun", frame: "oak" },
	{ id: "fern-study", frame: "white" },
] as const;

/** Renders the miniature on its own gallery-white ground, whatever the gallery's scheme. */
export function HangwellThumbnail() {
	return () => (
		<div
			mix={[
				raw({
					position: "absolute",
					inset: "0",
					display: "grid",
					gridTemplateRows: "auto 1fr",
					gap: "6%",
					padding: "5% 6%",
					overflow: "clip",
					backgroundColor: "oklch(0.975 0.004 85)",
					color: "oklch(0.2 0.01 60)",
					fontFamily: "var(--ui-font-sans)",
				}),
			]}
		>
			<div
				mix={[
					raw({
						display: "flex",
						alignItems: "center",
						gap: "0.375rem",
						fontWeight: "600",
						fontSize: "0.875rem",
					}),
				]}
			>
				<HangwellMark size={18} />
				Hangwell
				<span mix={[raw({ flex: "1" })]} />
				<span
					mix={[
						raw({
							paddingInline: "0.5rem",
							paddingBlock: "0.125rem",
							borderRadius: "999px",
							fontSize: "0.625rem",
							fontWeight: "700",
							color: "white",
							backgroundColor: "oklch(0.58 0.19 32)",
						}),
					]}
				>
					Bag 2
				</span>
			</div>
			<div
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "1fr 1.3fr 1fr",
						alignItems: "center",
						gap: "7%",
						paddingInline: "4%",
						backgroundColor: "oklch(0.94 0.008 80)",
						borderRadius: "0.5rem",
						padding: "6% 8%",
					}),
				]}
			>
				{HUNG.map((entry) => (
					<FramedArt
						poster={findPoster(entry.id)!}
						frame={entry.frame}
						mount={entry.frame !== "black"}
					/>
				))}
			</div>
		</div>
	);
}

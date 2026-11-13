/**
 * The sources band: the pricing call's whole transcript as a ruled sheet, every line the
 * notes cite run over with the highlighter and annotated in the margin with what it became.
 * A timestamp anywhere on the page links here, and the line it names is marked as arrived.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { LandingHeader, LandingSection } from "@sdxc/ui/landing";

import { HandNote, Highlight } from "~/resources/views/demos/ai/marks";
import {
	lineId,
	MARGIN_NOTES,
	MEETING_FILE,
	MEETING_LENGTH,
	TRANSCRIPT,
} from "~/resources/views/demos/ai/meeting";
import { LINE, MONO, RULED_PAPER } from "~/resources/views/demos/ai/type";
import { renderNearView } from "~/resources/views/demos/near-view";

/** The container the transcript declares, which moves the margin notes beside the lines. */
const CONTAINER = "margin-transcript";

/** How many lines the notes cite, counted from the margin so the caption never drifts. */
const CITED_COUNT = Object.values(MARGIN_NOTES).filter((note) => note.pen === "ink").length;

/**
 * Renders the band. The transcript is an ordered list of real text, so it reads and
 * copies as the call it is; the margin column joins each row from a 44rem sheet.
 *
 * @returns The render function producing the band.
 */
export default function MarginSources() {
	return () => (
		<LandingSection id="sources" mix={[renderNearView(605, 1600)]}>
			<LandingHeader
				eyebrow="How it works"
				layout="split"
				description={
					<>
						Margin transcribes the call, then writes notes that each end in a timestamp. Follow one
						and you land on the line it came from, <strong>so a note is checked in a click</strong>,
						not trusted on faith.
					</>
				}
			>
				Every note points at a line
			</LandingHeader>
			<figure
				mix={[
					raw({
						margin: "0",
						container: `${CONTAINER} / inline-size`,
						backgroundColor: "var(--ui-surface-raised)",
						borderRadius: "var(--ui-landing-radius-surface)",
						boxShadow: "var(--ui-shadow-surface)",
						overflow: "clip",
					}),
				]}
			>
				<figcaption
					mix={[
						raw({
							display: "flex",
							flexWrap: "wrap",
							justifyContent: "space-between",
							gap: "0.25rem 1rem",
							paddingBlock: "0.75rem",
							paddingInline: "1.25rem",
							borderBlockEnd: "1px solid var(--ui-landing-hairline)",
							fontFamily: MONO,
							fontSize: "0.75rem",
							color: "var(--ui-neutral-fg-muted)",
						}),
					]}
				>
					<span>{MEETING_FILE} · transcript</span>
					<span>
						{TRANSCRIPT.length} lines · {MEETING_LENGTH} · {CITED_COUNT} cited
					</span>
				</figcaption>
				<ol
					mix={[
						raw({
							margin: "0",
							padding: `0 0 ${LINE}`,
							listStyle: "none",
							backgroundImage: RULED_PAPER,
							lineHeight: LINE,
							fontSize: "0.9375rem",
						}),
					]}
				>
					{TRANSCRIPT.map((line) => {
						let note = MARGIN_NOTES[line.time];
						let cited = note?.pen === "ink";
						return (
							<li
								id={lineId(line.time)}
								data-cited={cited ? "" : undefined}
								mix={[
									raw({
										display: "grid",
										gridTemplateColumns: "3.25rem minmax(0, 1fr)",
										columnGap: "0.75rem",
										paddingInline: "1.25rem",
										scrollMarginBlock: "35vh",
										[`@container ${CONTAINER} (min-width: 44rem)`]: {
											gridTemplateColumns: "3.25rem 4rem minmax(0, 1fr) 15rem",
										},
									}),
									when(
										"&:target",
										raw({
											backgroundColor: "color-mix(in oklch, var(--ui-brand-fg) 14%, transparent)",
											boxShadow: "inset 4px 0 0 var(--ui-brand-fg)",
										}),
									),
								]}
							>
								<span
									mix={[
										raw({
											fontFamily: MONO,
											fontSize: "0.75rem",
											fontVariantNumeric: "tabular-nums",
											color: "var(--ui-neutral-fg-muted)",
										}),
									]}
								>
									{line.time}
								</span>
								<span
									mix={[
										raw({
											fontWeight: "600",
											color: "var(--ui-neutral-fg-emphasis)",
											gridColumn: "2",
											[`@container ${CONTAINER} (min-width: 44rem)`]: { gridColumn: "auto" },
										}),
									]}
								>
									{line.speaker}
								</span>
								<span
									mix={[
										raw({
											gridColumn: "2",
											color: "var(--ui-neutral-fg-emphasis)",
											[`@container ${CONTAINER} (min-width: 44rem)`]: { gridColumn: "auto" },
										}),
									]}
								>
									{cited ? <Highlight>{line.text}</Highlight> : line.text}
								</span>
								{note === undefined ? null : (
									<span
										mix={[
											raw({
												gridColumn: "2",
												[`@container ${CONTAINER} (min-width: 44rem)`]: {
													gridColumn: "auto",
													paddingInlineStart: "0.75rem",
													borderInlineStart:
														"1px solid color-mix(in oklch, var(--margin-red-pen) 45%, transparent)",
												},
											}),
										]}
									>
										<HandNote pen={note.pen}>
											<span aria-hidden="true">→ </span>
											{note.text}
										</HandNote>
									</span>
								)}
							</li>
						);
					})}
				</ol>
			</figure>
		</LandingSection>
	);
}

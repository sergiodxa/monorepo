/**
 * The notes Margin wrote from the pricing call, drawn as a ruled notebook sheet: summary,
 * decisions, to-dos and the open question, each ending in the timestamp of its source.
 * Every line of type sits on a rule, and the margin carries the section names in the hand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";

import { Cite, HandNote, Highlight } from "~/resources/views/demos/ai/marks";
import {
	ACTION_ITEMS,
	DECISIONS,
	MEETING_LENGTH,
	MEETING_TITLE,
	OPEN_QUESTIONS,
	SUMMARY,
} from "~/resources/views/demos/ai/meeting";
import { LINE, MONO, RED_PEN, RULED_PAPER } from "~/resources/views/demos/ai/type";

/** Width of the margin the red line rules off, where the section names are written. */
const MARGIN = "5rem";

/** Width of the margin on a phone, where the section names stack above their lines. */
const PHONE_MARGIN = "1.25rem";

/**
 * Renders the sheet as a raised page. Its inner text is the product's output, so it stays
 * readable and its timestamps stay links into the transcript further down the page.
 *
 * @returns The render function producing the sheet.
 */
export default function NotesSheet() {
	return () => (
		<article
			aria-label={`Margin’s notes from “${MEETING_TITLE}”`}
			data-slot="margin-notes-sheet"
			mix={[
				raw({
					position: "relative",
					container: "margin-sheet / inline-size",
					backgroundColor: "var(--ui-surface-raised)",
					borderRadius: "var(--ui-landing-radius-surface)",
					boxShadow: "var(--ui-shadow-surface)",
					textAlign: "start",
				}),
			]}
		>
			<Tape />
			<div
				mix={[
					raw({
						"--sheet-margin": PHONE_MARGIN,
						paddingBlock: `${LINE} calc(${LINE} * 1.5)`,
						paddingInline: "calc(var(--sheet-margin) + 1rem) 1.25rem",
						backgroundImage: `linear-gradient(to right, transparent calc(var(--sheet-margin) - 1px), color-mix(in oklch, ${RED_PEN} 55%, transparent) calc(var(--sheet-margin) - 1px) var(--sheet-margin), transparent var(--sheet-margin)), ${RULED_PAPER}`,
						backgroundPosition: `0 0, 0 ${LINE}`,
						fontSize: "0.9375rem",
						lineHeight: LINE,
						color: "var(--ui-neutral-fg-emphasis)",
						"@container margin-sheet (min-width: 26rem)": { "--sheet-margin": MARGIN },
					}),
				]}
			>
				<header
					mix={[
						raw({
							display: "flex",
							flexWrap: "wrap",
							alignItems: "baseline",
							justifyContent: "space-between",
							columnGap: "1rem",
						}),
					]}
				>
					<p
						mix={[raw({ margin: "0", fontSize: "1.125rem", lineHeight: LINE, fontWeight: "600" })]}
					>
						{MEETING_TITLE}
					</p>
					<span
						mix={[
							raw({
								fontFamily: MONO,
								fontSize: "0.75rem",
								color: "var(--ui-neutral-fg-muted)",
								fontVariantNumeric: "tabular-nums",
							}),
						]}
					>
						Thu 12 Nov · {MEETING_LENGTH} · Ana, Tomás, Priya
					</span>
				</header>

				<SheetPart label="Summary">
					<p mix={[raw({ margin: "0" })]}>
						{SUMMARY.map((claim) => (
							<>
								<MarkedText text={claim.text} marked={HIGHLIGHTED} />
								<Cite time={claim.cites} />{" "}
							</>
						))}
					</p>
				</SheetPart>

				<SheetPart label="Decided">
					<ul mix={[listReset()]}>
						{DECISIONS.map((claim) => (
							<li>
								{claim.text}
								<Cite time={claim.cites} />
							</li>
						))}
					</ul>
				</SheetPart>

				<SheetPart label="To do">
					<ul mix={[listReset()]}>
						{ACTION_ITEMS.map((item) => (
							<li mix={[raw({ display: "flex", gap: "0.5rem" })]}>
								<Box />
								<span>
									<strong mix={[raw({ fontWeight: "600" })]}>{item.owner}</strong> · {item.text}
									{" · "}
									{item.due === null ? (
										<span mix={[raw({ color: RED_PEN, fontStyle: "italic" })]}>no date said</span>
									) : (
										<span mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>{item.due}</span>
									)}
									<Cite time={item.cites} />
								</span>
							</li>
						))}
					</ul>
				</SheetPart>

				<SheetPart label="Open">
					<ul mix={[listReset()]}>
						{OPEN_QUESTIONS.map((claim) => (
							<li>
								{claim.text}
								<Cite time={claim.cites} />
							</li>
						))}
					</ul>
				</SheetPart>
			</div>
		</article>
	);
}

namespace SheetPart {
	/** A section of the notes and the name written beside it. */
	export interface Props {
		label: string;
		children: RemixNode;
	}
}

/**
 * One section of the notes, named by its label: the sheet is a picture inside the hero, so
 * the page outline stays the page's own. On a wide sheet the label hangs in the margin left
 * of the red line; on a phone it sits on its own rule above the lines.
 *
 * @param handle Runtime handle carrying the label and lines.
 * @returns The render function producing the section.
 */
function SheetPart(handle: Handle<SheetPart.Props>) {
	return () => (
		<section
			aria-label={handle.props.label}
			mix={[raw({ position: "relative", marginBlockStart: LINE })]}
		>
			<p
				mix={[
					raw({
						margin: "0",
						fontWeight: "400",
						lineHeight: LINE,
						"@container margin-sheet (min-width: 26rem)": {
							position: "absolute",
							insetInlineEnd: "calc(100% + 1.5rem)",
							insetBlockStart: "0",
							inlineSize: "calc(var(--sheet-margin) - 0.5rem)",
							textAlign: "end",
						},
					}),
				]}
			>
				<HandNote>{handle.props.label}</HandNote>
			</p>
			{handle.props.children}
		</section>
	);
}

/** The phrase the hero's sheet runs the highlighter over: the call's headline decision. */
const HIGHLIGHTED = "two months free";

namespace MarkedText {
	/** A sentence and the phrase in it to highlight. */
	export interface Props {
		text: string;
		marked: string;
	}
}

/**
 * A sentence with one phrase highlighted, or the sentence as it is when the phrase is not
 * in it.
 *
 * @param handle Runtime handle carrying the sentence and phrase.
 * @returns The render function producing the text.
 */
function MarkedText(handle: Handle<MarkedText.Props>) {
	return () => {
		let { marked, text } = handle.props;
		let at = text.indexOf(marked);
		if (at === -1) return text;
		return (
			<>
				{text.slice(0, at)}
				<Highlight>{marked}</Highlight>
				{text.slice(at + marked.length)}
			</>
		);
	};
}

/** A list with no bullets or indent, so each item sits on its rule at the text edge. */
function listReset() {
	return raw({ margin: "0", padding: "0", listStyle: "none" });
}

/**
 * The hand-drawn checkbox before a to-do: an ink square a little off true, sized to sit
 * inside one rule.
 */
function Box() {
	return () => (
		<svg
			viewBox="0 0 16 16"
			width="14"
			height="14"
			aria-hidden="true"
			mix={[raw({ flexShrink: "0", marginBlockStart: "0.4375rem", color: "var(--ui-brand-fg)" })]}
		>
			<path
				d="M2.2 2.6 C6 2.1 10 2.3 13.6 2.2 C13.9 6 13.7 10 13.8 13.7 C10 13.9 6 13.6 2.4 13.9 C2.1 10 2.3 6 2.2 2.6 Z"
				fill="none"
				stroke="currentColor"
				stroke-width="1.4"
				stroke-linejoin="round"
			/>
		</svg>
	);
}

/** A strip of translucent tape holding the sheet to the page, the sheet's one flourish. */
function Tape() {
	return () => (
		<span
			aria-hidden="true"
			mix={[
				raw({
					position: "absolute",
					insetBlockStart: "-0.75rem",
					insetInlineStart: "50%",
					inlineSize: "6rem",
					blockSize: "1.5rem",
					translate: "-50% 0",
					rotate: "-2deg",
					backgroundColor: "color-mix(in oklch, var(--ui-color-neutral-200) 70%, transparent)",
					boxShadow: "0 1px 2px oklch(0.4 0.03 70 / 0.12)",
				}),
			]}
		/>
	);
}

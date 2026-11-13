/**
 * Eyebrow, chapter title, and lead copy that open a landing band. The title
 * uses display chapter typography; the lead stays on the landing lead measure
 * so the claim reads first and the support follows, at token-driven spacing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { raw, mergeMix } from "@sdxc/u/general";
import { container, self, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { m, mi } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { textAlign } from "@sdxc/u/typography";

import type { LandingEyebrowVariant } from "../styles/landing.js";

import { Heading } from "../components/heading.js";
import { landingLead } from "../styles/landing.js";
import { Eyebrow } from "../utils/eyebrow.js";

/** Content alignment {@link LandingHeader} applies when `align` is omitted. */
const DEFAULT_ALIGN: LandingHeader.Align = "start";

/** Eyebrow look {@link LandingHeader} applies when `eyebrowVariant` is omitted. */
const DEFAULT_EYEBROW_VARIANT: LandingHeader.EyebrowVariant = "mono";

/**
 * Space below the header, before the band's body: 2.5rem on a phone, 4rem wide. A host
 * that lays out its own gap sets `--ui-landing-header-end` on the header instead.
 */
const HEADER_SPACE =
	"var(--ui-landing-header-end, var(--ui-landing-header-space, clamp(2.5rem, 1.82rem + 2.91cqi, 4rem)))";

/** Container a split header's columns read; the header spans its band's measure. */
const CONTAINER = "ui-landing-header";

/** The muted title ink: the heading ink at 62%, which keeps 4.5:1 at display size. */
const MUTED_TITLE = "color-mix(in oklch, var(--ui-neutral-fg-emphasis) 62%, transparent)";

/**
 * Prop types for {@link LandingHeader}.
 */
export namespace LandingHeader {
	/**
	 * Whether the stack stretches start-aligned or centers as one statement.
	 */
	export type Align = "start" | "center";

	/**
	 * `stack` sets the eyebrow, title and lead in one column. `split` puts the lead
	 * beside the title from the band's `lg` width, aligned to the title's last line.
	 */
	export type Layout = "stack" | "split";

	/**
	 * `default` sets the whole title in the heading ink. `statement` sets it in the muted
	 * ink with its `<strong>` phrase in the heading ink, so it reads as a claim and support.
	 */
	export type Tone = "default" | "statement";

	/**
	 * How the optional eyebrow reads: a quiet mono label (the section default), a
	 * hairline `quiet` pill, a filled `soft` pill, the brand `pill`, or a
	 * brand-ringed `numbered` pill led by `eyebrowIndex`.
	 */
	export type EyebrowVariant = LandingEyebrowVariant;

	/**
	 * Per-part styling for the elements the header renders besides its host.
	 */
	export interface PartsProps {
		/** Styling for the optional eyebrow label. */
		eyebrow?: TagProps<"span">["mix"];
		/** Styling for the title {@link Heading}. */
		title?: TagProps<"h1">["mix"];
		/** Styling for the optional lead paragraph. */
		description?: TagProps<"p">["mix"];
	}

	/**
	 * Props accepted by {@link LandingHeader}.
	 */
	export interface Props extends TagProps<"header"> {
		/** Short label above the title. */
		eyebrow?: RemixNode;
		/**
		 * Eyebrow look. Defaults to {@link DEFAULT_EYEBROW_VARIANT} when an
		 * eyebrow is present.
		 */
		eyebrowVariant?: EyebrowVariant;
		/** Turns the eyebrow into a link with a trailing arrow that nudges on hover. */
		eyebrowHref?: string;
		/** Index a `numbered` eyebrow leads with, such as `"01"`. */
		eyebrowIndex?: RemixNode;
		/** Supporting copy under the title; `<strong>` fragments draw in the heading ink. */
		description?: RemixNode;
		/** Stack alignment. Defaults to {@link DEFAULT_ALIGN}; a split or an action aligns start. */
		align?: Align;
		/** Arrangement of title and lead. Defaults to `"stack"`. */
		layout?: Layout;
		/** Title ink. Defaults to `"default"`. */
		tone?: Tone;
		/**
		 * A second line at the title's size in the muted ink, inside the heading, so the
		 * two lines read as one two-tone heading.
		 */
		subtitle?: RemixNode;
		/**
		 * A control at the header row's inline end, such as a "See all" link, aligned to
		 * the title's last line; it wraps under the title when the row runs out of room.
		 */
		action?: RemixNode;
		/** Per-part styling for eyebrow, title, and description. */
		parts?: PartsProps;
		/** Title copy — rendered through {@link Heading} at chapter display size. */
		children: RemixNode;
	}
}

/**
 * Renders an optional eyebrow, a chapter-sized {@link Heading} from `children`,
 * and an optional lead paragraph. A mono eyebrow sits 0.5rem above the title and a
 * pill 1.5rem; the lead follows 1rem below; the band's body starts
 * `--ui-landing-header-space` after. The title renders at the enclosing band's
 * heading level: `<h2>` in a band on a bare page.
 *
 * @param handle Runtime handle carrying the host `<header>`'s props.
 * @returns The render function producing the header's markup.
 * @example
 * <LandingHeader eyebrow={t("badge")} description={t("lead")} align="center">
 * 	{t("title")}
 * </LandingHeader>
 * @example
 * <LandingHeader eyebrow={t("chapter")} eyebrowVariant="numbered" eyebrowIndex="02">
 * 	{t("title")}
 * </LandingHeader>
 */
export function LandingHeader(handle: Handle<LandingHeader.Props>) {
	return () => {
		let {
			align,
			children,
			description,
			eyebrow,
			eyebrowHref,
			eyebrowIndex,
			eyebrowVariant,
			action,
			layout,
			mix,
			parts,
			subtitle,
			tone,
			...rest
		} = handle.props;
		let isSplit = layout === "split";
		let resolvedAlign = isSplit || action ? "start" : (align ?? DEFAULT_ALIGN);
		let resolvedEyebrowVariant = eyebrowVariant ?? DEFAULT_EYEBROW_VARIANT;
		let isCenter = resolvedAlign === "center";

		let content = (
			<div
				data-slot="landing-header-content"
				mix={[
					vstack({ align: isCenter ? "center" : "stretch", gap: 0 }),
					isSplit ? splitGrid() : [],
					action ? raw({ flex: "1 1 20rem", minInlineSize: "0" }) : [],
				]}
			>
				{eyebrow ? (
					<Eyebrow
						href={eyebrowHref}
						variant={resolvedEyebrowVariant}
						index={resolvedEyebrowVariant === "numbered" ? eyebrowIndex : undefined}
						mix={[
							isSplit ? splitEyebrow() : self(isCenter ? "center" : "start"),
							raw({ marginBlockEnd: resolvedEyebrowVariant === "mono" ? "0.5rem" : "1.5rem" }),
							parts?.eyebrow,
						]}
					>
						{eyebrow}
					</Eyebrow>
				) : null}

				<Heading
					size="chapter"
					mix={[m(0), isSplit ? raw({ gridArea: "title" }) : [], parts?.title]}
				>
					{tone === "statement" ? (
						<span data-slot="landing-header-statement" mix={[statement()]}>
							{children}
						</span>
					) : (
						children
					)}
					{subtitle ? (
						<span
							data-slot="landing-header-subtitle"
							mix={[raw({ display: "block", color: MUTED_TITLE })]}
						>
							{subtitle}
						</span>
					) : null}
				</Heading>

				{description ? (
					<p
						mix={[
							landingLead(),
							raw({ marginBlockStart: "1rem" }),
							isCenter ? mi("auto") : [],
							isSplit ? splitLead() : [],
							parts?.description,
						]}
					>
						{description}
					</p>
				) : null}
			</div>
		);

		return (
			<header
				{...rest}
				data-align={resolvedAlign}
				data-layout={isSplit ? "split" : "stack"}
				mix={mergeMix(
					[
						isSplit ? [container(CONTAINER), raw({ inlineSize: "100%" })] : [],
						action
							? raw({
									display: "flex",
									flexWrap: "wrap",
									alignItems: "flex-end",
									justifyContent: "space-between",
									columnGap: "2rem",
									rowGap: "1.5rem",
								})
							: vstack({ align: isCenter ? "center" : "stretch", gap: 0 }),
						isCenter ? [textAlign("center"), mi("auto")] : [],
						raw({ marginBlockEnd: HEADER_SPACE }),
					],
					mix,
				)}
			>
				{content}
				{action ? (
					<div data-slot="landing-header-action" mix={[raw({ flex: "none" })]}>
						{action}
					</div>
				) : null}
			</header>
		);
	};
}

/**
 * The split grid: eyebrow over title in the wider first column and the lead in the second,
 * from the header's `lg` width. The lead spans both rows and the first row takes any height
 * it adds, so a lead taller than the title never pulls the eyebrow away from it.
 */
function splitGrid() {
	return at(
		"lg",
		CONTAINER,
		raw({
			display: "grid",
			gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)",
			gridTemplateRows: "1fr auto",
			gridTemplateAreas: '"eyebrow lead" "title lead"',
			columnGap: "4rem",
			alignItems: "end",
		}),
	);
}

/**
 * The split eyebrow: at the start of the stack on narrow headers, and from `lg` at the foot
 * of the first grid row, so it rests on the title however tall the lead beside them runs.
 */
function splitEyebrow() {
	return [
		raw({ alignSelf: "var(--ui-landing-split-eyebrow-align, start)", justifySelf: "start" }),
		at("lg", CONTAINER, raw({ gridArea: "eyebrow", "--ui-landing-split-eyebrow-align": "end" })),
	];
}

/** The split lead: in the second column, on the title's last line, at most 28rem wide. */
function splitLead() {
	return at(
		"lg",
		CONTAINER,
		raw({
			gridArea: "lead",
			marginBlockStart: "0",
			marginBlockEnd: "0.35em",
			maxInlineSize: "28rem",
		}),
	);
}

/** A statement title: muted ink, with its `<strong>` phrase back in the heading ink. */
function statement() {
	return [
		raw({ color: MUTED_TITLE }),
		when(
			"& :is(strong, b, [data-emphasis])",
			raw({ color: "var(--ui-neutral-fg-emphasis)", fontWeight: "inherit" }),
		),
	];
}

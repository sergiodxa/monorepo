/**
 * A video title's hero: its art edge to edge behind the page's top bar, faded into the page at
 * its foot and toward the text, with an eyebrow, the title, a row of facts, a summary and the
 * actions. A catalogue's home features a title with it, and a title's page opens on it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { mergeMix, raw } from "@sdxc/u/general";
import { motionSafe } from "@sdxc/u/responsive";

/** Container the hero declares, which its text column sizes against. */
const CONTAINER = "ui-title-hero";

/** How tall the hero stands per size, before its content asks for more. */
const MIN_SIZES: Record<TitleHero.Size, string> = {
	feature: "var(--ui-title-hero-feature-size, min(88svh, 52rem))",
	title: "var(--ui-title-hero-title-size, min(70svh, 40rem))",
};

/** The page colour the art fades into, so its foot meets the page with no edge. */
const FADE = "var(--ui-title-hero-fade, var(--ui-bg))";

/** Prop types for {@link TitleHero} and its parts. */
export namespace TitleHero {
	/** `feature` for a home's billboard, `title` for the head of a title's own page. */
	export type Size = "feature" | "title";

	/** Every native `<section>` attribute, plus the art behind it and its size. */
	export interface Props extends TagProps<"section"> {
		/** The picture behind the hero, drawn edge to edge: an `<img>`, `<picture>` or `<video>`. */
		art: RemixNode;
		/** Default: `"feature"`. */
		size?: Size;
		/** The hero's parts: eyebrow, title, facts, summary and actions, in reading order. */
		children: RemixNode;
	}

	/** Every native heading attribute, plus the heading's level. */
	export interface TitleProps extends TagProps<"h1"> {
		/** `1` on a title's own page, `2` when the page has its own `h1`. */
		level: 1 | 2;
	}
}

/**
 * Renders the hero. It pulls itself up under a sticky top bar by `--ui-title-hero-offset`
 * (the bar's height), so the art starts at the window's edge while the text clears the bar;
 * under reduced motion the art holds still instead of drifting.
 *
 * @example
 * <TitleHero art={<img src="/art/tidewater.jpg" alt="" />} aria-labelledby="hero-title">
 * 	<TitleHero.Eyebrow>Original</TitleHero.Eyebrow>
 * 	<TitleHero.Title id="hero-title" level={1}>Tidewater</TitleHero.Title>
 * 	<TitleHero.Facts><span>2026</span><span>2 seasons</span></TitleHero.Facts>
 * 	<TitleHero.Summary>A harbour town keeps one secret a season.</TitleHero.Summary>
 * 	<TitleHero.Actions><LinkButton href="/watch/tidewater">Play</LinkButton></TitleHero.Actions>
 * </TitleHero>
 */
export function TitleHero(handle: Handle<TitleHero.Props>) {
	return () => {
		let { art, children, mix, size = "feature", ...rest } = handle.props;
		return (
			<section
				{...rest}
				data-slot="title-hero"
				data-size={size}
				mix={mergeMix(
					[
						raw({
							containerName: CONTAINER,
							containerType: "inline-size",
							position: "relative",
							isolation: "isolate",
							display: "grid",
							alignContent: "end",
							marginBlockStart: "calc(-1 * var(--ui-title-hero-offset, 0px))",
							minBlockSize: MIN_SIZES[size],
							paddingInline: "var(--ui-title-hero-inset, 1rem)",
							paddingBlock:
								"calc(var(--ui-title-hero-offset, 0px) + 2rem) clamp(2rem, 6vh, 4.5rem)",
							overflow: "clip",
						}),
					],
					mix,
				)}
			>
				<div
					data-slot="title-hero-art"
					mix={[
						raw({
							position: "absolute",
							inset: "0",
							zIndex: "-1",
							"& > *": {
								position: "absolute",
								inset: "0",
								inlineSize: "100%",
								blockSize: "100%",
								objectFit: "cover",
							},
							"&::after": {
								content: '""',
								position: "absolute",
								inset: "0",
								background: `linear-gradient(to top, ${FADE} 0%, color-mix(in oklch, ${FADE}, transparent 30%) 22%, transparent 55%), linear-gradient(to right, color-mix(in oklch, ${FADE}, transparent 15%) 0%, transparent 62%)`,
							},
							"@keyframes ui-title-hero-drift": {
								from: { scale: "1.06" },
								to: { scale: "1" },
							},
						}),
						motionSafe(
							raw({
								"& > :first-child": { animation: "ui-title-hero-drift 14s ease-out both" },
							}),
						),
					]}
				>
					{art}
				</div>
				<div
					data-slot="title-hero-content"
					mix={[raw({ display: "grid", gap: "1rem", maxInlineSize: "38rem" })]}
				>
					{children}
				</div>
			</section>
		);
	};
}

/** The small line over the title, such as "Original" or "New season". */
TitleHero.Eyebrow = function TitleHeroEyebrow(handle: Handle<TagProps<"span">>) {
	return () => {
		let { mix, ...rest } = handle.props;
		return (
			<span
				{...rest}
				data-slot="title-hero-eyebrow"
				mix={mergeMix(
					[
						raw({
							fontSize: "0.75rem",
							fontWeight: "700",
							letterSpacing: "0.28em",
							textTransform: "uppercase",
							color: "var(--ui-title-hero-accent, var(--ui-brand-fg))",
						}),
					],
					mix,
				)}
			/>
		);
	};
};

/**
 * The title as the hero's heading, large and balanced; a page sets its own lettering through
 * `mix`, so each title can read in its own type.
 */
TitleHero.Title = function TitleHeroTitle(handle: Handle<TitleHero.TitleProps>) {
	return () => {
		let { children, level, mix, ...rest } = handle.props;
		let merged = mergeMix(
			[
				raw({
					margin: "0",
					fontSize: "clamp(2.25rem, 9cqi, 4.75rem)",
					lineHeight: "0.95",
					color: "var(--ui-neutral-fg-emphasis)",
					textWrap: "balance",
					textShadow: "0 2px 24px rgb(0 0 0 / 0.45)",
				}),
			],
			mix,
		);
		return level === 1 ? (
			<h1 {...rest} data-slot="title-hero-title" mix={merged}>
				{children}
			</h1>
		) : (
			<h2 {...rest} data-slot="title-hero-title" mix={merged}>
				{children}
			</h2>
		);
	};
};

/** The facts under the title (rating, year, length, genres) as one wrapping row. */
TitleHero.Facts = function TitleHeroFacts(handle: Handle<TagProps<"p">>) {
	return () => {
		let { mix, ...rest } = handle.props;
		return (
			<p
				{...rest}
				data-slot="title-hero-facts"
				mix={mergeMix(
					[
						raw({
							display: "flex",
							flexWrap: "wrap",
							alignItems: "center",
							gap: "0.375rem 0.75rem",
							margin: "0",
							fontSize: "0.9375rem",
							color: "var(--ui-neutral-fg-emphasis)",
							fontVariantNumeric: "tabular-nums",
						}),
					],
					mix,
				)}
			/>
		);
	};
};

/** An age rating in the facts row, outlined so it reads as a label rather than a fact. */
TitleHero.Rating = function TitleHeroRating(handle: Handle<TagProps<"span">>) {
	return () => {
		let { mix, ...rest } = handle.props;
		return (
			<span
				{...rest}
				data-slot="title-hero-rating"
				mix={mergeMix(
					[
						raw({
							paddingInline: "0.375rem",
							borderRadius: "var(--ui-radius-sm, 0.25rem)",
							boxShadow: "inset 0 0 0 1px color-mix(in oklch, currentColor 45%, transparent)",
							fontSize: "0.8125rem",
							fontWeight: "600",
						}),
					],
					mix,
				)}
			/>
		);
	};
};

/** The title's synopsis or tagline, shadowed so it reads over any art. */
TitleHero.Summary = function TitleHeroSummary(handle: Handle<TagProps<"p">>) {
	return () => {
		let { mix, ...rest } = handle.props;
		return (
			<p
				{...rest}
				data-slot="title-hero-summary"
				mix={mergeMix(
					[
						raw({
							margin: "0",
							fontSize: "clamp(0.9375rem, 2.2cqi, 1.0625rem)",
							lineHeight: "1.6",
							color: "var(--ui-neutral-fg)",
							textWrap: "pretty",
							textShadow: "0 1px 8px rgb(0 0 0 / 0.5)",
						}),
					],
					mix,
				)}
			/>
		);
	};
};

/** The hero's buttons, primary first, wrapping onto a second line on a narrow screen. */
TitleHero.Actions = function TitleHeroActions(handle: Handle<TagProps<"div">>) {
	return () => {
		let { mix, ...rest } = handle.props;
		return (
			<div
				{...rest}
				data-slot="title-hero-actions"
				mix={mergeMix(
					[
						raw({
							display: "flex",
							flexWrap: "wrap",
							gap: "0.625rem",
							marginBlockStart: "0.25rem",
						}),
					],
					mix,
				)}
			/>
		);
	};
};

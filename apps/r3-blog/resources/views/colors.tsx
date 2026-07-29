/**
 * View for the color-palette reference page. Derives the raw palette scales and
 * the semantic tone tokens from the design system's own contract and renders each
 * tone as a worked example card plus grids of swatches. Exists as a living style
 * guide so the blog's design tokens can be previewed in the browser.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { Badge, Button, Heading } from "@pkg/r3-ui";
import { bg, border, borderEdge, fg } from "@pkg/u/color";
import { ringShadow, rounded } from "@pkg/u/effects";
import { listStyle } from "@pkg/u/general";
import { flexWrap, gap, grid, gridTemplate, hstack, items, shrink } from "@pkg/u/layout";
import { bs, is, m, mis, p, pbs } from "@pkg/u/size";
import { text } from "@pkg/u/typography";

import { BlogLayout } from "~/resources/components/layout/blog";
import routes from "~/routes/web";

/**
 * Types used by the colors page view model.
 */
export namespace ColorsView {
	/**
	 * Represents a single CSS custom property token.
	 */
	export interface Token {
		name: string;
	}

	/**
	 * Groups related tokens under a section heading.
	 */
	export interface Group {
		title: string;
		tokens: Array<Token>;
	}

	/**
	 * Placeholder view model for the colors page.
	 */
	export interface Model {}
}

/**
 * The five semantic tone names the theme layer defines, in the order they are
 * previewed. `neutral` leads because every surface on the site is built from it
 * and the other four read as departures from that baseline.
 */
const TONES = ["neutral", "brand", "success", "warning", "danger"] as const;

/**
 * The eleven steps every raw palette scale exposes, lightest to darkest. Kept as
 * a list rather than generated from a range so the two irregular ends (`50` and
 * `950`, which break the otherwise-even hundreds) stay visible at a glance.
 */
const PALETTE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

/**
 * Every property suffix a semantic tone carries. The four interaction states
 * (`-hover`, `-pressed`) come from the component library's theme rather than the
 * lower-level token contract, since how far a color shifts on hover is a
 * component-design decision — they are listed here because this page documents
 * what an app can actually reference, not which file declares it.
 */
const TONE_PROPERTIES = [
	"bg-tint",
	"bg-tint-hover",
	"bg-tint-pressed",
	"bg-solid",
	"bg-solid-hover",
	"bg-solid-pressed",
	"border",
	"border-strong",
	"ring",
	"fg",
	"fg-muted",
	"fg-emphasis",
	"fg-on-solid",
] as const;

/**
 * Props for the per-tone worked example.
 */
namespace TonePreview {
	export interface Props {
		/** Tone whose tokens the card demonstrates. */
		tone: (typeof TONES)[number];
	}
}

/**
 * Renders one tone as a worked example: a tinted card showing the three tint
 * steps as chips and the three solid steps as buttons, so each token is seen in
 * the role it was designed for rather than as an abstract swatch. The five cards
 * are identical apart from their tone, which is the point — a tone swap should
 * be the only difference between two otherwise-matching surfaces.
 */
function TonePreview(handle: Handle<TonePreview.Props>) {
	return () => {
		let { tone } = handle.props;

		return (
			<article
				mix={[
					grid(),
					gap(3),
					p(4),
					rounded("xl"),
					bg(`${tone}.tint`),
					border({ width: 1, color: tone }),
					fg(tone),
				]}
			>
				<Heading level={3} mix={[fg(`${tone}.emphasis`)]}>
					{tone}
				</Heading>
				<p mix={[m(0), fg(`${tone}.muted`)]}>
					Tint, border, foreground, muted, and emphasis tokens for the {tone} tone.
				</p>
				<div mix={[hstack({ gap: 2 }), flexWrap("wrap")]}>
					<Badge color={tone} variant="outline">
						Tint
					</Badge>
					<span
						mix={[
							p(1, 2),
							rounded("md"),
							bg(`${tone}.bg-tint-hover`),
							border({ width: 1, color: tone }),
						]}
					>
						Hover
					</span>
					<span
						mix={[
							p(1, 2),
							rounded("md"),
							bg(`${tone}.bg-tint-pressed`),
							border({ width: 1, color: `${tone}.strong` }),
						]}
					>
						Pressed
					</span>
				</div>
				<div
					mix={[
						hstack({ gap: 2 }),
						flexWrap("wrap"),
						pbs(2),
						borderEdge("block-start", { width: 1, color: `${tone}.strong` }),
					]}
				>
					<Button type="button" color={tone} size="sm">
						Solid
					</Button>
					<span mix={[p(2, 3), rounded("lg"), bg(`${tone}.bg-solid-hover`), fg(`${tone}.onSolid`)]}>
						Hover
					</span>
					<span
						mix={[p(2, 3), rounded("lg"), bg(`${tone}.bg-solid-pressed`), fg(`${tone}.onSolid`)]}
					>
						Pressed
					</span>
					{/* `ring()` only ever paints on :focus-visible, and a focus ring nobody
					can focus is invisible documentation — so this sample uses the
					always-on `ringShadow()` against the same ring token instead. */}
					<span
						mix={[
							mis("auto"),
							p(2, 3),
							rounded("lg"),
							border({ width: 1, color: tone }),
							ringShadow(`${tone}.ring`, 3),
						]}
					>
						Ring
					</span>
				</div>
			</article>
		);
	};
}

/**
 * Builds the colors page renderer with token previews and swatches.
 */
export function ColorsView() {
	return ({ model: _model }: { model: ColorsView.Model }) => {
		let groups: Array<ColorsView.Group> = [
			...TONES.map((tone) => ({
				title: `Palette: ${tone}`,
				tokens: PALETTE_STEPS.map((step) => ({ name: `--ui-color-${tone}-${step}` })),
			})),
			...TONES.map((tone) => ({
				title: `Tone: ${tone}`,
				tokens: TONE_PROPERTIES.map((property) => ({ name: `--ui-${tone}-${property}` })),
			})),
		];

		return (
			<BlogLayout
				title="Color Palette"
				description="R3 Blog color tokens"
				activePath={routes.colors.href()}
			>
				<main mix={[grid(), gap(5)]}>
					<Heading level={1} mix={[text("3xl")]}>
						R3 Blog Palette
					</Heading>
					<p mix={[m(0), fg("neutral")]}>
						Every raw palette step and semantic tone token this site defines, shown as swatches with
						one worked example per tone.
					</p>

					<section
						mix={[
							grid(),
							gap(4),
							gridTemplate({ columns: "repeat(auto-fit, minmax(20rem, 1fr))" }),
						]}
					>
						{TONES.map((tone) => (
							<TonePreview key={tone} tone={tone} />
						))}
					</section>

					{groups.map((group) => (
						<section key={group.title} mix={[grid(), gap(3)]}>
							<Heading level={2} mix={[text("2xl")]}>
								{group.title}
							</Heading>
							<ul
								mix={[
									m(0),
									p(0),
									listStyle("none"),
									grid(),
									gap(3),
									gridTemplate({ columns: "repeat(auto-fit, minmax(13rem, 1fr))" }),
								]}
							>
								{group.tokens.map((token) => (
									<li key={token.name} mix={[hstack({ gap: 3 }), items("center")]}>
										<span
											aria-hidden
											mix={[
												is(12),
												bs(12),
												shrink(0),
												rounded("sm"),
												bg(`var(${token.name})`),
												border({ width: 1, color: "neutral" }),
											]}
										/>
										<code mix={[text("sm"), fg("neutral")]}>{token.name}</code>
									</li>
								))}
							</ul>
						</section>
					))}
				</main>
			</BlogLayout>
		);
	};
}

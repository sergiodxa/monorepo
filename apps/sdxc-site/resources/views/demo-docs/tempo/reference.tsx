/**
 * Tempo's reference pages, one per group of utilities: spacing, colour, layout, typography
 * and effects. Every utility is drawn doing what it does, beside the call that drew it and a
 * table of its calls with the CSS each one emits.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";

import { demoDocsHref } from "~/resources/views/demo-docs";
import { utilityPage } from "~/resources/views/demo-docs/tempo/utility-docs";
import {
	Chip,
	Dot,
	Gap,
	Layout,
	LightSurface,
	Padding,
	PALETTES,
	RADII,
	Ramp,
	Ruler,
	SHADOWS,
	space,
	SPACING_STEPS,
	Swatch,
	swatch,
	Tile,
	TYPE_SCALE,
	TypeSample,
} from "~/resources/views/demo-docs/tempo/visuals";

/** The addresses of Tempo's pages. */
const href = demoDocsHref("tempo");

/** Spacing: the scale, then padding, margin and gap drawn as hatched space. */
export const SPACING = utilityPage({
	title: "Spacing",
	description:
		"Padding, margin and gap on one quarter-rem scale, so every space in an interface lines up with every other.",
	updated: "2026-10-29",
	intro: (
		<>
			Every spacing utility takes a step on the same scale. One step is a quarter of a rem, so{" "}
			<code>4</code> is 1rem at the reader’s font size and spacing grows with their text.
		</>
	),
	sections: [
		{
			id: "the-scale",
			title: "The spacing scale",
			content: <Ruler steps={SPACING_STEPS} />,
		},
	],
	utilities: [
		{
			name: "pad",
			signature: "pad(step, inline?)",
			summary: (
				<>
					Sets the space inside an element’s border. Pass a second step to pad the inline sides
					differently from the block sides.
				</>
			),
			example: {
				code: "<div class={pad(2)}>…</div>\n<div class={pad(4)}>…</div>\n<div class={pad(8)}>…</div>\n<div class={pad(0, 6)}>…</div>",
				preview: (
					<>
						<Padding step={2} label="pad(2)" />
						<Padding step={4} label="pad(4)" />
						<Padding step={8} label="pad(8)" />
						<Padding step={6} label="pad(0, 6)" inline />
					</>
				),
			},
			calls: [
				{ call: "pad(0)", css: "padding: 0" },
				{ call: "pad(2)", css: "padding: 0.5rem" },
				{ call: "pad(4)", css: "padding: 1rem" },
				{ call: "pad(8)", css: "padding: 2rem" },
				{ call: "pad(2, 4)", css: "padding: 0.5rem 1rem" },
			],
		},
		{
			name: "margin",
			signature: 'margin(step | "auto", inline?)',
			summary: (
				<>
					Sets the space outside an element’s border. <code>"auto"</code> on the inline sides
					centres a block with a width of its own.
				</>
			),
			example: {
				code: '<div class={margin(0)}>…</div>\n<div class={margin(6)}>…</div>\n<div class={margin(0, "auto")}>…</div>',
				column: true,
				preview: (
					<>
						{[
							{ label: "margin(0)", style: { margin: "0" } },
							{ label: "margin(6)", style: { margin: space(6) } },
							{
								label: 'margin(0, "auto")',
								style: { margin: "0 auto", inlineSize: "10rem", maxInlineSize: "100%" },
							},
						].map((row) => (
							<div
								key={row.label}
								mix={[
									raw({
										borderRadius: "var(--ui-radius-md, 0.25rem)",
										backgroundImage:
											"repeating-linear-gradient(-45deg, var(--ui-brand-border) 0 1px, transparent 1px 7px)",
										boxShadow: "inset 0 0 0 1px var(--ui-brand-border)",
										display: "flow-root",
									}),
								]}
							>
								<div mix={[raw(row.style)]}>
									<Tile label={row.label} wide />
								</div>
							</div>
						))}
					</>
				),
			},
			calls: [
				{ call: "margin(0)", css: "margin: 0" },
				{ call: "margin(6)", css: "margin: 1.5rem" },
				{ call: 'margin(0, "auto")', css: "margin: 0 auto" },
				{ call: "margin(4, 0)", css: "margin: 1rem 0" },
			],
		},
		{
			name: "gap",
			signature: "gap(step, column?)",
			summary: (
				<>
					Sets the space between the children of a flex or grid container. A second step sets the
					column gap apart from the row gap.
				</>
			),
			example: {
				code: "<div class={tx(row(), gap(1))}>…</div>\n<div class={tx(row(), gap(4))}>…</div>\n<div class={tx(grid(2), gap(2, 6))}>…</div>",
				preview: (
					<>
						<Gap step={1} label="gap(1)" />
						<Gap step={4} label="gap(4)" />
						<Gap step={2} label="gap(2, 6)" grid />
					</>
				),
			},
			calls: [
				{ call: "gap(1)", css: "gap: 0.25rem" },
				{ call: "gap(4)", css: "gap: 1rem" },
				{ call: "gap(2, 6)", css: "row-gap: 0.5rem; column-gap: 1.5rem" },
			],
		},
	],
	next: [
		{
			title: "Layout",
			href: href("utilities/layout"),
			description: "Stacks, rows and grids, which gap spaces.",
		},
		{
			title: "Scales and tokens",
			href: href("start/scales"),
			description: "Change what one step is worth for the whole interface.",
		},
	],
});

/** Colour: the palettes as ramps, then background, text and border colour. */
export const COLOR = utilityPage({
	title: "Colour",
	description:
		"Seven palettes of eleven shades, and the utilities that paint backgrounds, text and borders with them.",
	updated: "2026-10-30",
	intro: (
		<>
			Colour utilities take a palette and a shade, written <code>"tide.500"</code>. Every shade sits
			at the same lightness in each palette, so a pairing that reads well in one reads well in all
			seven.
		</>
	),
	sections: [
		{
			id: "palettes",
			title: "The palettes",
			content: (
				<div
					data-not-typeset=""
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "minmax(0, 1fr)",
							gap: "1.25rem",
							marginBlockStart: "1rem",
						}),
					]}
				>
					{PALETTES.map((palette) => (
						<Ramp key={palette.name} palette={palette} />
					))}
				</div>
			),
		},
	],
	utilities: [
		{
			name: "bg",
			signature: "bg(color)",
			summary: <>Paints an element’s background with a shade, or any CSS colour passed as is.</>,
			example: {
				code: '<div class={bg("tide.100")}>…</div>\n<div class={bg("tide.500")}>…</div>\n<div class={bg("tide.900")}>…</div>',
				preview: (
					<>
						<Chip background={swatch("tide", 100)} color={swatch("tide", 900)}>
							tide.100
						</Chip>
						<Chip background={swatch("tide", 500)} color="white">
							tide.500
						</Chip>
						<Chip background={swatch("tide", 900)} color={swatch("tide", 100)}>
							tide.900
						</Chip>
					</>
				),
			},
			calls: ([100, 500, 900] as const).map((shade) => ({
				call: `bg("tide.${shade}")`,
				css: `background-color: var(--tempo-tide-${shade})`,
				sample: <Dot color={swatch("tide", shade)} />,
			})),
		},
		{
			name: "fg",
			signature: "fg(color)",
			summary: (
				<>
					Sets the text colour. Pair a shade of 700 or darker with a 50–200 background and the text
					clears 4.5:1 contrast in every palette.
				</>
			),
			example: {
				code: '<p class={tx(bg("clay.50"), fg("clay.800"))}>…</p>\n<p class={tx(bg("moss.100"), fg("moss.800"))}>…</p>\n<p class={tx(bg("ink.900"), fg("ink.100"))}>…</p>',
				preview: (
					<>
						<Chip background={swatch("clay", 50)} color={swatch("clay", 800)}>
							Overdue
						</Chip>
						<Chip background={swatch("moss", 100)} color={swatch("moss", 800)}>
							Paid
						</Chip>
						<Chip background={swatch("ink", 900)} color={swatch("ink", 100)}>
							Draft
						</Chip>
					</>
				),
			},
			calls: [
				{
					call: 'fg("clay.800")',
					css: "color: var(--tempo-clay-800)",
					sample: <Dot color={swatch("clay", 800)} />,
				},
				{
					call: 'fg("moss.800")',
					css: "color: var(--tempo-moss-800)",
					sample: <Dot color={swatch("moss", 800)} />,
				},
				{
					call: 'fg("currentColor")',
					css: "color: currentColor",
				},
			],
		},
		{
			name: "borderColor",
			signature: "borderColor(color)",
			summary: (
				<>
					Sets the colour of every side of an element’s border, leaving its width and style to{" "}
					<code>border()</code>.
				</>
			),
			example: {
				code: '<div class={tx(border(2), borderColor("tide.300"))}>…</div>\n<div class={tx(border(2), borderColor("plum.500"))}>…</div>',
				preview: (
					<>
						<Chip background="transparent" color={swatch("tide", 700)} border={swatch("tide", 300)}>
							tide.300
						</Chip>
						<Chip background="transparent" color={swatch("plum", 600)} border={swatch("plum", 500)}>
							plum.500
						</Chip>
					</>
				),
			},
			calls: [
				{
					call: 'borderColor("tide.300")',
					css: "border-color: var(--tempo-tide-300)",
					sample: <Dot color={swatch("tide", 300)} />,
				},
				{
					call: 'borderColor("plum.500")',
					css: "border-color: var(--tempo-plum-500)",
					sample: <Dot color={swatch("plum", 500)} />,
				},
			],
		},
	],
	next: [
		{
			title: "Typography",
			href: href("utilities/typography"),
			description: "Set the size and weight of the text you just coloured.",
		},
		{
			title: "Scales and tokens",
			href: href("start/scales"),
			description: "Swap a palette for your brand’s own colours.",
		},
	],
});

/** Layout: stack, row, grid and center, each drawn with the properties it sets. */
export const LAYOUT = utilityPage({
	title: "Layout",
	description:
		"Stack things, line them up in a row, put them on a grid or centre them, each in one call.",
	updated: "2026-10-26",
	intro: (
		<>
			Layout utilities set <code>display</code> and the alignment that goes with it. Space between
			children comes from <a href={`${href("utilities/spacing")}#gap`}>gap</a>, so every layout
			spaces its children the same way.
		</>
	),
	utilities: [
		{
			name: "stack",
			signature: 'stack(align?: "start" | "center" | "end" | "stretch")',
			summary: <>Lays children out top to bottom, stretched to the container’s width by default.</>,
			example: {
				code: '<div class={tx(stack(), gap(2))}>…</div>\n<div class={tx(stack("start"), gap(2))}>…</div>',
				preview: (
					<>
						<Layout
							items={["A", "B", "C"]}
							style={{
								display: "flex",
								flexDirection: "column",
								gap: space(2),
								maxInlineSize: "12rem",
							}}
						/>
						<Layout
							items={["A", "B", "C"]}
							style={{
								display: "flex",
								flexDirection: "column",
								alignItems: "flex-start",
								gap: space(2),
								maxInlineSize: "12rem",
							}}
						/>
					</>
				),
			},
			calls: [
				{ call: "stack()", css: "display: flex; flex-direction: column" },
				{
					call: 'stack("start")',
					css: "display: flex; flex-direction: column; align-items: start",
				},
			],
		},
		{
			name: "row",
			signature: 'row(justify?: "start" | "center" | "between" | "end")',
			summary: (
				<>
					Lays children out side by side, centred on the cross axis and wrapping when they run out
					of room.
				</>
			),
			example: {
				code: '<div class={tx(row(), gap(2))}>…</div>\n<div class={tx(row("between"), gap(2))}>…</div>',
				column: true,
				preview: (
					<>
						<Layout
							items={["A", "B", "C"]}
							style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: space(2) }}
						/>
						<Layout
							items={["A", "B", "C"]}
							style={{
								display: "flex",
								flexWrap: "wrap",
								alignItems: "center",
								justifyContent: "space-between",
								gap: space(2),
							}}
						/>
					</>
				),
			},
			calls: [
				{ call: "row()", css: "display: flex; flex-wrap: wrap; align-items: center" },
				{ call: 'row("between")', css: "… justify-content: space-between" },
			],
		},
		{
			name: "grid",
			signature: "grid(columns: number | string)",
			summary: (
				<>
					Lays children on equal columns. Pass a minimum width instead of a count and the grid fits
					as many columns as the container holds.
				</>
			),
			example: {
				code: '<ul class={tx(grid(3), gap(2))}>…</ul>\n<ul class={tx(grid("6rem"), gap(2))}>…</ul>',
				column: true,
				preview: (
					<>
						<Layout
							items={["1", "2", "3", "4", "5", "6"]}
							style={{
								display: "grid",
								gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
								gap: space(2),
							}}
						/>
						<Layout
							items={["1", "2", "3", "4", "5"]}
							style={{
								display: "grid",
								gridTemplateColumns: "repeat(auto-fill, minmax(6rem, 1fr))",
								gap: space(2),
							}}
						/>
					</>
				),
			},
			calls: [
				{ call: "grid(3)", css: "display: grid; grid-template-columns: repeat(3, minmax(0, 1fr))" },
				{
					call: 'grid("6rem")',
					css: "display: grid; grid-template-columns: repeat(auto-fill, minmax(6rem, 1fr))",
				},
			],
		},
		{
			name: "center",
			signature: "center()",
			summary: <>Centres one child on both axes, whatever its size.</>,
			example: {
				code: "<div class={center()}>…</div>",
				preview: (
					<Layout
						items={["A"]}
						style={{ display: "grid", placeItems: "center", minBlockSize: "8rem" }}
					/>
				),
			},
			calls: [{ call: "center()", css: "display: grid; place-items: center" }],
		},
	],
	next: [
		{
			title: "Spacing",
			href: href("utilities/spacing"),
			description: "Space a layout’s children with gap.",
		},
		{
			title: "Effects",
			href: href("utilities/effects"),
			description: "Round and lift the boxes a layout places.",
		},
	],
});

/** Typography: the type scale, then size, weight, line height and tracking. */
export const TYPOGRAPHY = utilityPage({
	title: "Typography",
	description:
		"An eight-step type scale with a line height paired to each size, plus weight and letter spacing.",
	updated: "2026-10-24",
	intro: (
		<>
			Each step of the type scale sets a size and the line height that reads best with it, so
			changing a heading’s size never leaves it cramped.
		</>
	),
	sections: [
		{
			id: "the-type-scale",
			title: "The type scale",
			content: (
				<div
					data-not-typeset=""
					mix={[raw({ display: "grid", gap: "0.75rem", marginBlockStart: "1rem" })]}
				>
					{TYPE_SCALE.map((entry) => (
						<TypeSample
							key={entry.step}
							label={`${entry.step} · ${entry.size}`}
							style={{ fontSize: entry.size, lineHeight: entry.leading }}
						>
							Keep the rhythm
						</TypeSample>
					))}
				</div>
			),
		},
	],
	utilities: [
		{
			name: "text",
			signature: "text(step)",
			summary: <>Sets the font size and its paired line height from one step of the scale.</>,
			example: {
				code: '<p class={text("sm")}>…</p>\n<p class={text("lg")}>…</p>\n<h2 class={text("3xl")}>…</h2>',
				column: true,
				preview: (
					<>
						{["sm", "lg", "3xl"].map((step) => {
							let entry = TYPE_SCALE.find((item) => item.step === step)!;
							return (
								<TypeSample
									key={step}
									label={`text("${step}")`}
									style={{ fontSize: entry.size, lineHeight: entry.leading }}
								>
									The quick brown fox
								</TypeSample>
							);
						})}
					</>
				),
			},
			calls: TYPE_SCALE.filter((entry) => ["xs", "base", "xl", "4xl"].includes(entry.step)).map(
				(entry) => ({
					call: `text("${entry.step}")`,
					css: `font-size: ${entry.size}; line-height: ${entry.leading}`,
				}),
			),
		},
		{
			name: "weight",
			signature: 'weight("regular" | "medium" | "semibold" | "bold")',
			summary: <>Sets the font weight by name, so a heading and a label agree on what “bold” is.</>,
			example: {
				code: '<span class={weight("regular")}>…</span>\n<span class={weight("semibold")}>…</span>\n<span class={weight("bold")}>…</span>',
				column: true,
				preview: (
					<>
						{[
							["regular", "400"],
							["medium", "500"],
							["semibold", "600"],
							["bold", "700"],
						].map(([name, value]) => (
							<TypeSample
								key={name}
								label={`weight("${name}")`}
								style={{ fontSize: "1.25rem", fontWeight: value! }}
							>
								Tessellate
							</TypeSample>
						))}
					</>
				),
			},
			calls: [
				{ call: 'weight("regular")', css: "font-weight: 400" },
				{ call: 'weight("medium")', css: "font-weight: 500" },
				{ call: 'weight("semibold")', css: "font-weight: 600" },
				{ call: 'weight("bold")', css: "font-weight: 700" },
			],
		},
		{
			name: "tracking",
			signature: 'tracking("tight" | "normal" | "wide")',
			summary: (
				<>
					Sets the letter spacing. Tighten large headings and widen small uppercase labels; leave
					body text alone.
				</>
			),
			example: {
				code: '<h2 class={tx(text("3xl"), tracking("tight"))}>…</h2>\n<span class={tx(text("xs"), tracking("wide"))}>…</span>',
				column: true,
				preview: (
					<>
						<TypeSample
							label='tracking("tight")'
							style={{ fontSize: "1.875rem", fontWeight: "700", letterSpacing: "-0.025em" }}
						>
							Mosaic
						</TypeSample>
						<TypeSample
							label='tracking("wide")'
							style={{
								fontSize: "0.75rem",
								fontWeight: "600",
								letterSpacing: "0.1em",
								textTransform: "uppercase",
							}}
						>
							New release
						</TypeSample>
					</>
				),
			},
			calls: [
				{ call: 'tracking("tight")', css: "letter-spacing: -0.025em" },
				{ call: 'tracking("normal")', css: "letter-spacing: 0" },
				{ call: 'tracking("wide")', css: "letter-spacing: 0.1em" },
			],
		},
	],
	next: [
		{
			title: "Colour",
			href: href("utilities/colour"),
			description: "Colour the text with fg.",
		},
		{
			title: "Scales and tokens",
			href: href("start/scales"),
			description: "Point the scale at your own fonts.",
		},
	],
});

/** Effects: corner radius, shadow and opacity, each drawn as a row of tiles. */
export const EFFECTS = utilityPage({
	title: "Effects",
	description: "Round corners, cast shadows and fade elements, each from a short named scale.",
	updated: "2026-10-22",
	intro: (
		<>
			Effects take a named step rather than a number, because a radius or a shadow is picked by eye.
			Every step is drawn below so you can pick it the same way.
		</>
	),
	utilities: [
		{
			name: "rounded",
			signature: 'rounded(step: "none" | "sm" | "md" | "lg" | "xl" | "full")',
			summary: (
				<>
					Rounds every corner of an element. <code>"full"</code> makes a pill or a circle.
				</>
			),
			example: {
				code: RADII.map((radius) => `<div class={rounded("${radius.step}")} />`).join("\n"),
				preview: (
					<>
						{RADII.map((radius) => (
							<Swatch
								key={radius.step}
								label={radius.step}
								style={{
									borderRadius: radius.value,
									backgroundColor: "var(--ui-brand-bg-tint)",
									boxShadow: "inset 0 0 0 2px var(--ui-brand-border)",
								}}
							/>
						))}
					</>
				),
			},
			calls: RADII.map((radius) => ({
				call: `rounded("${radius.step}")`,
				css: `border-radius: ${radius.value}`,
			})),
		},
		{
			name: "shadow",
			signature: 'shadow(step: "xs" | "sm" | "md" | "lg" | "xl")',
			summary: (
				<>
					Lifts an element off the page. Each step casts a larger, softer shadow, so a menu over a
					card reads as higher than the card.
				</>
			),
			example: {
				code: SHADOWS.map((entry) => `<div class={shadow("${entry.step}")} />`).join("\n"),
				preview: (
					<LightSurface>
						{SHADOWS.map((entry) => (
							<Swatch
								key={entry.step}
								label={entry.step}
								labelColor={swatch("stone", 600)}
								style={{
									borderRadius: "var(--ui-radius-lg, 0.5rem)",
									backgroundColor: "oklch(0.995 0 0)",
									boxShadow: `inset 0 0 0 1px ${swatch("stone", 200)}, ${entry.value}`,
								}}
							/>
						))}
					</LightSurface>
				),
			},
			calls: SHADOWS.map((entry) => ({
				call: `shadow("${entry.step}")`,
				css: `box-shadow: ${entry.value}`,
			})),
		},
		{
			name: "opacity",
			signature: "opacity(percent: number)",
			summary: <>Fades an element and everything inside it, in steps of five percent.</>,
			example: {
				code: [100, 75, 50, 25].map((value) => `<div class={opacity(${value})} />`).join("\n"),
				preview: (
					<>
						{[100, 75, 50, 25].map((value) => (
							<Swatch
								key={value}
								label={`${value}`}
								style={{
									borderRadius: "var(--ui-radius-lg, 0.5rem)",
									backgroundColor: "var(--ui-brand-bg-solid)",
									boxShadow: "none",
									opacity: `${value / 100}`,
								}}
							/>
						))}
					</>
				),
			},
			calls: [100, 75, 50, 25].map((value) => ({
				call: `opacity(${value})`,
				css: `opacity: ${value / 100}`,
			})),
		},
	],
	next: [
		{
			title: "Layout",
			href: href("utilities/layout"),
			description: "Arrange the cards you just rounded and lifted.",
		},
		{
			title: "Dark mode",
			href: `${href("start/scales")}#dark-mode`,
			description: "How shadows and colours follow the reader’s theme.",
		},
	],
});

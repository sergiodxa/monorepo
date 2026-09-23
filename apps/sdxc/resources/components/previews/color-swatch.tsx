/**
 * Live preview island for `ColorSwatch`. A swatch is a read-only chip: it paints the
 * literal color it is handed over a checkerboard, so a translucent value reads as
 * translucent, and its shape and size are the only choices. A palette is where that
 * matters, so the example lays out a brand ramp, the semantic roles beside it, and the
 * shape and size vocabulary a token page reaches for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { hstack, vstack } from "@sdxc/u/layout";
import { font, text, weight } from "@sdxc/u/typography";
import { ColorSwatch } from "@sdxc/ui";
import { clientEntry } from "remix/ui";

/** The brand ramp a theme ships, from the lightest tint to the darkest shade. */
const RAMP = [
	{ step: "100", value: "#dbeafe" },
	{ step: "300", value: "#93c5fd" },
	{ step: "500", value: "#3b82f6" },
	{ step: "700", value: "#1d4ed8" },
	{ step: "900", value: "#1e3a8a" },
];

/** The semantic roles a page reads a state from, and the color each one resolves to. */
const ROLES = [
	{ name: "success", value: "#16a34a" },
	{ name: "warning", value: "#f59e0b" },
	{ name: "danger", value: "#ef4444" },
	{ name: "overlay", value: "rgb(15 23 42 / 0.4)" },
];

/** The source the page shows, matching the markup below. */
const CODE = `<div mix={[vstack({ gap: 5, align: "start" })]}>
	<div mix={[vstack({ gap: 2, align: "start" })]}>
		<span mix={[text("xs"), weight("semibold"), fg("neutral.muted")]}>brand</span>
		<div mix={[hstack({ gap: 2, align: "center" })]}>
			{RAMP.map((stop) => (
				<div key={stop.step} mix={[vstack({ gap: 1, align: "center" })]}>
					<ColorSwatch value={stop.value} shape="rounded" size="lg" />
					<span mix={[font("mono"), text("xs"), fg("neutral")]}>{stop.step}</span>
				</div>
			))}
		</div>
	</div>

	<div mix={[vstack({ gap: 2, align: "start" })]}>
		<span mix={[text("xs"), weight("semibold"), fg("neutral.muted")]}>roles</span>
		<div mix={[hstack({ gap: 4, align: "center" })]}>
			{ROLES.map((role) => (
				<div key={role.name} mix={[hstack({ gap: 2, align: "center" })]}>
					<ColorSwatch value={role.value} shape="circle" size="md" />
					<span mix={[font("mono"), text("xs"), fg("neutral")]}>{role.name}</span>
				</div>
			))}
		</div>
	</div>

	<div mix={[vstack({ gap: 2, align: "start" })]}>
		<span mix={[text("xs"), weight("semibold"), fg("neutral.muted")]}>shape and size</span>
		<div mix={[hstack({ gap: 3, align: "center" })]}>
			<ColorSwatch value="#8b5cf6" shape="square" size="sm" />
			<ColorSwatch value="#8b5cf6" shape="rounded" size="md" />
			<ColorSwatch value="#8b5cf6" shape="circle" size="lg" />
		</div>
	</div>
</div>`;

/** A brand ramp, the semantic roles and the shape vocabulary, hydrated the way every preview here loads. */
export const ColorSwatchPreview = clientEntry(
	"/resources/components/previews/color-swatch.tsx#ColorSwatchPreview",
	function ColorSwatchPreview() {
		return () => (
			<div mix={[vstack({ gap: 5, align: "start" })]}>
				<div mix={[vstack({ gap: 2, align: "start" })]}>
					<span mix={[text("xs"), weight("semibold"), fg("neutral.muted")]}>brand</span>
					<div mix={[hstack({ gap: 2, align: "center" })]}>
						{RAMP.map((stop) => (
							<div key={stop.step} mix={[vstack({ gap: 1, align: "center" })]}>
								<ColorSwatch value={stop.value} shape="rounded" size="lg" />
								<span mix={[font("mono"), text("xs"), fg("neutral")]}>{stop.step}</span>
							</div>
						))}
					</div>
				</div>

				<div mix={[vstack({ gap: 2, align: "start" })]}>
					<span mix={[text("xs"), weight("semibold"), fg("neutral.muted")]}>roles</span>
					<div mix={[hstack({ gap: 4, align: "center" })]}>
						{ROLES.map((role) => (
							<div key={role.name} mix={[hstack({ gap: 2, align: "center" })]}>
								<ColorSwatch value={role.value} shape="circle" size="md" />
								<span mix={[font("mono"), text("xs"), fg("neutral")]}>{role.name}</span>
							</div>
						))}
					</div>
				</div>

				<div mix={[vstack({ gap: 2, align: "start" })]}>
					<span mix={[text("xs"), weight("semibold"), fg("neutral.muted")]}>shape and size</span>
					<div mix={[hstack({ gap: 3, align: "center" })]}>
						<ColorSwatch value="#8b5cf6" shape="square" size="sm" />
						<ColorSwatch value="#8b5cf6" shape="rounded" size="md" />
						<ColorSwatch value="#8b5cf6" shape="circle" size="lg" />
					</div>
				</div>
			</div>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: CODE, render: () => <ColorSwatchPreview /> };

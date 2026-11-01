/**
 * The Foundations of `@sdxc/ui/color`: what the color inputs are for, the native-control,
 * labelling and direction rules they share, and each variable the namespace reads, with
 * the fallback its components declare.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Foundations } from "~/resources/content/foundations";

const COLOR: Foundations = {
	module: "color",
	slug: "color-foundations",
	title: "Color foundations",
	summary:
		"What @sdxc/ui/color is for, the native-control and labelling rules its parts share, and every variable it reads.",
	importPath: "@sdxc/ui/color",
	source: "ui/src/color/color-slider.tsx",
	intro: [
		"Color inputs: swatches, a swatch picker, a saturation area, a hue wheel, channel sliders, a validated field and a popover picker.",
		"Each is a native control underneath, so it submits with a form and works by keyboard before script loads.",
	],
	reachFor: [
		"A brand, accent or theme color setting in a form.",
		"Labels, tags or calendars a user colors from a preset palette.",
		"A design tool or editor that needs every channel, alpha included.",
	],
	ideas: [
		{
			title: "Native controls",
			body: 'Area, wheel and sliders are `<input type="range">`; the swatch picker is radios.',
		},
		{
			title: "Labels required",
			body: "`ColorWheel`, `ColorArea` and `ColorPicker.Trigger` warn in development without an accessible name.",
		},
		{
			title: "Targets",
			body: "Slider inputs and swatch options grow to `--ui-target-size`, 44px on a coarse pointer.",
		},
		{
			title: "Direction",
			body: "Gradients flip under `:dir(rtl)`; an area's vertical axis keeps low at the bottom.",
		},
		{ title: "Motion", body: "Thumb transitions are instant under `prefers-reduced-motion`." },
		{
			title: "Server first",
			body: "The server renders working controls; `colorWheelDrag()`, `colorAreaDrag()` and `colorPreview()` add gestures.",
		},
	],
	roles:
		"Reads the neutral role for borders, checkerboards and fills, and brand for focus rings, checked swatches and thumb borders.",
	variables: [
		{
			title: "Sizes",
			lead: "None is declared in `theme.css`; set any of them on the control or an ancestor.",
			variables: [
				{
					name: "--ui-color-swatch-size-sm",
					default: "1.25rem",
					controls: 'Size of a swatch with `size="sm"`.',
				},
				{
					name: "--ui-color-swatch-size-md",
					default: "1.75rem",
					controls: "Size of a swatch at the default size.",
				},
				{
					name: "--ui-color-swatch-size-lg",
					default: "2.5rem",
					controls: 'Size of a swatch with `size="lg"`.',
				},
				{
					name: "--ui-color-swatch-checker-size",
					default: "0.625rem",
					controls: "Checkerboard cell behind a translucent swatch.",
				},
				{
					name: "--ui-color-picker-trigger-size",
					default: "2.25rem",
					controls: "Size of the button that opens a `ColorPicker`.",
				},
				{
					name: "--ui-color-area-size",
					default: "16rem",
					controls: "Width and height of a `ColorArea`.",
				},
				{
					name: "--ui-color-area-thumb-thickness",
					default: "0.1875rem",
					controls: "Width of the line each of the area's thumbs draws.",
				},
				{
					name: "--ui-color-wheel-size",
					default: "12rem",
					controls: "Diameter of a round `ColorWheel`.",
				},
				{
					name: "--ui-color-wheel-thumb-size",
					default: "1.25rem",
					controls: "Wheel thumb size, the ring's thickness and the plain bar's height.",
				},
				{
					name: "--ui-color-wheel-thumb-border-width",
					default: "2px",
					controls: "Border of the wheel's thumb.",
				},
				{
					name: "--ui-color-slider-thumb-size",
					default: "1.25rem",
					controls: "`Slider` thumb size and the track's height.",
				},
				{
					name: "--ui-color-slider-thumb-border-width",
					default: "2px",
					controls: "Border of a slider's thumb.",
				},
				{
					name: "--ui-color-slider-checker-size",
					default: "0.625rem",
					controls: "Checkerboard cell behind an alpha track.",
				},
				{
					name: "--ui-target-size",
					default: "1.5rem; 2.75rem on a coarse pointer",
					controls: "Smallest pointer target a slider or swatch option keeps.",
				},
			],
		},
		{
			title: "Shape and elevation",
			lead: "Read through `@sdxc/u`'s `rounded()` and `shadow()`; each default is the fallback an app overrides by declaring the variable.",
			variables: [
				{
					name: "--ui-radius-none",
					default: "0px",
					controls: 'Corners of a `shape="square"` swatch.',
				},
				{
					name: "--ui-radius-md",
					default: "0.375rem",
					controls: "Corners of an area, a rounded swatch and the picker's trigger.",
				},
				{
					name: "--ui-radius-full",
					default: "9999px",
					controls: "Corners of the wheel, slider tracks, thumbs and round swatches.",
				},
				{
					name: "--ui-shadow-base",
					default: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
					controls: "Lift under every thumb.",
				},
			],
		},
		{
			title: "Set by the components",
			lead: "Written from a control's value or props, or by a mixin, and read back by its own parts. Leave them unset.",
			variables: [
				{
					name: "--ui-color-swatch-value",
					default: "set by ColorSwatch from value",
					controls: "The color a swatch shows; `colorPreview()` rewrites it while typing.",
				},
				{
					name: "--ui-color-area-hue",
					default: "set by ColorArea from hue",
					controls: "Hue of the area's base layer.",
				},
				{
					name: "--ui-color-wheel-hue, --ui-color-wheel-value",
					default: "set by ColorWheel from its value",
					controls: "Angle the thumb turns to and the hue its border shows.",
				},
				{
					name: "--ui-color-slider-hue",
					default: "set by ColorSlider.Track from hue",
					controls: "Hue a saturation, lightness or alpha gradient is painted at.",
				},
				{
					name: "--ui-color-wheel-track-direction, --ui-color-slider-track-direction",
					default: "right; left in right-to-left text",
					controls: "Direction a hue bar's or slider's gradient runs.",
				},
				{
					name: "--ui-color-slider-channel-<channel>",
					default: "written by channelSync()",
					controls: "Each sibling channel's value, for a custom track gradient to read.",
				},
			],
		},
	],
};

export default COLOR;

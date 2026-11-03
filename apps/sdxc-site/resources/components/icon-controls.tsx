/**
 * Client island: the gallery's filter and customizer, one `GET` form that narrows the grid
 * by `q` and sets the icons' size, stroke and colour. Once script runs, every change applies
 * as it happens: tiles toggle `hidden`, the grid's custom properties change and the address follows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { flexWrap, grid, hstack, vstack } from "@sdxc/u/layout";
import { bs, is, m } from "@sdxc/u/size";
import { font, text, weight } from "@sdxc/u/typography";
import { Button, Checkbox, Input, Label, LinkButton, SearchField, Slider } from "@sdxc/ui";
import { ColorArea, colorAreaDrag, ColorPicker, ColorWheel, colorWheelDrag } from "@sdxc/ui/color";
import { formatHex, hsvToRgb, parseColor, rgbToHsv } from "@sdxc/ui/utils";
import { clientEntry, on } from "remix/component";

import type { IconStyle } from "~/app/services/icon-style";

import { iconCountLabel, matchesWords, queryWords } from "~/app/services/icon-search";
import {
	DEFAULT_ICON_STYLE,
	ICON_STYLE_PARAMS,
	ICON_STYLE_RANGES,
	ICON_STYLE_VARS,
	iconStyleParams,
	iconStyleVars,
} from "~/app/services/icon-style";

/** Props must be a `type` rather than an `interface` to satisfy `SerializableProps`. */
type IconControlsProps = {
	/** The gallery's address, which the form submits to and the reset link returns to. */
	action: string;
	/** The grid the controls narrow and restyle. */
	gridId: string;
	query: string;
	size: number;
	strokeWidth: number;
	absoluteStrokeWidth: boolean;
	/** A `#rrggbb` colour, or `null` for the text colour. */
	color: string | null;
	/** How many icons the server left visible for `query`. */
	matching: number;
	total: number;
	/** The Lucide release the icons come from, which the count names. */
	version: string;
};

/** Where the picking surface opens before a colour is chosen: a mid blue, easy to steer from. */
const OPENING_HSV = { h: 210, s: 80, v: 70 };

/** The colour field's id, which its label names. */
const COLOR_FIELD_ID = "icon-color";

/** The picking surface's id, which the swatch trigger toggles. */
const COLOR_PANEL_ID = "icon-color-panel";

/** A colour the field and the validator both accept: six hex digits. */
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * Renders the form and the count above the grid. Without script it submits like any form,
 * so the server renders the narrowed, restyled grid. The colour is a hex text field, left
 * empty for the text colour around the icons, with a picking surface beside it once script runs.
 */
export const IconControls = clientEntry(
	import.meta.url,
	function IconControls(handle: Handle<IconControlsProps>) {
		let query = handle.props.query;
		let matching = handle.props.matching;
		let style: IconStyle = {
			size: handle.props.size,
			strokeWidth: handle.props.strokeWidth,
			absoluteStrokeWidth: handle.props.absoluteStrokeWidth,
			color: handle.props.color,
		};
		let hsv = toHsv(style.color);

		/** Hides the tiles `query` leaves out, returning how many stay. */
		function narrow(grid: HTMLElement): number {
			let words = queryWords(query);
			let shown = 0;
			for (let tile of grid.querySelectorAll<HTMLElement>("li[data-search]")) {
				let match = matchesWords(tile.dataset.search ?? "", words);
				tile.hidden = !match;
				if (match) shown += 1;
			}
			return shown;
		}

		/** Writes the style's custom properties onto the grid, clearing a colour set to default. */
		function restyle(grid: HTMLElement): void {
			let vars = iconStyleVars(style);
			for (let name of Object.values(ICON_STYLE_VARS)) {
				let value = vars[name];
				if (value === undefined) grid.style.removeProperty(name);
				else grid.style.setProperty(name, value);
			}
		}

		/** Keeps the address on what the grid shows, so a reload or a shared link draws it again. */
		function remember(): void {
			let params = iconStyleParams(style);
			if (query.trim() !== "") params.set("q", query.trim());
			let url = new URL(location.href);
			url.search = params.toString();
			history.replaceState(history.state, "", url);
		}

		/**
		 * Restyles the grid for a colour picked on the surface, and shows it in the field. A
		 * channel left `undefined` keeps its value, so a wheel's hue change keeps the area's point.
		 */
		function pick(next: { h?: number; s?: number; v?: number }): void {
			hsv = {
				h: next.h ?? hsv.h,
				s: next.s ?? hsv.s,
				v: next.v ?? hsv.v,
			};
			style = { ...style, color: formatHex({ ...hsvToRgb(hsv), a: 1 }) };
			let field = document.getElementById(COLOR_FIELD_ID);
			if (field instanceof HTMLInputElement) field.value = style.color ?? "";
			let grid = document.getElementById(handle.props.gridId);
			if (grid) restyle(grid);
			remember();
			void handle.update();
		}

		/**
		 * Moves the picking surface's own inputs to `hsv`. They hold their value themselves, so a
		 * colour typed in the field or a reset reaches the wheel and the area's thumbs only here.
		 */
		function syncSurface(): void {
			let inputs = surfaceInputs();
			if (inputs.hue) inputs.hue.valueAsNumber = hsv.h;
			if (inputs.saturation) inputs.saturation.valueAsNumber = hsv.s;
			if (inputs.brightness) inputs.brightness.valueAsNumber = hsv.v;
		}

		/** Reads the form after any change and applies what moved. */
		function change(event: Event): void {
			let form = event.currentTarget as HTMLFormElement;
			let data = new FormData(form);
			let grid = document.getElementById(handle.props.gridId);
			if (grid === null) return;

			let nextQuery = textField(data, "q") ?? "";
			style = {
				size: Number(textField(data, ICON_STYLE_PARAMS.size) ?? style.size),
				strokeWidth: Number(textField(data, ICON_STYLE_PARAMS.strokeWidth) ?? style.strokeWidth),
				absoluteStrokeWidth: data.get(ICON_STYLE_PARAMS.absoluteStrokeWidth) !== null,
				color: style.color,
			};
			let target = event.target;
			if (target instanceof Node && document.getElementById(COLOR_PANEL_ID)?.contains(target)) {
				let inputs = surfaceInputs();
				pick({
					h: inputs.hue?.valueAsNumber,
					s: inputs.saturation?.valueAsNumber,
					v: inputs.brightness?.valueAsNumber,
				});
				return;
			}
			if (target instanceof HTMLInputElement && target.name === ICON_STYLE_PARAMS.color) {
				let typed = target.value.trim();
				if (typed === "") style.color = null;
				else if (HEX_COLOR.test(typed)) style.color = typed.toLowerCase();
				hsv = toHsv(style.color);
				syncSurface();
			}

			if (nextQuery !== query) {
				query = nextQuery;
				matching = narrow(grid);
			}
			restyle(grid);
			remember();
			void handle.update();
		}

		/** Returns the icons to their default look, keeping the query. */
		function reset(event: Event): void {
			event.preventDefault();
			let form = (event.currentTarget as HTMLElement).closest("form");
			if (form === null) return;
			style = { ...DEFAULT_ICON_STYLE };
			hsv = toHsv(null);
			syncSurface();
			for (let input of form.querySelectorAll<HTMLInputElement>("input")) {
				if (input.name === ICON_STYLE_PARAMS.size) input.value = String(style.size);
				if (input.name === ICON_STYLE_PARAMS.strokeWidth) input.value = String(style.strokeWidth);
				if (input.type === "checkbox") input.checked = false;
				if (input.name === ICON_STYLE_PARAMS.color) input.value = "";
			}
			let grid = document.getElementById(handle.props.gridId);
			if (grid) restyle(grid);
			remember();
			void handle.update();
		}

		return () => {
			let { action, total, version } = handle.props;
			let { size } = ICON_STYLE_RANGES;
			let stroke = ICON_STYLE_RANGES.strokeWidth;

			return (
				<div mix={[vstack({ gap: 4, align: "stretch" })]}>
					<form
						method="get"
						action={action}
						mix={[
							vstack({ gap: 4, align: "stretch" }),
							on<HTMLFormElement, "input">("input", change),
							on<HTMLFormElement, "submit">("submit", (event) => event.preventDefault()),
						]}
					>
						<SearchField aria-label="Filter icons">
							<SearchField.Input
								name="q"
								aria-label="Filter icons by name or tag"
								placeholder="Filter by name or tag"
								defaultValue={query}
							/>
						</SearchField>

						<fieldset
							mix={[
								grid(),
								raw({
									gap: "1rem 1.5rem",
									gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 12rem), 1fr))",
									border: "none",
									padding: 0,
								}),
								m(0),
							]}
						>
							<legend mix={[visuallyHidden()]}>Customize the icons</legend>
							<Slider min={size.min} max={size.max} value={style.size}>
								<ControlLabel>
									Size <Slider.Output>{`${style.size}px`}</Slider.Output>
								</ControlLabel>
								<Slider.Track>
									<Slider.Thumb name={ICON_STYLE_PARAMS.size} step={size.step} aria-label="Size" />
								</Slider.Track>
							</Slider>
							<Slider min={stroke.min} max={stroke.max} value={style.strokeWidth}>
								<ControlLabel>
									Stroke width <Slider.Output>{`${style.strokeWidth}`}</Slider.Output>
								</ControlLabel>
								<Slider.Track>
									<Slider.Thumb
										name={ICON_STYLE_PARAMS.strokeWidth}
										step={stroke.step}
										aria-label="Stroke width"
									/>
								</Slider.Track>
							</Slider>
						</fieldset>

						<div mix={[hstack({ gap: 4, align: "center" }), flexWrap("wrap")]}>
							<Checkbox
								name={ICON_STYLE_PARAMS.absoluteStrokeWidth}
								value="1"
								defaultChecked={style.absoluteStrokeWidth}
							>
								Absolute stroke width
							</Checkbox>
							<ColorPicker
								mix={[raw({ flexDirection: "row", alignItems: "center", gap: "0.5rem" })]}
							>
								<Label htmlFor={COLOR_FIELD_ID}>Color</Label>
								<ColorPicker.Group>
									<Input
										id={COLOR_FIELD_ID}
										type="text"
										name={ICON_STYLE_PARAMS.color}
										defaultValue={style.color ?? ""}
										placeholder="currentColor"
										autoComplete="off"
										spellcheck={false}
										mix={[font("mono"), is("9rem")]}
									/>
									<ColorPicker.Trigger
										commandfor={COLOR_PANEL_ID}
										command="toggle-popover"
										aria-label="Open the color picker"
										value={style.color ?? "currentColor"}
									/>
								</ColorPicker.Group>
								<ColorPicker.Dialog id={COLOR_PANEL_ID} mix={[is("16rem")]}>
									<ColorArea
										aria-label="Saturation and brightness"
										hue={hsv.h}
										saturation={hsv.s}
										value={hsv.v}
										style={{ "--ui-color-area-size": "12rem" }}
										mix={[
											colorAreaDrag(),
											on<HTMLDivElement, "ui:color-area-change">("ui:color-area-change", (event) =>
												pick({ s: event.x, v: event.y }),
											),
										]}
									>
										<ColorArea.SaturationThumb data-color-area-axis="x" aria-label="Saturation" />
										<ColorArea.ValueThumb data-color-area-axis="y" aria-label="Brightness" />
									</ColorArea>
									<ColorWheel
										aria-label="Hue"
										value={hsv.h}
										mix={[
											is("6rem"),
											bs("6rem"),
											colorWheelDrag(),
											on<HTMLDivElement, "ui:color-wheel-change">(
												"ui:color-wheel-change",
												(event) => pick({ h: event.hue }),
											),
										]}
									/>
								</ColorPicker.Dialog>
							</ColorPicker>
							<LinkButton
								href={action}
								variant="ghost"
								color="neutral"
								size="sm"
								mix={[on<HTMLAnchorElement, "click">("click", reset)]}
							>
								Reset
							</LinkButton>
							<Button type="submit" variant="outline" color="neutral" size="sm">
								Apply
							</Button>
						</div>
					</form>

					<p aria-live="polite" mix={[m(0), text("sm"), fg("neutral.muted")]}>
						{iconCountLabel(matching, total, query, version)}
					</p>
					{matching === 0 ? (
						<p mix={[m(0), text("base"), fg("neutral")]}>
							No icon matches “{query.trim()}”.{" "}
							<a href={action} mix={[fg("brand")]}>
								Show every icon
							</a>
						</p>
					) : null}
				</div>
			);
		};
	},
);

/**
 * The picking surface's native inputs: the wheel's hue and the area's two axes. The keyboard
 * moves them on their own, so the form reads them back whenever one changes.
 */
function surfaceInputs(): {
	hue: HTMLInputElement | null;
	saturation: HTMLInputElement | null;
	brightness: HTMLInputElement | null;
} {
	let panel = document.getElementById(COLOR_PANEL_ID);
	return {
		hue:
			panel?.querySelector<HTMLInputElement>('[data-slot="color-wheel"] input[type="range"]') ??
			null,
		saturation: panel?.querySelector<HTMLInputElement>('[data-color-area-axis="x"]') ?? null,
		brightness: panel?.querySelector<HTMLInputElement>('[data-color-area-axis="y"]') ?? null,
	};
}

/** The surface's starting position for `color`, or the opening blue when none is set. */
function toHsv(color: string | null): { h: number; s: number; v: number } {
	let rgb = color === null ? null : parseColor(color);
	return rgb === null ? { ...OPENING_HSV } : rgbToHsv(rgb);
}

/** The text a form field holds, or `null` when the form has no such text field. */
function textField(data: FormData, name: string): string | null {
	let value = data.get(name);
	return typeof value === "string" ? value : null;
}

/** A control's caption, with the slider's readout beside it. */
function ControlLabel(handle: Handle<{ children: RemixNode }>) {
	return () => (
		<span
			mix={[
				hstack({ gap: 2, justify: "between" }),
				text("sm"),
				weight("medium"),
				fg("neutral.emphasis"),
			]}
		>
			{handle.props.children}
		</span>
	);
}

export default IconControls;

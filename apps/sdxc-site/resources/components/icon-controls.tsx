/**
 * Client island: the gallery's filter and customizer, one `GET` form that narrows the grid
 * by `q` and sets the icons' size and stroke. Once script runs, every change applies as it
 * happens: tiles toggle `hidden`, the grid's custom properties change and the address follows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { flexWrap, grid, hstack, vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Button, Checkbox, LinkButton, SearchField, Slider } from "@sdxc/ui";
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

/** What the colour picker shows before the reader picks one, since it cannot show `currentColor`. */
const PICKER_PLACEHOLDER = "#808080";

/**
 * Renders the form and the count above the grid. Without script it submits like any form,
 * so the server renders the narrowed, restyled grid; the colour picker needs script, since a
 * colour input always submits a value and the default is the surrounding text colour.
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
			if (target instanceof HTMLInputElement && target.type === "color") style.color = target.value;

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
			for (let input of form.querySelectorAll<HTMLInputElement>("input")) {
				if (input.name === ICON_STYLE_PARAMS.size) input.value = String(style.size);
				if (input.name === ICON_STYLE_PARAMS.strokeWidth) input.value = String(style.strokeWidth);
				if (input.type === "checkbox") input.checked = false;
				if (input.type === "color") input.value = PICKER_PLACEHOLDER;
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
								<Label>
									Size <Slider.Output>{`${style.size}px`}</Slider.Output>
								</Label>
								<Slider.Track>
									<Slider.Thumb name={ICON_STYLE_PARAMS.size} step={size.step} aria-label="Size" />
								</Slider.Track>
							</Slider>
							<Slider min={stroke.min} max={stroke.max} value={style.strokeWidth}>
								<Label>
									Stroke width <Slider.Output>{`${style.strokeWidth}`}</Slider.Output>
								</Label>
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
							<label mix={[hstack({ gap: 2, align: "center" }), text("sm"), fg("neutral")]}>
								<input type="color" defaultValue={style.color ?? PICKER_PLACEHOLDER} />
								Color
							</label>
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

/** The text a form field holds, or `null` when the form has no such text field. */
function textField(data: FormData, name: string): string | null {
	let value = data.get(name);
	return typeof value === "string" ? value : null;
}

/** A control's caption, with the slider's readout beside it. */
function Label(handle: Handle<{ children: RemixNode }>) {
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

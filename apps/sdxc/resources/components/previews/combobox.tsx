/**
 * Live preview island for `ComboBox`. The field is a real text input with a disclosure
 * button beside it, and every option renders as a reachable row, so the whole list is
 * readable and tabbable before any script arrives. Narrowing that list to the typed text
 * and committing one stable value are the consumer's, so the preview carries the same
 * `comboboxFilter()` wiring a reader would write on the input, inside the
 * `@remix-run/ui/combobox` context that owns the draft text, the popup surface and the option
 * registry — typing hides every zone that does not match by city, country or offset, and
 * picking one writes its IANA id into the hidden input a form submits.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import * as combobox from "@remix-run/ui/combobox";
import { fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { cursor } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { overflowY } from "@sdxc/u/overflow";
import { is, maxBs, maxIs, p } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { ComboBox, Description, Item, Label } from "@sdxc/ui";
import { comboboxFilter } from "@sdxc/ui/mixins";
import { floatingSurface } from "@sdxc/ui/styles";
import { clientEntry } from "remix/component";

/** The zones a scheduling form offers, each searchable by city, country or offset. */
const ZONES = [
	{
		value: "Europe/Madrid",
		label: "Madrid",
		detail: "CEST · UTC+2",
		search: ["madrid", "spain", "utc+2", "cest"],
	},
	{
		value: "Europe/London",
		label: "London",
		detail: "BST · UTC+1",
		search: ["london", "uk", "utc+1", "bst"],
	},
	{
		value: "America/New_York",
		label: "New York",
		detail: "EDT · UTC−4",
		search: ["new york", "nyc", "usa", "utc-4", "edt"],
	},
	{
		value: "America/Sao_Paulo",
		label: "São Paulo",
		detail: "BRT · UTC−3",
		search: ["sao paulo", "brazil", "utc-3", "brt"],
	},
	{
		value: "Asia/Tokyo",
		label: "Tokyo",
		detail: "JST · UTC+9",
		search: ["tokyo", "japan", "utc+9", "jst"],
	},
	{
		value: "Asia/Kolkata",
		label: "Kolkata",
		detail: "IST · UTC+5:30",
		search: ["kolkata", "india", "utc+5:30", "ist"],
	},
	{
		value: "Australia/Sydney",
		label: "Sydney",
		detail: "AEST · UTC+10",
		search: ["sydney", "australia", "utc+10", "aest"],
	},
	{
		value: "Africa/Lagos",
		label: "Lagos",
		detail: "WAT · UTC+1",
		search: ["lagos", "nigeria", "utc+1", "wat"],
	},
];

/** The source the page shows, matching the markup below. */
const CODE = `let committed: string | null = null;

<combobox.Context name="timezone">
	<ComboBox
		mix={[
			is("100%"),
			maxIs("24rem"),
			combobox.onComboboxChange<HTMLDivElement>((event) => {
				committed = event.value;
				void handle.update();
			}),
		]}
	>
		<Label htmlFor="preview-timezone">Time zone</Label>

		<ComboBox.Group>
			<ComboBox.Input
				id="preview-timezone"
				placeholder="Search a city, country or offset"
				mix={[comboboxFilter()]}
			/>
			<ComboBox.Button aria-label="Show every time zone" />
		</ComboBox.Group>

		<div mix={[floatingSurface(), combobox.popover(), p(1), maxBs("13rem"), overflowY("auto")]}>
			<div mix={[vstack({ gap: 0, align: "stretch" }), combobox.list()]}>
				{ZONES.map((zone) => (
					<Item
						key={zone.value}
						mix={[
							rounded("md"),
							cursor("pointer"),
							combobox.option({
								label: zone.label,
								value: zone.value,
								searchValue: zone.search,
							}),
						]}
					>
						<Item.Content>
							<Item.Title>{zone.label}</Item.Title>
							<Item.Description>{zone.detail}</Item.Description>
						</Item.Content>
					</Item>
				))}
			</div>
		</div>

		<input type="hidden" mix={[combobox.hiddenInput()]} />

		<Description id="preview-timezone-hint">
			Meeting invitations are sent in this zone. Submitted value: {committed ?? "none yet"}
		</Description>
	</ComboBox>
</combobox.Context>`;

/** A time-zone field that narrows as you type, hydrated so the draft text drives the list. */
export const ComboBoxPreview = clientEntry(
	import.meta.url,
	function ComboBoxPreview(handle: Handle) {
		let committed: string | null = null;

		return () => (
			<combobox.Context name="timezone">
				<ComboBox
					mix={[
						is("100%"),
						maxIs("24rem"),
						combobox.onComboboxChange<HTMLDivElement>((event) => {
							committed = event.value;
							void handle.update();
						}),
					]}
				>
					<Label htmlFor="preview-timezone">Time zone</Label>

					<ComboBox.Group>
						<ComboBox.Input
							id="preview-timezone"
							placeholder="Search a city, country or offset"
							mix={[comboboxFilter()]}
						/>
						<ComboBox.Button aria-label="Show every time zone" />
					</ComboBox.Group>

					<div
						mix={[floatingSurface(), combobox.popover(), p(1), maxBs("13rem"), overflowY("auto")]}
					>
						<div mix={[vstack({ gap: 0, align: "stretch" }), combobox.list()]}>
							{ZONES.map((zone) => (
								<Item
									key={zone.value}
									mix={[
										rounded("md"),
										cursor("pointer"),
										combobox.option({
											label: zone.label,
											value: zone.value,
											searchValue: zone.search,
										}),
									]}
								>
									<Item.Content>
										<Item.Title>{zone.label}</Item.Title>
										<Item.Description>{zone.detail}</Item.Description>
									</Item.Content>
								</Item>
							))}
						</div>
					</div>

					<input type="hidden" mix={[combobox.hiddenInput()]} />

					<Description id="preview-timezone-hint" mix={[text("sm"), fg("neutral")]}>
						Meeting invitations are sent in this zone. Submitted value: {committed ?? "none yet"}
					</Description>
				</ComboBox>
			</combobox.Context>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: CODE, render: () => <ComboBoxPreview /> };

/**
 * Live preview island for `Popover`. Both surfaces open and close through Invoker
 * Commands on the native Popover API, so what the preview shows is what `popover` mode
 * decides: an `"auto"` filters panel that light-dismisses on an outside click or Escape,
 * and a `"manual"` panel that stays put until its own close button hides it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { InfoIcon, SlidersHorizontalIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { flexWrap, hstack, vstack } from "@sdxc/u/layout";
import { is, m, p } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Button, Header, Input, Label, Popover, Separator } from "@sdxc/ui";
import { clientEntry } from "remix/component";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const CODE = `<Button commandfor="result-filters" command="toggle-popover" variant="outline">
	<SlidersHorizontalIcon />
	Filters
</Button>

<Popover id="result-filters" placement="bottom">
	{/* The surface brings a border, a radius and a shadow; the panel inside brings its
	    own padding, so a menu can still run its rows to the edge. */}
	<div mix={[vstack({ gap: 4, align: "stretch" }), p(4)]}>
		<Header mix={[m(0)]}>Filter results</Header>

		<div mix={[vstack({ gap: 2, align: "stretch" })]}>
			<Label htmlFor="filter-query">Contains</Label>
			<Input id="filter-query" name="query" placeholder="middleware" />
		</div>

		<div mix={[hstack({ gap: 2, align: "end" })]}>
			<div mix={[vstack({ gap: 2, align: "stretch" })]}>
				<Label htmlFor="filter-from">From</Label>
				<Input id="filter-from" name="from" type="date" />
			</div>
			<div mix={[vstack({ gap: 2, align: "stretch" })]}>
				<Label htmlFor="filter-to">To</Label>
				<Input id="filter-to" name="to" type="date" />
			</div>
		</div>

		<Label mix={[hstack({ gap: 2, align: "center" })]}>
			<input type="checkbox" name="archived" />
			Include archived
		</Label>

		<Separator />

		<div mix={[hstack({ gap: 2, justify: "end" })]}>
			<Button commandfor="result-filters" command="hide-popover" variant="ghost" size="sm">
				Cancel
			</Button>
			<Button type="submit" size="sm">
				Apply
			</Button>
		</div>
	</div>
</Popover>

<Button commandfor="retention-note" command="toggle-popover" variant="outline">
	<InfoIcon />
	Why is this limited?
</Button>

{/* "manual" keeps the panel open through an outside click, so a reader can go on
    working with the page while it stays on screen. */}
<Popover id="retention-note" placement="top">
	<div mix={[vstack({ gap: 3, align: "start" }), p(4)]}>
		<p mix={[m(0), text("sm"), weight("medium")]}>Retention</p>
		<p mix={[m(0), text("sm")]}>
			Search reaches back ninety days on this plan. Older records stay exportable.
		</p>
		<Button commandfor="retention-note" command="hide-popover" variant="outline" size="sm">
			Got it
		</Button>
	</div>
</Popover>`;

/** Two popovers, one per dismissal mode, hydrated so the page loads this example's chunk alone. */
export const PopoverPreview = clientEntry(
	"/resources/components/previews/popover.tsx#PopoverPreview",
	function PopoverPreview() {
		return () => (
			<div mix={[hstack({ gap: 3, align: "center", justify: "center" }), flexWrap()]}>
				<Button commandfor="preview-result-filters" command="toggle-popover" variant="outline">
					<SlidersHorizontalIcon />
					Filters
				</Button>

				<Popover id="preview-result-filters" placement="bottom">
					<div mix={[vstack({ gap: 4, align: "stretch" }), is("18rem"), p(4)]}>
						<Header mix={[m(0)]}>Filter results</Header>

						<div mix={[vstack({ gap: 2, align: "stretch" })]}>
							<Label htmlFor="preview-filter-query">Contains</Label>
							<Input id="preview-filter-query" name="query" placeholder="middleware" />
						</div>

						<div mix={[hstack({ gap: 2, align: "end" })]}>
							<div mix={[vstack({ gap: 2, align: "stretch" })]}>
								<Label htmlFor="preview-filter-from">From</Label>
								<Input id="preview-filter-from" name="from" type="date" />
							</div>
							<div mix={[vstack({ gap: 2, align: "stretch" })]}>
								<Label htmlFor="preview-filter-to">To</Label>
								<Input id="preview-filter-to" name="to" type="date" />
							</div>
						</div>

						<Label mix={[hstack({ gap: 2, align: "center" })]}>
							<input type="checkbox" name="archived" />
							Include archived
						</Label>

						<Separator />

						<div mix={[hstack({ gap: 2, justify: "end" })]}>
							<Button
								commandfor="preview-result-filters"
								command="hide-popover"
								variant="ghost"
								size="sm"
							>
								Cancel
							</Button>
							<Button type="submit" size="sm">
								Apply
							</Button>
						</div>
					</div>
				</Popover>

				<Button commandfor="preview-retention-note" command="toggle-popover" variant="outline">
					<InfoIcon />
					Why is this limited?
				</Button>

				{/* "manual" keeps the panel open through an outside click, so a reader can go on
				    working with the page while it stays on screen. */}
				<Popover id="preview-retention-note" placement="top">
					<div mix={[vstack({ gap: 3, align: "start" }), is("16rem"), p(4)]}>
						<p mix={[m(0), text("sm"), weight("medium"), fg("neutral.emphasis")]}>Retention</p>
						<p mix={[m(0), text("sm"), fg("neutral")]}>
							Search reaches back ninety days on this plan. Older records stay exportable.
						</p>
						<Button
							commandfor="preview-retention-note"
							command="hide-popover"
							variant="outline"
							size="sm"
						>
							Got it
						</Button>
					</div>
				</Popover>
			</div>
		);
	},
);

export default { code: CODE, render: () => <PopoverPreview /> };

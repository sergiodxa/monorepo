/**
 * Live example for `Popover` with a pointer arrow and a fade. The surface opens above its
 * trigger through Invoker Commands, `fade()` animates the native `:popover-open` state, and
 * `OverlayArrow` points back at the button, so the whole example runs as plain markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { is, m, p } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Button, OverlayArrow, Popover } from "@sdxc/ui";
import { durations, fade } from "@sdxc/ui/animations";

/** The source the page shows, matching the markup below apart from the example's own sizing. */
const CODE = `<Button commandfor="filters" command="toggle-popover" variant="outline">
	Saved filters
</Button>

<Popover id="filters" placement="top" mix={[fade({ duration: durations.normal })]}>
	<OverlayArrow placement="top">
		<svg width={12} height={12} viewBox="0 0 12 12">
			<path d="M0 0 L6 6 L12 0" />
		</svg>
	</OverlayArrow>
	<div mix={[vstack({ gap: 2, align: "start" }), p(4)]}>
		<p mix={[m(0), text("sm"), weight("medium")]}>Open issues assigned to me</p>
		<p mix={[m(0), text("sm")]}>Last used yesterday. Acme keeps your five most recent filters.</p>
	</div>
</Popover>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Arrow and fade",
	code: CODE,
	render: () => (
		<>
			<Button
				commandfor="example-popover-arrow-and-fade"
				command="toggle-popover"
				variant="outline"
			>
				Saved filters
			</Button>

			<Popover
				id="example-popover-arrow-and-fade"
				placement="top"
				mix={[fade({ duration: durations.normal })]}
			>
				<OverlayArrow placement="top">
					<svg width={12} height={12} viewBox="0 0 12 12">
						<path d="M0 0 L6 6 L12 0" />
					</svg>
				</OverlayArrow>
				<div mix={[vstack({ gap: 2, align: "start" }), is("16rem"), p(4)]}>
					<p mix={[m(0), text("sm"), weight("medium")]}>Open issues assigned to me</p>
					<p mix={[m(0), text("sm")]}>
						Last used yesterday. Acme keeps your five most recent filters.
					</p>
				</div>
			</Popover>
		</>
	),
};

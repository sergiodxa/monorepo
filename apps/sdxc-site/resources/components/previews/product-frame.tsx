/**
 * Live preview for `ProductFrame`: a monitor list in window chrome, staged on a tinted
 * panel with a brand-tinted lift, quiet traffic lights and a caption footer, the way a
 * landing stages its product.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { bs, is, p } from "@sdxc/u/size";
import { font, text, weight } from "@sdxc/u/typography";
import { ProductFrame } from "@sdxc/ui/patterns";

/** The monitors the framed status list shows, with the token each status dot paints. */
const MONITORS = [
	{ host: "api.beacon.dev", detail: "142 ms p95", status: "success" },
	{ host: "app.beacon.dev", detail: "88 ms p95", status: "success" },
	{ host: "eu-west.beacon.dev", detail: "Degraded · 1.2 s p95", status: "warning" },
	{ host: "status.beacon.dev", detail: "61 ms p95", status: "success" },
] as const;

/** The source the page shows, matching the markup below. */
const CODE = `<ProductFrame
	stage="panel"
	shadow="tinted"
	lights
	title="Monitors"
	url="app.beacon.dev"
	footer="Checked from 12 regions every 30 seconds"
>
	<ul>
		{monitors.map((monitor) => (
			<li>
				<span>{monitor.host}</span>
				<span>{monitor.detail}</span>
			</li>
		))}
	</ul>
</ProductFrame>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full")]}>
			<ProductFrame
				stage="panel"
				shadow="tinted"
				lights
				title="Monitors"
				url="app.beacon.dev"
				footer="Checked from 12 regions every 30 seconds"
			>
				<ul
					mix={[
						vstack({ gap: 0, align: "stretch" }),
						raw({ listStyle: "none", margin: "0" }),
						p(2),
					]}
				>
					{MONITORS.map((monitor) => (
						<li
							mix={[
								hstack({ gap: 3, align: "center", justify: "between" }),
								p(2.5, 3),
								rounded("md"),
							]}
						>
							<span mix={[hstack({ gap: 2.5, align: "center" })]}>
								<span
									aria-hidden="true"
									mix={[
										is(2),
										bs(2),
										rounded("full"),
										raw({ backgroundColor: `var(--ui-${monitor.status}-bg-solid)` }),
									]}
								/>
								<span mix={[text("sm"), weight("medium"), fg("neutral.emphasis")]}>
									{monitor.host}
								</span>
							</span>
							<span mix={[font("mono"), text("xs"), fg("neutral.muted")]}>{monitor.detail}</span>
						</li>
					))}
				</ul>
			</ProductFrame>
		</div>
	),
};

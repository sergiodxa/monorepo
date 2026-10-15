/**
 * Live preview island for `Badge`. A badge is a static chip: the tone and weight come
 * from `color` and `variant`, and the icon slot keeps a glyph from shifting the label.
 * What a reader needs is the vocabulary side by side, so the example shows the two jobs
 * a badge actually does — a run's state, and the labels filed against an issue.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { CircleCheckIcon, CircleXIcon, ClockIcon, ZapIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { flexWrap, hstack, vstack } from "@sdxc/u/layout";
import { text, weight } from "@sdxc/u/typography";
import { Badge } from "@sdxc/ui";
import { clientEntry } from "remix/component";

/** The source the page shows, matching the markup below. */
const CODE = `<div mix={[vstack({ gap: 5, align: "start" })]}>
	<div mix={[vstack({ gap: 2, align: "start" })]}>
		<span mix={[text("xs"), weight("semibold"), fg("neutral.muted")]}>Pipeline</span>
		<div mix={[hstack({ gap: 2, align: "center" }), flexWrap()]}>
			<Badge color="success" variant="secondary">
				<Badge.Icon>
					<CircleCheckIcon />
				</Badge.Icon>
				<Badge.Text>Tests passing</Badge.Text>
			</Badge>
			<Badge color="warning" variant="secondary">
				<Badge.Icon>
					<ClockIcon />
				</Badge.Icon>
				<Badge.Text>Deploy queued</Badge.Text>
			</Badge>
			<Badge color="danger" variant="secondary">
				<Badge.Icon>
					<CircleXIcon />
				</Badge.Icon>
				<Badge.Text>3 checks failed</Badge.Text>
			</Badge>
			<Badge color="neutral" variant="outline">
				Skipped
			</Badge>
			<Badge color="brand">
				<Badge.Icon>
					<ZapIcon />
				</Badge.Icon>
				<Badge.Text>v2026.9.21</Badge.Text>
			</Badge>
		</div>
	</div>

	<div mix={[vstack({ gap: 2, align: "start" })]}>
		<span mix={[text("xs"), weight("semibold"), fg("neutral.muted")]}>Labels</span>
		<div mix={[hstack({ gap: 2, align: "center" }), flexWrap()]}>
			<Badge color="brand" variant="outline">
				enhancement
			</Badge>
			<Badge color="danger" variant="outline">
				regression
			</Badge>
			<Badge color="warning" variant="outline">
				needs repro
			</Badge>
			<Badge color="neutral" variant="secondary">
				good first issue
			</Badge>
		</div>
	</div>
</div>`;

/** A run's state and an issue's labels, hydrated the way every preview here loads. */
export const BadgePreview = clientEntry(import.meta.url, function BadgePreview() {
	return () => (
		<div mix={[vstack({ gap: 5, align: "start" })]}>
			<div mix={[vstack({ gap: 2, align: "start" })]}>
				<span mix={[text("xs"), weight("semibold"), fg("neutral.muted")]}>Pipeline</span>
				<div mix={[hstack({ gap: 2, align: "center" }), flexWrap()]}>
					<Badge color="success" variant="secondary">
						<Badge.Icon>
							<CircleCheckIcon />
						</Badge.Icon>
						<Badge.Text>Tests passing</Badge.Text>
					</Badge>
					<Badge color="warning" variant="secondary">
						<Badge.Icon>
							<ClockIcon />
						</Badge.Icon>
						<Badge.Text>Deploy queued</Badge.Text>
					</Badge>
					<Badge color="danger" variant="secondary">
						<Badge.Icon>
							<CircleXIcon />
						</Badge.Icon>
						<Badge.Text>3 checks failed</Badge.Text>
					</Badge>
					<Badge color="neutral" variant="outline">
						Skipped
					</Badge>
					<Badge color="brand">
						<Badge.Icon>
							<ZapIcon />
						</Badge.Icon>
						<Badge.Text>v2026.9.21</Badge.Text>
					</Badge>
				</div>
			</div>

			<div mix={[vstack({ gap: 2, align: "start" })]}>
				<span mix={[text("xs"), weight("semibold"), fg("neutral.muted")]}>Labels</span>
				<div mix={[hstack({ gap: 2, align: "center" }), flexWrap()]}>
					<Badge color="brand" variant="outline">
						enhancement
					</Badge>
					<Badge color="danger" variant="outline">
						regression
					</Badge>
					<Badge color="warning" variant="outline">
						needs repro
					</Badge>
					<Badge color="neutral" variant="secondary">
						good first issue
					</Badge>
				</div>
			</div>
		</div>
	);
});

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: CODE, render: () => <BadgePreview /> };

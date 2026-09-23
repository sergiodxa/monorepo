/**
 * Live preview island for `Spinner`. The component draws the glyph and holds it
 * still, so the rotation is the `spin()` factory a reader composes through `mix` —
 * without it the indicator sits motionless. The example shows the three places an
 * app reaches for one: a pending button, an inline status row, and a panel that is
 * still fetching, each at the size that spot calls for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack, vstack } from "@sdxc/u/layout";
import { is, p } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Button, Card, Spinner, Text } from "@sdxc/ui";
import { spin } from "@sdxc/ui/animations";
import { clientEntry } from "remix/ui";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const SPINNER_CODE = `<Button isPending parts={{ spinner: [spin()] }}>
	Publishing
</Button>

<div mix={[hstack({ gap: 2, align: "center" })]}>
	<Spinner size="sm" mix={[spin()]} aria-label="Checking the domain" />
	<Text>Checking DNS for sergiodxa.com…</Text>
</div>

<Card>
	<Card.Content>
		<Spinner color="brand" size="lg" mix={[spin({ duration: "900ms" })]} aria-label="Loading usage" />
		<Text>Loading this month's usage</Text>
	</Card.Content>
</Card>`;

/** Three sizes of busy indicator, hydrated so each one actually rotates. */
export const SpinnerPreview = clientEntry(
	"/resources/components/previews/spinner.tsx#SpinnerPreview",
	function SpinnerPreview() {
		return () => (
			<div mix={[vstack({ gap: 5, align: "center" })]}>
				<Button isPending parts={{ spinner: [spin()] }}>
					Publishing
				</Button>

				<div mix={[hstack({ gap: 2, align: "center" })]}>
					<Spinner size="sm" mix={[spin()]} aria-label="Checking the domain" />
					<Text>Checking DNS for sergiodxa.com…</Text>
				</div>

				<Card mix={[is("16rem")]}>
					<Card.Content mix={[vstack({ gap: 3, align: "center" }), p(2)]}>
						<Spinner
							color="brand"
							size="lg"
							mix={[spin({ duration: "900ms" })]}
							aria-label="Loading usage"
						/>
						<Text mix={[text("sm")]}>Loading this month&rsquo;s usage</Text>
					</Card.Content>
				</Card>
			</div>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: SPINNER_CODE, render: () => <SpinnerPreview /> };

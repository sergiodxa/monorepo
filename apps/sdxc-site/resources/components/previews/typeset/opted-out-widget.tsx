/**
 * Live example for `Typeset` holding a component that keeps its own styles. A subtree
 * marked `data-not-typeset` drops out of the layer, so the card inside a docs page draws
 * as a card rather than as prose; the markup is static and needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is, maxIs } from "@sdxc/u/size";
import { Button, Card, Typeset } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Typeset mix={[is("100%"), maxIs("28rem")]}>
	<p>
		Every check runs from three regions. Add your first one below and Acme starts watching it
		within a minute.
	</p>
	<div data-not-typeset>
		<Card>
			<Card.Header>
				<Card.Title>New check</Card.Title>
				<Card.Description>https://api.acme.dev/health, every 60 seconds</Card.Description>
			</Card.Header>
			<Card.Footer>
				<Button size="sm">Create check</Button>
			</Card.Footer>
		</Card>
	</div>
</Typeset>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Opted-out widget",
	code: CODE,
	render: () => (
		<Typeset mix={[is("100%"), maxIs("28rem")]}>
			<p>
				Every check runs from three regions. Add your first one below and Acme starts watching it
				within a minute.
			</p>
			<div data-not-typeset>
				<Card>
					<Card.Header>
						<Card.Title>New check</Card.Title>
						<Card.Description>https://api.acme.dev/health, every 60 seconds</Card.Description>
					</Card.Header>
					<Card.Footer>
						<Button size="sm">Create check</Button>
					</Card.Footer>
				</Card>
			</div>
		</Typeset>
	),
};

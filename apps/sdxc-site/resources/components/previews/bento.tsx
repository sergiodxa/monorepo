/**
 * Live preview for `Bento`: three equal cells with a title and a line of body each, the
 * way a landing summarizes what a product covers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "@sdxc/u/size";
import { HeadingScope } from "@sdxc/ui";
import { Bento } from "@sdxc/ui/patterns";

/** The source the page shows, matching the markup below. */
const CODE = `<Bento columns={3}>
	<Bento.Cell>
		<Bento.Title>Uptime checks</Bento.Title>
		<Bento.Body>HTTP, TCP and DNS probes every thirty seconds.</Bento.Body>
	</Bento.Cell>
	<Bento.Cell>
		<Bento.Title>Status pages</Bento.Title>
		<Bento.Body>Publish incidents on your own domain.</Bento.Body>
	</Bento.Cell>
	<Bento.Cell>
		<Bento.Title>On-call</Bento.Title>
		<Bento.Body>Route alerts to whoever holds the pager.</Bento.Body>
	</Bento.Cell>
</Bento>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full")]}>
			<HeadingScope>
				<Bento columns={3}>
					<Bento.Cell>
						<Bento.Title>Uptime checks</Bento.Title>
						<Bento.Body>HTTP, TCP and DNS probes every thirty seconds.</Bento.Body>
					</Bento.Cell>
					<Bento.Cell>
						<Bento.Title>Status pages</Bento.Title>
						<Bento.Body>Publish incidents on your own domain.</Bento.Body>
					</Bento.Cell>
					<Bento.Cell>
						<Bento.Title>On-call</Bento.Title>
						<Bento.Body>Route alerts to whoever holds the pager.</Bento.Body>
					</Bento.Cell>
				</Bento>
			</HeadingScope>
		</div>
	),
};

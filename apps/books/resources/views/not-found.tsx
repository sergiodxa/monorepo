/**
 * View for the 404 page. Renders the status and a one-line explanation,
 * matching the plain treatment the site has always given a missing URL: on
 * this four-page site, the footer's links already reach everywhere a
 * visitor might go.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { vstack } from "@pkg/u/layout";
import { is, maxIs, p, pbs } from "@pkg/u/size";
import { text, weight } from "@pkg/u/typography";

namespace NotFoundView {
	export interface Props {
		/** The heading, e.g. `"404"`. */
		title: string;
		/** The one-line explanation under it. */
		description: string;
	}
}

/** Renders the 404 page. */
export default function NotFoundView(handle: Handle<NotFoundView.Props>) {
	return () => {
		let { description, title } = handle.props;

		return (
			<main mix={[vstack({ gap: 2.5 }), is("100%"), maxIs("64rem"), p(4), pbs(16)]}>
				<h1 mix={[text("3xl"), weight("light")]}>{title}</h1>
				<p>{description}</p>
			</main>
		);
	};
}

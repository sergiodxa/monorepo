/**
 * The book's wordmark: its short title in the serif, led by a small red bracket drawn like
 * the redirect arrow of an OAuth2 flow, linking home to the book's landing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack } from "@sdxc/u/layout";
import { font, nowrap, tracking } from "@sdxc/u/typography";

namespace Wordmark {
	export interface Props {
		/** Where the mark links: the book's landing. */
		href: string;
		/** The book's short title, which is also the link's accessible name. */
		title: string;
	}
}

/**
 * Renders the linked mark. The arrow is decorative, so the link's name is the title alone.
 *
 * @param handle Runtime handle carrying the link and title.
 * @returns The render function producing the linked mark.
 */
export default function Wordmark(handle: Handle<Wordmark.Props>) {
	return () => (
		<a
			href={handle.props.href}
			mix={[
				hstack({ gap: 2, align: "center" }),
				fg("neutral.emphasis"),
				font("display"),
				tracking("tight"),
				nowrap(),
				raw({ fontSize: "1.25rem", lineHeight: "1", textDecoration: "none" }),
			]}
		>
			<svg
				viewBox="0 0 24 16"
				width="24"
				height="16"
				aria-hidden="true"
				mix={[fg("brand"), raw({ flexShrink: "0" })]}
			>
				<path
					d="M2 8h18M15 3l5 5-5 5"
					stroke="currentColor"
					stroke-width="1.75"
					fill="none"
					stroke-linecap="square"
				/>
			</svg>
			<span>{handle.props.title}</span>
		</a>
	);
}

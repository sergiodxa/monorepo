/**
 * The one muted line closing every documentation page: who wrote it, where to follow
 * them, and where to fund the work. It sits under the pager, after the reader is done
 * with the page, so the ask reaches the people the page just helped.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { m } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { text } from "@sdxc/u/typography";

import {
	AUTHOR_NAME,
	AUTHOR_URL,
	AUTHOR_X_HANDLE,
	AUTHOR_X_URL,
	SPONSOR_URL,
} from "~/app/services/site";

/** Renders the credit line. */
export default function AuthorNote(_handle: Handle) {
	return () => (
		<p mix={[m("2.5rem", 0, 0, 0), text("sm"), fg("neutral.muted")]}>
			Written by{" "}
			<a href={AUTHOR_URL} mix={[fg("neutral"), when("&:hover", fg("brand"))]}>
				{AUTHOR_NAME}
			</a>
			. Follow{" "}
			<a href={AUTHOR_X_URL} rel="noreferrer" mix={[fg("neutral"), when("&:hover", fg("brand"))]}>
				{AUTHOR_X_HANDLE}
			</a>{" "}
			for new packages, or{" "}
			<a href={SPONSOR_URL} rel="noreferrer" mix={[fg("neutral"), when("&:hover", fg("brand"))]}>
				sponsor the work
			</a>
			.
		</p>
	);
}

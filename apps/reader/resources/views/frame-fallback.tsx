/**
 * What stands in for a part of a page that did not load. Any frame can fail — a fragment
 * of the chrome, a page of posts — and none of them has anything different to tell the
 * reader about it, so there is one of these rather than one per caller.
 *
 * It reads as a gap rather than as a crash: the rest of the page arrived and is fine, so
 * this is a note the width of whatever was missing rather than a page-level failure. What
 * went wrong goes to the log, where somebody can act on it; a status line or a thrown
 * message is news about the server rather than about the reading.
 *
 * Every string arrives translated, so the dictionary stays with the request.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { flex, flexWrap, gap, items } from "@sdxc/u/layout";
import { p } from "@sdxc/u/size";
import { Alert, LinkButton } from "@sdxc/ui";

export namespace FrameFallback {
	export interface Props {
		/** The sentence saying a piece of the page is missing rather than empty. */
		message: string;
		/** What the way on is called. */
		retryLabel: string;
		/**
		 * The document this frame sits in, which is what asking again means: the frame's own
		 * address answers a fragment, so it is the page around it that is fetched afresh.
		 */
		retryHref: string;
	}
}

/** Renders the note a failed frame leaves in place of its content. */
export default function FrameFallback(handle: Handle<FrameFallback.Props>) {
	return () => {
		let { message, retryHref, retryLabel } = handle.props;

		return (
			/**
			 * Announced, since it stands where a reader was expecting something else. A warning
			 * rather than a failure: one region is missing and the page around it is whole.
			 */
			<Alert
				role="status"
				color="warning"
				mix={[flex(), items("center"), flexWrap("wrap"), gap(2), p(2, 3)]}
			>
				<Alert.Description>{message}</Alert.Description>
				<Alert.Action>
					{/**
					 * Left to the browser to navigate: the page comes back as a new document with
					 * every frame on it asked for again, which is what the reader is after.
					 */}
					<LinkButton
						href={retryHref}
						data-rmx-document=""
						color="neutral"
						variant="outline"
						size="sm"
					>
						{retryLabel}
					</LinkButton>
				</Alert.Action>
			</Alert>
		);
	};
}

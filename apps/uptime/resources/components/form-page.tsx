/**
 * Centers a page's primary form in a readable-width column instead of
 * stretching across the full content area next to the sidebar, so the
 * width isn't repeated as a literal across every create/edit controller. A
 * form needing extra room passes {@link FormPage.Props.maxWidth} instead
 * of opting out of the wrapper.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SizeValue } from "@pkg/u/tokens";
import type { Handle, RemixNode } from "remix/ui";

import { is, maxIs, mi } from "@pkg/u/size";

/** Column width used when a page doesn't ask for a wider one. */
const DEFAULT_MAX_WIDTH: SizeValue = "640px";

namespace FormPage {
	export interface Props {
		children: RemixNode;
		/** Widest the column is allowed to grow. Defaults to {@link DEFAULT_MAX_WIDTH}. */
		maxWidth?: SizeValue;
	}
}

/** Wraps `children` in a capped-width column, centered within the page's content area. */
export default function FormPage(handle: Handle<FormPage.Props>) {
	return () => (
		<div mix={[is("full"), maxIs(handle.props.maxWidth ?? DEFAULT_MAX_WIDTH), mi("auto")]}>
			{handle.props.children}
		</div>
	);
}

/**
 * The request context a CMS view reads its shell state from, or `null` when the view renders
 * outside a request, as a test rendering one view does. Every read of shell state goes through
 * it, so such a render draws the frame without counts, toasts or a signed-in author.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, wrap } from "@sdxc/result";
import { getContext } from "remix/middleware/async-context";

/** The context of the request being handled, or `null` outside one. */
export function currentRequest(): ReturnType<typeof getContext> | null {
	let context = wrap(() => getContext());
	return isFailure(context) ? null : context.data;
}

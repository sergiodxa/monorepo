/**
 * Centers a page's primary form (plus anything below it, like a cancel link or a
 * danger-zone section) in a readable-width column instead of letting it stretch
 * across the full content area next to the sidebar. Every simple create/edit page
 * controller (monitors, alerts, cron jobs, DNS/TCP monitors, maintenance windows,
 * status pages, API keys) renders its `<form>` inside this as the sole child of
 * `AppShell`, matching the width `resources/layouts/app-shell.tsx`'s settings page
 * already uses for its sections. It exists so that width doesn't get repeated as a
 * literal across every one of those controller files.
 *
 * Reviewed as part of the `@pkg/r3-ui` migration and intentionally left as a
 * plain composed `<div>`: it carries no color (nothing to route through
 * `--ui-*` custom properties) and `@pkg/r3-ui`'s `Section`/`Group` primitives
 * are shaped for listbox groups and control clusters, not a centered
 * max-width content column, so reaching for either here would force-fit an
 * ill-suited abstraction rather than simplify anything.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { is, maxIs, mi } from "@pkg/u/size";

namespace FormPage {
	export interface Props {
		children: RemixNode;
	}
}

/** Wraps `children` in a 640px-wide column, centered within the page's content area. */
export default function FormPage(handle: Handle<FormPage.Props>) {
	return () => <div mix={[is("full"), maxIs("640px"), mi("auto")]}>{handle.props.children}</div>;
}

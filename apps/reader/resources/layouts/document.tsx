/**
 * Root HTML document layout. It renders the outer html/head/body shell — charset and
 * viewport meta, the page title and description, the design-system stylesheets in
 * derivation order, and the client entry script. Every server-rendered page composes into
 * it, so a page decides only its own content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { bg, fg } from "@sdxc/u/color";
import { m, minBs } from "@sdxc/u/size";
import { font } from "@sdxc/u/typography";
import resetStyles from "@sdxc/ui/reset.css?url";
import themeStyles from "@sdxc/ui/theme.css?url";

import colorStyles from "~/resources/css/colors.css?url";

/**
 * The dev server serves the entry from source while the build emits it under a pinned
 * name, so the tag resolves without reading a manifest at render time.
 */
const CLIENT_ENTRY_SRC = import.meta.env.DEV ? "/bootstrap/browser.ts" : "/assets/clientEntry.js";

namespace DocumentLayout {
	export interface Props {
		/** The page's content, rendered inside `<body>`. */
		children: RemixNode;
		/** The document title. */
		title: string;
		/** Meta description for this page. */
		description?: string;
		/** The request's detected language (`ctx.locale`), set as `<html lang>`. */
		locale?: string;
	}
}

/**
 * Renders the outer `<html>`/`<head>`/`<body>` shell around `children`. The client entry
 * loads `async`, so a non-blocking Frame's `<template>` is picked up as soon as its chunk
 * of the streamed response arrives.
 */
export default function DocumentLayout(handle: Handle<DocumentLayout.Props>) {
	return () => {
		let { children, description, locale = "en", title } = handle.props;

		return (
			<html lang={locale} class="system">
				<head>
					<meta charSet="utf-8" data-key="charset" />
					<meta name="viewport" content="width=device-width, initial-scale=1" data-key="viewport" />
					<title data-key="title">{title}</title>
					{description ? (
						<meta name="description" content={description} data-key="description" />
					) : null}
					<link rel="modulepreload" href={CLIENT_ENTRY_SRC} data-key="entry-preload" />
					<link rel="stylesheet" href={resetStyles} data-key="style-reset" />
					<link rel="stylesheet" href={colorStyles} data-key="style-colors" />
					<link rel="stylesheet" href={themeStyles} data-key="style-theme" />
				</head>
				<body
					mix={[m(0), minBs("100dvh"), bg("neutral.bg-tint"), fg("neutral.emphasis"), font("sans")]}
				>
					{children}
					<script type="module" async src={CLIENT_ENTRY_SRC}></script>
				</body>
			</html>
		);
	};
}

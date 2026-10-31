/**
 * Mounts a page's body in a browser test the way the document layout serves it: every
 * stylesheet the layout links, the body's paper and ink, the scheme on the root element,
 * and the public images reachable, so layout and colour read as a visitor sees them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { RenderResult } from "remix/component/test";

import { raw } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { minBs } from "@sdxc/u/size";
import { font } from "@sdxc/u/typography";
import { render } from "remix/component/test";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";
import "~/resources/css/marketing.css";
import "@sdxc/highlight/styles.css";
import "~/resources/css/highlight.css";

/**
 * The app's `public/` folder as the test server serves it: by its path under the project
 * root, since the browser project's own public folder holds only the mock service worker.
 */
const PUBLIC_DIR = "/public/";

/** The colour scheme a page is mounted in. */
export type Scheme = "light" | "dark";

/**
 * Renders `page` inside a body styled like the document layout's, in `scheme`. Image paths
 * under `/` are pointed at the app's `public/` folder, which the test server serves by path.
 *
 * @param page - The header, main and footer the page renders.
 * @param scheme - Light, or the theme's forced dark.
 * @returns The mounted result, once rendered, to clean up after the test.
 */
export async function mountPage(page: RemixNode, scheme: Scheme = "light"): Promise<RenderResult> {
	document.documentElement.className = scheme === "dark" ? "dark" : "";
	document.documentElement.style.colorScheme = scheme;
	document.body.style.margin = "0";

	let mounted = render(
		<div
			mix={[
				vstack({ align: "stretch" }),
				minBs("100dvh"),
				font("sans"),
				raw({ backgroundColor: "var(--ui-bg)", color: "var(--ui-neutral-fg-emphasis)" }),
			]}
		>
			{page}
		</div>,
	);

	await new Promise(requestAnimationFrame);
	for (let image of mounted.container.querySelectorAll("img")) {
		let src = image.getAttribute("src");
		if (src?.startsWith("/")) image.setAttribute("src", `${PUBLIC_DIR}${src.slice(1)}`);
	}

	document.body.style.backgroundColor = getComputedStyle(
		mounted.container.firstElementChild ?? document.body,
	).backgroundColor;

	return mounted;
}

/**
 * Waits for every image in `root` to load or fail, so a measurement or screenshot sees
 * the layout the images settle into.
 *
 * @param root - The subtree whose images to wait for.
 */
export async function imagesSettled(root: Element): Promise<void> {
	await Promise.all(
		[...root.querySelectorAll("img")].map((image) =>
			image.complete
				? Promise.resolve()
				: new Promise((resolve) => {
						image.addEventListener("load", resolve, { once: true });
						image.addEventListener("error", resolve, { once: true });
					}),
		),
	);
}

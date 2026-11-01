/**
 * The development login screen: who the one button signs in as, and that the first sign-in
 * writes sample content, so a local run reaches the CMS without the external provider.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";

import { border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { flex, flexCol, gap, items } from "@sdxc/u/layout";
import { m, maxIs, minBs, p } from "@sdxc/u/size";
import { font, textAlign } from "@sdxc/u/typography";
import { Button, Heading } from "@sdxc/ui";

import { DEV_ADMIN } from "~/config/dev-user";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/**
 * Renders the screen; it takes no model, since the account it names is fixed.
 *
 * @returns A view function the renderer calls with the document's assets.
 */
export function DevLoginView() {
	return ({ assets }: { assets: DocumentAssets }) => (
		<DocumentLayout assets={assets} title="Development login" bodyMix={[m(0), font("sans")]}>
			<main mix={[flex(), flexCol(), items("center"), minBs("100vh"), p(16, 4)]}>
				<div
					mix={[
						flex(),
						flexCol(),
						items("center"),
						textAlign("center"),
						gap(3),
						p(12, 8),
						maxIs("32rem"),
						border({ color: "neutral", width: 1, style: "dashed" }),
						rounded("12px"),
					]}
				>
					<Heading level={1} mix={[m(0)]}>
						Development login
					</Heading>
					<p mix={[m(0), fg("neutral.muted")]}>
						Signs in as {DEV_ADMIN.email}, the CMS admin. The first sign-in writes sample posts,
						bookmarks, glossary terms, redirects and Webmentions.
					</p>
					<form method="post" action={routes.devLogin.action.href()}>
						<Button type="submit" color="brand">
							Sign in as {DEV_ADMIN.displayName}
						</Button>
					</form>
				</div>
			</main>
		</DocumentLayout>
	);
}

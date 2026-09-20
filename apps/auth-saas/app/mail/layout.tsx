/**
 * The shell every hosted-flow message is written inside: the unbranded card from
 * `@sdxc/mail`, closed with a footer line naming the tenant the mail is from. Every
 * message reuses this rather than `Email.Layout` directly, so a later per-tenant brand
 * record has one place to paint from instead of every message class of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@sdxc/i18n";
import type { Handle, RemixNode } from "remix/ui";

import { Email } from "@sdxc/mail";

export namespace AuthMailLayout {
	export interface Props {
		title: string;
		preview: string;
		tenantName: string;
		t: TFunction;
		children?: RemixNode;
	}
}

/**
 * Wraps a message's content in the shared card, appending the one footer line every
 * message ends with.
 *
 * @param handle - Component handle exposing the layout's props.
 * @returns A render function producing the message's document.
 */
export function AuthMailLayout(handle: Handle<AuthMailLayout.Props>) {
	return () => {
		let { title, preview, tenantName, t, children } = handle.props;

		return (
			<Email.Layout title={title} preview={preview}>
				{children}
				<Email.Footer>{t("mail.footer", { tenantName })}</Email.Footer>
			</Email.Layout>
		);
	};
}

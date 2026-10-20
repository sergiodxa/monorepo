/**
 * The shell every hosted-flow message is written inside: the unbranded card from
 * `@sdxc/mail`, closed with a footer line naming the tenant the mail is from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle, RemixNode } from "remix/component";

import { Email } from "@sdxc/mail";

export namespace AuthMailLayout {
	export interface Props {
		title: string;
		preview: string;
		tenantName: string;
		t: Translate;
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

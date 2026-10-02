/**
 * The "post a job" modal: one form that POSTs to the board, inside a native dialog. The
 * browser submits it as a whole document, so a published posting lands on a fresh board with
 * the dialog closed, and a refused one reopens it through the platform's own `open` attribute.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { I18n } from "@sdxc/i18n";
import type { Handle } from "remix/component";

import { TurnstileWidget } from "@sdxc/captcha/turnstile/ui";
import { raw } from "@sdxc/u/general";
import { gap, grid, gridColumn, gridTemplate, vstack } from "@sdxc/u/layout";
import { when } from "@sdxc/u/state";
import { Alert, Button, Dialog, Form, Label, TextArea, TextField } from "@sdxc/ui";

import { LOCAL_ANSWER, LOCAL_FIELD } from "~/app/lib/captcha";
import routes from "~/routes/web";

/** The `id` the board's trigger names in `commandfor`. */
export const POST_FORM_DIALOG_ID = "post-a-job";

/** The `id` the dialog points `aria-labelledby` at, so the modal is named by its own title. */
const TITLE_ID = `${POST_FORM_DIALOG_ID}-title`;

/** The `id` wiring the description field's label to the textarea it names. */
const DESCRIPTION_ID = `${POST_FORM_DIALOG_ID}-description`;

namespace PostForm {
	export interface Props {
		/** Translator for the language this page is rendered in. */
		intl: I18n;
		/** Turnstile site key, or `null` when the board runs on the local challenge. */
		siteKey: string | null;
		/** Why the last submission was refused, shown above the fields. */
		error?: string;
	}
}

/**
 * Renders the submit dialog, open when the last submission was refused. A dialog carrying
 * the `open` attribute is laid out in the page's flow and gets no `::backdrop`, so the
 * reopened panel centers itself in the viewport and spreads one very large shadow over the
 * page behind it: the visitor gets back the panel they submitted from, with no script.
 */
export default function PostForm(handle: Handle<PostForm.Props>) {
	return () => {
		let { error, intl, siteKey } = handle.props;

		return (
			<Dialog
				id={POST_FORM_DIALOG_ID}
				open={Boolean(error)}
				aria-labelledby={TITLE_ID}
				mix={[
					when(
						"&[open]:not(:modal)",
						raw({
							position: "fixed",
							insetBlock: "0",
							insetInline: "0",
							margin: "auto",
							zIndex: "1",
							boxShadow: "0 0 0 100vmax rgb(0 0 0 / 0.5)",
						}),
					),
				]}
			>
				<Dialog.Header>
					<Dialog.Title id={TITLE_ID}>{intl.t("form.title")}</Dialog.Title>
					<Dialog.Description>{intl.t("form.tagline")}</Dialog.Description>
				</Dialog.Header>

				<Form method="post" action={routes.board.action.href()} data-rmx-document>
					{error ? (
						<Alert color="danger" live="assertive">
							<Alert.Description>{error}</Alert.Description>
						</Alert>
					) : null}

					<div mix={[grid(), gridTemplate({ columns: "repeat(2, minmax(0, 1fr))" }), gap(4)]}>
						<TextField name="title" label={intl.t("form.titleField")} required />
						<TextField name="company" label={intl.t("form.company")} required />
						<TextField name="location" label={intl.t("form.location")} required />
						<TextField name="salary" label={intl.t("form.salary")} required />
						<TextField
							name="contact_email"
							type="email"
							label={intl.t("form.email")}
							required
							mix={[gridColumn("1 / -1")]}
						/>

						<div mix={[vstack({ gap: 1.5 }), gridColumn("1 / -1")]}>
							<Label htmlFor={DESCRIPTION_ID}>{intl.t("form.description")}</Label>
							<TextArea id={DESCRIPTION_ID} name="description" rows={4} required />
						</div>

						{siteKey ? (
							<div mix={[gridColumn("1 / -1")]}>
								<TurnstileWidget siteKey={siteKey} />
							</div>
						) : (
							<TextField
								name={LOCAL_FIELD}
								label={intl.t("form.captcha", { answer: LOCAL_ANSWER })}
								required
								mix={[gridColumn("1 / -1")]}
							/>
						)}
					</div>

					<Dialog.Footer>
						<Button
							type="button"
							commandfor={POST_FORM_DIALOG_ID}
							command="close"
							variant="outline"
							color="neutral"
						>
							{intl.t("posting.close")}
						</Button>
						<Button type="submit" color="brand">
							{intl.t("form.submit")}
						</Button>
					</Dialog.Footer>
				</Form>

				<Dialog.Close commandfor={POST_FORM_DIALOG_ID} aria-label={intl.t("posting.close")} />
			</Dialog>
		);
	};
}

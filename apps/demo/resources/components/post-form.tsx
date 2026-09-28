/**
 * The "post a job" modal: a native `<dialog>` holding one plain form that POSTs to the
 * board. It reopens itself when a submission was refused, so the visitor sees the reason
 * next to the fields they filled in without a line of script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { I18n } from "@sdxc/i18n";
import type { Handle } from "remix/ui";

import { TurnstileWidget } from "@sdxc/captcha/turnstile/ui";
import { vstack } from "@sdxc/u/layout";
import { is, maxIs, p } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";

import { LOCAL_ANSWER, LOCAL_FIELD } from "~/app/lib/captcha";
import routes from "~/routes/web";

/** The `id` the board's trigger names in `commandfor`. */
export const POST_FORM_DIALOG_ID = "post-a-job";

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

/** One labelled text field, since the form is four of them before anything else. */
function Field(handle: Handle<{ name: string; label: string }>) {
	return () => {
		let { label, name } = handle.props;

		return (
			<label mix={[vstack({ gap: 1 })]}>
				<span mix={[text("sm")]}>{label}</span>
				<input name={name} type="text" required mix={[is("100%")]} />
			</label>
		);
	};
}

/** Renders the submit dialog, open when the last submission was refused. */
export default function PostForm(handle: Handle<PostForm.Props>) {
	return () => {
		let { error, intl, siteKey } = handle.props;

		return (
			<dialog
				id={POST_FORM_DIALOG_ID}
				open={Boolean(error)}
				mix={[is("100%"), maxIs("40rem"), p(6)]}
			>
				<form method="post" action={routes.board.action.href()} mix={[vstack({ gap: 3 })]}>
					<h2 mix={[text("xl"), weight("medium")]}>{intl.t("form.title")}</h2>
					{error ? <p role="alert">{error}</p> : null}

					<Field name="title" label={intl.t("form.titleField")} />
					<Field name="company" label={intl.t("form.company")} />
					<Field name="location" label={intl.t("form.location")} />
					<Field name="salary" label={intl.t("form.salary")} />
					<label mix={[vstack({ gap: 1 })]}>
						<span mix={[text("sm")]}>{intl.t("form.email")}</span>
						<input name="contact_email" type="email" required mix={[is("100%")]} />
					</label>

					<label mix={[vstack({ gap: 1 })]}>
						<span mix={[text("sm")]}>{intl.t("form.description")}</span>
						<textarea name="description" rows={6} required mix={[is("100%")]} />
					</label>

					{siteKey ? (
						<TurnstileWidget siteKey={siteKey} />
					) : (
						<label mix={[vstack({ gap: 1 })]}>
							<span mix={[text("sm")]}>{intl.t("form.captcha", { answer: LOCAL_ANSWER })}</span>
							<input name={LOCAL_FIELD} type="text" required mix={[is("100%")]} />
						</label>
					)}

					<button type="submit">{intl.t("form.submit")}</button>
					<button type="button" commandfor={POST_FORM_DIALOG_ID} command="close">
						{intl.t("posting.close")}
					</button>
				</form>
			</dialog>
		);
	};
}

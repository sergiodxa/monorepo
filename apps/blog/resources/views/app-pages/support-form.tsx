/**
 * The support form an app's support page carries, on a card in the app's own look: the
 * alert for whichever state the controller reached, the request's fields, the honeypot and
 * the submit button, or the confirmation once a request is sent. Every state but `sent`
 * keeps the visitor's values, and the first invalid field takes focus.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Honeypot } from "@sdxc/honeypot";
import type { Handle } from "remix/component";

import { HoneypotFields } from "@sdxc/honeypot/ui";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { container, flexWrap, gap, grid, gridTemplate, hstack, repeat } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { m, minIs, p } from "@sdxc/u/size";
import { font, text } from "@sdxc/u/typography";
import {
	Alert,
	FieldError,
	Form,
	Heading,
	Label,
	Link,
	Select,
	TextArea,
	TextField,
} from "@sdxc/ui";

import { SubmitButton } from "~/resources/components/submit-button";

/** Types used by the support form. */
export namespace SupportForm {
	/**
	 * `sent` replaces the form with the confirmation; the others render the form, with the
	 * matching alert above it for `rate-limited`, `failed`, `invalid` and `resubmit`.
	 */
	export type State = "idle" | "sent" | "invalid" | "rate-limited" | "failed" | "resubmit";

	/** The form's values as the visitor typed them, keyed by field name. */
	export type Values = Partial<
		Record<"name" | "email" | "topic" | "platform" | "osVersion" | "appVersion" | "message", string>
	>;

	/** Every word the form prints, in the page's language. */
	export interface Labels {
		formTitle: string;
		sent: string;
		sendAnother: string;
		failed: string;
		rateLimited: string;
		resubmit: string;
		invalid: string;
		name: string;
		email: string;
		topic: string;
		chooseTopic: string;
		device: string;
		chooseDevice: string;
		osVersion: string;
		osPlaceholder: string;
		appVersion: string;
		appPlaceholder: string;
		message: string;
		messagePlaceholder: string;
		/** The sentence before the privacy link. */
		notice: string;
		privacyLink: string;
		/** What sits between the notice and the link, a space by default. */
		noticeJoiner?: string;
		/** What follows the link, a full stop by default. */
		noticeEnd?: string;
		submit: string;
		pending: string;
	}

	/** Character limits the fields' `maxlength` repeat from the validator. */
	export interface Limits {
		name: number;
		email: number;
		version: number;
		message: number;
	}

	/** Props of the form. */
	export interface Props {
		state: State;
		values: Values;
		/** Validation issues by field path, which the form hands each field by name. */
		issues: ReadonlyArray<Form.Issue>;
		/** Freshly issued trap fields; `sent` renders no form and needs none. */
		honeypot?: Honeypot.Fields;
		labels: Labels;
		/** The posted value of each topic, with the label the page shows for it. */
		topics: ReadonlyArray<readonly [string, string]>;
		/** The posted value of each device, with the label the page shows for it. */
		platforms: ReadonlyArray<readonly [string, string]>;
		limits: Limits;
		messageMin: number;
		/** Where the form posts. */
		action: string;
		/** The support page, which the confirmation links to for another request. */
		againHref: string;
		privacyHref: string;
	}

	/** Props of a labeled native select, which reads its own error from `issues`. */
	export interface ChoiceProps {
		name: string;
		label: string;
		placeholder: string;
		options: ReadonlyArray<readonly [string, string]>;
		value: string | undefined;
		issues: ReadonlyArray<Form.Issue>;
	}

	/** Props of the message field. */
	export interface MessageProps {
		label: string;
		placeholder: string;
		value: string | undefined;
		issues: ReadonlyArray<Form.Issue>;
		min: number;
		max: number;
	}
}

/** The first issue reported for `name`, matched on the issue's one-segment path. */
function issueFor(issues: ReadonlyArray<Form.Issue>, name: string): string | undefined {
	return issues.find((issue) => {
		let segment = issue.path?.[0];
		let key = typeof segment === "object" ? segment.key : segment;
		return key === name;
	})?.message;
}

/** Whether `name` is the first field with an issue, which takes focus after a failed submit. */
function isFirstInvalid(issues: ReadonlyArray<Form.Issue>, name: string): boolean {
	let first = issues[0]?.path?.[0];
	let key = typeof first === "object" ? first.key : first;
	return key === name;
}

/**
 * A required native select with a blank first option, so the browser blocks a submission
 * that picked nothing. Wired to its error the way `TextField` wires its own.
 */
function Choice(handle: Handle<SupportForm.ChoiceProps>) {
	return () => {
		let { name, label, placeholder, options, value, issues } = handle.props;
		let error = issueFor(issues, name);
		let id = `support-${name}`;
		let errorId = `${id}-error`;

		return (
			<div mix={[grid(), gap(2)]}>
				<Label htmlFor={id}>{label}</Label>
				<Select
					id={id}
					name={name}
					required
					color={error ? "danger" : undefined}
					aria-invalid={error ? "true" : undefined}
					aria-describedby={error ? errorId : undefined}
					// oxlint-disable-next-line jsx-a11y/no-autofocus -- Only the first invalid field after a failed submit, so the visitor lands on the problem.
					autoFocus={isFirstInvalid(issues, name) || undefined}
				>
					<Select.Option value="" selected={!value}>
						{placeholder}
					</Select.Option>
					{options.map(([option, optionLabel]) => (
						<Select.Option key={option} value={option} selected={value === option}>
							{optionLabel}
						</Select.Option>
					))}
				</Select>
				{error ? <FieldError id={errorId}>{error}</FieldError> : null}
			</div>
		);
	};
}

/** The message textarea, with its error announced through `aria-describedby`. */
function MessageField(handle: Handle<SupportForm.MessageProps>) {
	return () => {
		let { issues, label, max, min, placeholder, value } = handle.props;
		let error = issueFor(issues, "message");

		return (
			<div mix={[grid(), gap(2)]}>
				<Label htmlFor="support-message">{label}</Label>
				<TextArea
					id="support-message"
					name="message"
					required
					minLength={min}
					maxLength={max}
					rows={8}
					placeholder={placeholder}
					color={error ? "danger" : undefined}
					aria-invalid={error ? "true" : undefined}
					aria-describedby={error ? "support-message-error" : undefined}
					// oxlint-disable-next-line jsx-a11y/no-autofocus -- Only the first invalid field after a failed submit, so the visitor lands on the problem.
					autoFocus={isFirstInvalid(issues, "message") || undefined}
					defaultValue={value}
				/>
				{error ? <FieldError id="support-message-error">{error}</FieldError> : null}
			</div>
		);
	};
}

/** The alert above the form for each state that needs one, with its colour. */
const ALERTS = {
	failed: "danger",
	"rate-limited": "warning",
	resubmit: "warning",
	invalid: "danger",
} as const;

/** The label key carrying each alert's sentence. */
const ALERT_LABELS = {
	failed: "failed",
	"rate-limited": "rateLimited",
	resubmit: "resubmit",
	invalid: "invalid",
} as const;

/**
 * The form's card. It declares a container so the paired fields sit side by side only when
 * the card itself is wide enough, on any viewport. The submit button's island is optional:
 * without it the form posts and re-renders the same way.
 *
 * @param handle Runtime handle carrying the state, the values, the words and the limits.
 * @returns The render function producing the card.
 */
export function SupportForm(handle: Handle<SupportForm.Props>) {
	return () => {
		let {
			action,
			againHref,
			honeypot,
			issues,
			labels: t,
			limits,
			privacyHref,
			state,
			values,
		} = handle.props;
		let alert = state in ALERTS ? (state as keyof typeof ALERTS) : undefined;

		return (
			<section
				aria-labelledby="support-form"
				mix={[
					container("support-form"),
					grid(),
					gap(4),
					p(5),
					minIs(0),
					rounded("xl"),
					raw({ backgroundColor: "var(--app-card)" }),
					at("md", p(8)),
				]}
			>
				<Heading level={2} id="support-form" mix={[m(0), font("display"), text("2xl")]}>
					{t.formTitle}
				</Heading>

				{state === "sent" ? (
					<div mix={[grid(), gap(4)]}>
						<Alert color="success" live="polite">
							<Alert.Content>
								<Alert.Description>{t.sent}</Alert.Description>
							</Alert.Content>
						</Alert>
						<p mix={[m(0)]}>
							<Link href={againHref}>{t.sendAnother}</Link>
						</p>
					</div>
				) : (
					<Form method="post" action={action} issues={issues}>
						{alert ? (
							<Alert color={ALERTS[alert]} live="assertive">
								<Alert.Content>
									<Alert.Description>{t[ALERT_LABELS[alert]]}</Alert.Description>
								</Alert.Content>
							</Alert>
						) : null}

						<div
							mix={[
								grid(),
								gap(4),
								at("md", gridTemplate({ columns: repeat(2, "minmax(0, 1fr)") })),
							]}
						>
							<TextField
								label={t.name}
								name="name"
								autoComplete="name"
								maxLength={limits.name}
								defaultValue={values.name}
							/>
							<TextField
								label={t.email}
								name="email"
								type="email"
								autoComplete="email"
								required
								maxLength={limits.email}
								defaultValue={values.email}
							/>
							<Choice
								name="topic"
								label={t.topic}
								placeholder={t.chooseTopic}
								options={handle.props.topics}
								value={values.topic}
								issues={issues}
							/>
							<Choice
								name="platform"
								label={t.device}
								placeholder={t.chooseDevice}
								options={handle.props.platforms}
								value={values.platform}
								issues={issues}
							/>
							<TextField
								label={t.osVersion}
								name="osVersion"
								autoComplete="off"
								placeholder={t.osPlaceholder}
								maxLength={limits.version}
								defaultValue={values.osVersion}
							/>
							<TextField
								label={t.appVersion}
								name="appVersion"
								autoComplete="off"
								placeholder={t.appPlaceholder}
								maxLength={limits.version}
								defaultValue={values.appVersion}
							/>
						</div>

						<MessageField
							label={t.message}
							placeholder={t.messagePlaceholder}
							value={values.message}
							issues={issues}
							min={handle.props.messageMin}
							max={limits.message}
						/>

						{honeypot ? <HoneypotFields {...honeypot} /> : null}

						<p mix={[m(0), text("sm")]}>
							{t.notice}
							{t.noticeJoiner ?? " "}
							<Link href={privacyHref}>{t.privacyLink}</Link>
							{t.noticeEnd ?? "."}
						</p>

						<div mix={[hstack({ gap: 3, align: "center" }), flexWrap("wrap")]}>
							<SubmitButton label={t.submit} pendingLabel={t.pending} />
						</div>
					</Form>
				)}
			</section>
		);
	};
}

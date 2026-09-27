/**
 * View for the Encore support page: what the app is, how to describe a problem, and the
 * support form. Each state the controller reaches — idle, sent, invalid, rate-limited,
 * failed — renders here, and every state but `sent` keeps the visitor's values in the form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { container, flexWrap, gap, grid, gridTemplate, hstack, repeat } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { bleed, m, minIs, p } from "@sdxc/u/size";
import { overflowWrap, text } from "@sdxc/u/typography";
import {
	Alert,
	Button,
	FieldError,
	Form,
	Heading,
	Label,
	Link,
	Select,
	TextArea,
	TextField,
	Typeset,
} from "@sdxc/ui";

import {
	SUPPORT_LIMITS,
	SUPPORT_MESSAGE_MIN,
	SUPPORT_PLATFORMS,
	SUPPORT_TOPICS,
} from "~/app/schemas/encore-support";
import { BlogLayout } from "~/resources/layouts/blog";
import routes from "~/routes/web";

/** Where the progressive enhancement lives: busy state and one submission per page load. */
const ENHANCEMENT_SRC = "/js/encore-support.js";

/**
 * Types used by the Encore support page renderer.
 */
export namespace EncoreSupportView {
	/**
	 * `sent` replaces the form with the confirmation; the others render the form, with the
	 * matching alert above it for `rate-limited` and `failed`.
	 */
	export type State = "idle" | "sent" | "invalid" | "rate-limited" | "failed";

	/** The form's values as the visitor typed them, keyed by field name. */
	export type Values = Partial<
		Record<"name" | "email" | "topic" | "platform" | "osVersion" | "appVersion" | "message", string>
	>;

	/** Data required to render the page. */
	export interface Model {
		state: State;
		values: Values;
		/** Validation issues by field path, which the form hands each field by name. */
		issues: ReadonlyArray<Form.Issue>;
	}

	/** Props of a labeled native select, which reads its own error from `issues`. */
	export interface ChoiceProps {
		name: string;
		label: string;
		placeholder: string;
		options: ReadonlyArray<string>;
		value: string | undefined;
		issues: ReadonlyArray<Form.Issue>;
	}

	/** Props of the message field. */
	export interface MessageProps {
		value: string | undefined;
		issues: ReadonlyArray<Form.Issue>;
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
function Choice(handle: Handle<EncoreSupportView.ChoiceProps>) {
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
					{options.map((option) => (
						<Select.Option key={option} value={option} selected={value === option}>
							{option}
						</Select.Option>
					))}
				</Select>
				{error ? <FieldError id={errorId}>{error}</FieldError> : null}
			</div>
		);
	};
}

/** The message textarea, with its hint and error both announced through `aria-describedby`. */
function MessageField(handle: Handle<EncoreSupportView.MessageProps>) {
	return () => {
		let { value, issues } = handle.props;
		let error = issueFor(issues, "message");

		return (
			<div mix={[grid(), gap(2)]}>
				<Label htmlFor="support-message">Message</Label>
				<TextArea
					id="support-message"
					name="message"
					required
					minLength={SUPPORT_MESSAGE_MIN}
					maxLength={SUPPORT_LIMITS.message}
					rows={8}
					placeholder="Describe your question, problem, or suggestion…"
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

/**
 * The page. The form panel declares a container so the paired fields sit side by side only
 * when the panel itself is wide enough, on any viewport. The enhancement script is optional:
 * without it the form posts and re-renders the same way.
 *
 * @returns View function rendering the support page for the controller's state.
 */
export function EncoreSupportView() {
	return ({ model }: { model: EncoreSupportView.Model }) => {
		let { state, values, issues } = model;
		let action = routes.encoreSupport.action.href();

		return (
			<BlogLayout
				title="Encore Support"
				description="Get help with Encore: Music Party Game for iPhone, iPad, Apple Watch, and Mac. Report a problem, ask a question, or suggest a feature."
			>
				<main mix={[grid(), gap(6)]}>
					<header mix={[grid(), gap(4)]}>
						<Heading level={1} mix={[m(0), text("4xl"), overflowWrap("break-word")]}>
							Encore Support
						</Heading>
						<Typeset preset="reading">
							<p>
								Encore is a music party card game for iPhone, iPad, Apple Watch, and Mac. Gather
								your friends or family, reveal a card, and sing a song that fits the challenge—from
								holiday classics to the songs you sing in the shower.
							</p>
						</Typeset>
					</header>

					<section aria-labelledby="support-help" mix={[grid(), gap(4)]}>
						<Heading level={2} id="support-help" mix={[m(0), text("2xl")]}>
							How can we help?
						</Heading>
						<Typeset preset="reading">
							<p>
								Have a question, found a bug, or have an idea for Encore? Use the form below to get
								in touch.
							</p>
							<p>
								If something isn’t working, tell us which device you’re using, what happened, and
								what you expected. Include the steps to reproduce the problem and your OS and app
								versions if you know them.
							</p>
						</Typeset>
					</section>

					<section
						aria-labelledby="support-form"
						mix={[
							container("support-form"),
							grid(),
							gap(4),
							p(4),
							bleed(4),
							minIs(0),
							border({ width: 1, color: "neutral" }),
							rounded("lg"),
							bg("neutral.bg-tint-hover"),
						]}
					>
						<Heading level={2} id="support-form" mix={[m(0), text("2xl")]}>
							Support form
						</Heading>

						{state === "sent" ? (
							<div mix={[grid(), gap(4)]}>
								<Alert color="success" live="polite">
									<Alert.Content>
										<Alert.Description>
											Your support request has been sent. We’ll reply to the email address you
											provided.
										</Alert.Description>
									</Alert.Content>
								</Alert>
								<p mix={[m(0)]}>
									<Link href={routes.encoreSupport.index.href()}>Send another request</Link>
								</p>
							</div>
						) : (
							<Form method="post" action={action} issues={issues} data-support-form="">
								{state === "failed" ? (
									<Alert color="danger" live="assertive">
										<Alert.Content>
											<Alert.Description>
												We couldn’t send your request. Your message has been preserved—please try
												again.
											</Alert.Description>
										</Alert.Content>
									</Alert>
								) : null}
								{state === "rate-limited" ? (
									<Alert color="warning" live="assertive">
										<Alert.Content>
											<Alert.Description>
												You’ve sent several requests in a short time. Your message has been
												preserved—please wait a minute and try again.
											</Alert.Description>
										</Alert.Content>
									</Alert>
								) : null}
								{state === "invalid" ? (
									<Alert color="danger" live="assertive">
										<Alert.Content>
											<Alert.Description>
												Please correct the highlighted fields and send your request again.
											</Alert.Description>
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
										label="Name (optional)"
										name="name"
										autoComplete="name"
										maxLength={SUPPORT_LIMITS.name}
										defaultValue={values.name}
									/>
									<TextField
										label="Email"
										name="email"
										type="email"
										autoComplete="email"
										required
										maxLength={SUPPORT_LIMITS.email}
										defaultValue={values.email}
									/>
									<Choice
										name="topic"
										label="Topic"
										placeholder="Choose a topic"
										options={SUPPORT_TOPICS}
										value={values.topic}
										issues={issues}
									/>
									<Choice
										name="platform"
										label="Device/platform"
										placeholder="Choose a device"
										options={SUPPORT_PLATFORMS}
										value={values.platform}
										issues={issues}
									/>
									<TextField
										label="OS version (optional)"
										name="osVersion"
										autoComplete="off"
										placeholder="e.g. iOS 26.1"
										maxLength={SUPPORT_LIMITS.version}
										defaultValue={values.osVersion}
									/>
									<TextField
										label="App version (optional)"
										name="appVersion"
										autoComplete="off"
										placeholder="e.g. 1.2"
										maxLength={SUPPORT_LIMITS.version}
										defaultValue={values.appVersion}
									/>
								</div>

								<MessageField value={values.message} issues={issues} />

								<div aria-hidden="true" mix={[visuallyHidden()]}>
									<label htmlFor="support-website">Leave this field empty</label>
									<input
										id="support-website"
										type="text"
										name="website"
										tabIndex={-1}
										autoComplete="off"
									/>
								</div>

								<p mix={[m(0), text("sm")]}>
									We’ll use the information you submit to respond to your request and investigate
									any reported issue. Please don’t include passwords, payment details, or other
									sensitive information. Read our{" "}
									<Link href={routes.encorePrivacy.href()}>Privacy Policy</Link>.
								</p>

								<div mix={[hstack({ gap: 3, align: "center" }), flexWrap("wrap")]}>
									<Button type="submit" color="brand" data-support-submit="">
										Send support request
									</Button>
								</div>
							</Form>
						)}
					</section>
				</main>
				<script src={ENHANCEMENT_SRC} defer />
			</BlogLayout>
		);
	};
}

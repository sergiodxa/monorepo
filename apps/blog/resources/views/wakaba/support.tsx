/**
 * View for the Wakaba support page, in the app's own look: what to include in a request,
 * the support form on a white card, and links to the policy and the landing. Each state the controller reaches — idle, sent, invalid, rate-limited,
 * failed, resubmit — renders here, and every state but `sent` keeps the visitor's values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Honeypot } from "@sdxc/honeypot";
import type { Handle } from "remix/component";

import { HoneypotFields } from "@sdxc/honeypot/ui";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { container, flexWrap, gap, grid, gridTemplate, hstack, repeat } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { is, m, maxIs, mi, minIs, p, pbe, pbs, pi } from "@sdxc/u/size";
import { font, overflowWrap, text } from "@sdxc/u/typography";
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
	Typeset,
} from "@sdxc/ui";

import {
	WAKABA_SUPPORT_LIMITS as SUPPORT_LIMITS,
	WAKABA_SUPPORT_MESSAGE_MIN as SUPPORT_MESSAGE_MIN,
	WAKABA_SUPPORT_PLATFORMS as SUPPORT_PLATFORMS,
	WAKABA_SUPPORT_TOPICS as SUPPORT_TOPICS,
} from "~/app/http/validators/wakaba-support";
import { SubmitButton } from "~/resources/components/submit-button";
import { WakabaLayout } from "~/resources/layouts/wakaba";
import { Mascot } from "~/resources/views/wakaba/parts";
import routes from "~/routes/web";

/**
 * Types used by the Wakaba support page renderer.
 */
export namespace WakabaSupportView {
	/**
	 * `sent` replaces the form with the confirmation; the others render the form, with the
	 * matching alert above it for `rate-limited`, `failed`, `invalid` and `resubmit`.
	 */
	export type State = "idle" | "sent" | "invalid" | "rate-limited" | "failed" | "resubmit";

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
		/** Freshly issued trap fields; `sent` renders no form and needs none. */
		honeypot?: Honeypot.Fields;
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
function Choice(handle: Handle<WakabaSupportView.ChoiceProps>) {
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
function MessageField(handle: Handle<WakabaSupportView.MessageProps>) {
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
 * when the panel itself is wide enough, on any viewport. The submit button's island is
 * optional: without it the form posts and re-renders the same way.
 *
 * @returns View function rendering the support page for the controller's state.
 */
export function WakabaSupportView() {
	return ({ model, assets }: { model: WakabaSupportView.Model; assets: DocumentAssets }) => {
		let { state, values, issues, honeypot } = model;
		let action = routes.wakabaSupport.action.href();

		return (
			<WakabaLayout
				assets={assets}
				title="Wakaba Support"
				description="Get help with Wakaba, the Japanese vocabulary app for iPhone and iPad. Report a problem, ask a question, suggest a feature or correct a word."
				path={routes.wakabaSupport.index.href()}
			>
				<main
					mix={[
						grid(),
						gap(6),
						pi(4),
						pbe(8),
						maxIs("46rem"),
						mi("auto"),
						is("full"),
						at("md", pi(6)),
					]}
				>
					<header
						mix={[
							grid(),
							gap(3),
							pbs(8),
							raw({ gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center" }),
						]}
					>
						<Heading
							level={1}
							mix={[m(0), font("display"), text("4xl"), overflowWrap("break-word")]}
						>
							Wakaba Support
						</Heading>
						<div
							mix={[
								raw({
									gridColumn: "2",
									gridRow: "1",
									alignSelf: "start",
									"@media (min-width: 48rem)": { gridRow: "1 / span 2" },
								}),
							]}
						>
							<Mascot pose="tanuki-listening" size="md" tilt={4} />
						</div>
						<Typeset
							preset="reading"
							mix={[
								raw({ gridColumn: "1 / -1", "@media (min-width: 48rem)": { gridColumn: "1" } }),
							]}
						>
							<p>
								Found a bug, a word that looks wrong, or an idea for Wakaba? Write to me here and
								I’ll reply by email.
							</p>
							<p>
								If something isn’t working, tell me which device you’re using, what happened and
								what you expected. Your iOS or iPadOS version and the app version help too, if you
								know them.
							</p>
						</Typeset>
					</header>

					<section
						aria-labelledby="support-form"
						mix={[
							container("support-form"),
							grid(),
							gap(4),
							p(5),
							minIs(0),
							rounded("xl"),
							raw({ backgroundColor: "var(--wakaba-card)" }),
							at("md", p(8)),
						]}
					>
						<Heading level={2} id="support-form" mix={[m(0), font("display"), text("2xl")]}>
							Send a request
						</Heading>

						{state === "sent" ? (
							<div mix={[grid(), gap(4)]}>
								<Alert color="success" live="polite">
									<Alert.Content>
										<Alert.Description>
											Your support request has been sent. I’ll reply to the email address you
											provided.
										</Alert.Description>
									</Alert.Content>
								</Alert>
								<p mix={[m(0)]}>
									<Link href={routes.wakabaSupport.index.href()}>Send another request</Link>
								</p>
							</div>
						) : (
							<Form method="post" action={action} issues={issues}>
								{state === "failed" ? (
									<Alert color="danger" live="assertive">
										<Alert.Content>
											<Alert.Description>
												I couldn’t send your request. Your message has been preserved—please try
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
								{state === "resubmit" ? (
									<Alert color="warning" live="assertive">
										<Alert.Content>
											<Alert.Description>
												This form expired before it was sent. Your message has been preserved—please
												send it again.
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
										placeholder="e.g. 1.0"
										maxLength={SUPPORT_LIMITS.version}
										defaultValue={values.appVersion}
									/>
								</div>

								<MessageField value={values.message} issues={issues} />

								{honeypot ? <HoneypotFields {...honeypot} /> : null}

								<p mix={[m(0), text("sm")]}>
									I’ll use the information you submit to respond to your request and investigate any
									reported issue. Please don’t include passwords, payment details, or other
									sensitive information. Read our{" "}
									<Link href={routes.wakabaPrivacy.href()}>Privacy Policy</Link>.
								</p>

								<div mix={[hstack({ gap: 3, align: "center" }), flexWrap("wrap")]}>
									<SubmitButton label="Send support request" pendingLabel="Sending…" />
								</div>
							</Form>
						)}
					</section>
				</main>
			</WakabaLayout>
		);
	};
}

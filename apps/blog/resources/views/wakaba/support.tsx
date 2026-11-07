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

import type { PageLocale } from "~/app/services/page-locale";

import {
	WAKABA_SUPPORT_LIMITS as SUPPORT_LIMITS,
	WAKABA_SUPPORT_MESSAGE_MIN as SUPPORT_MESSAGE_MIN,
	WAKABA_SUPPORT_PLATFORMS as SUPPORT_PLATFORMS,
	WAKABA_SUPPORT_TOPICS as SUPPORT_TOPICS,
} from "~/app/http/validators/wakaba-support";
import { SubmitButton } from "~/resources/components/submit-button";
import { inLanguage, WAKABA_PAGES_COPY } from "~/resources/content/wakaba/pages";
import { WakabaLayout } from "~/resources/layouts/wakaba";
import { Mascot, WAKABA_COPY } from "~/resources/views/wakaba/parts";
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
		/** The language the page is written in. English by default. */
		locale?: PageLocale;
	}

	/** Props of a labeled native select, which reads its own error from `issues`. */
	export interface ChoiceProps {
		name: string;
		label: string;
		placeholder: string;
		/** The posted value of each option, with the label the page shows for it. */
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

/** The message textarea, with its hint and error both announced through `aria-describedby`. */
function MessageField(handle: Handle<WakabaSupportView.MessageProps>) {
	return () => {
		let { issues, label, placeholder, value } = handle.props;
		let error = issueFor(issues, "message");

		return (
			<div mix={[grid(), gap(2)]}>
				<Label htmlFor="support-message">{label}</Label>
				<TextArea
					id="support-message"
					name="message"
					required
					minLength={SUPPORT_MESSAGE_MIN}
					maxLength={SUPPORT_LIMITS.message}
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
		let locale = model.locale ?? "en";
		let t = WAKABA_PAGES_COPY[locale].support;
		let action = inLanguage(routes.wakabaSupport.action.href(), locale);

		return (
			<WakabaLayout
				assets={assets}
				copy={WAKABA_COPY[locale]}
				bilingual
				title={t.title}
				description={t.description}
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
							{t.title}
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
							<p>{t.intro[0]}</p>
							<p>{t.intro[1]}</p>
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
									<Link href={inLanguage(routes.wakabaSupport.index.href(), locale)}>
										{t.sendAnother}
									</Link>
								</p>
							</div>
						) : (
							<Form method="post" action={action} issues={issues}>
								{state === "failed" ? (
									<Alert color="danger" live="assertive">
										<Alert.Content>
											<Alert.Description>{t.failed}</Alert.Description>
										</Alert.Content>
									</Alert>
								) : null}
								{state === "rate-limited" ? (
									<Alert color="warning" live="assertive">
										<Alert.Content>
											<Alert.Description>{t.rateLimited}</Alert.Description>
										</Alert.Content>
									</Alert>
								) : null}
								{state === "resubmit" ? (
									<Alert color="warning" live="assertive">
										<Alert.Content>
											<Alert.Description>{t.resubmit}</Alert.Description>
										</Alert.Content>
									</Alert>
								) : null}
								{state === "invalid" ? (
									<Alert color="danger" live="assertive">
										<Alert.Content>
											<Alert.Description>{t.invalid}</Alert.Description>
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
										maxLength={SUPPORT_LIMITS.name}
										defaultValue={values.name}
									/>
									<TextField
										label={t.email}
										name="email"
										type="email"
										autoComplete="email"
										required
										maxLength={SUPPORT_LIMITS.email}
										defaultValue={values.email}
									/>
									<Choice
										name="topic"
										label={t.topic}
										placeholder={t.chooseTopic}
										options={SUPPORT_TOPICS.map((topic) => [topic, t.topics[topic]] as const)}
										value={values.topic}
										issues={issues}
									/>
									<Choice
										name="platform"
										label={t.device}
										placeholder={t.chooseDevice}
										options={SUPPORT_PLATFORMS.map(
											(platform) => [platform, t.platforms[platform]] as const,
										)}
										value={values.platform}
										issues={issues}
									/>
									<TextField
										label={t.osVersion}
										name="osVersion"
										autoComplete="off"
										placeholder={t.osPlaceholder}
										maxLength={SUPPORT_LIMITS.version}
										defaultValue={values.osVersion}
									/>
									<TextField
										label={t.appVersion}
										name="appVersion"
										autoComplete="off"
										placeholder={t.appPlaceholder}
										maxLength={SUPPORT_LIMITS.version}
										defaultValue={values.appVersion}
									/>
								</div>

								<MessageField
									label={t.message}
									placeholder={t.messagePlaceholder}
									value={values.message}
									issues={issues}
								/>

								{honeypot ? <HoneypotFields {...honeypot} /> : null}

								<p mix={[m(0), text("sm")]}>
									{t.notice}{" "}
									<Link href={inLanguage(routes.wakabaPrivacy.href(), locale)}>
										{t.privacyLink}
									</Link>
									.
								</p>

								<div mix={[hstack({ gap: 3, align: "center" }), flexWrap("wrap")]}>
									<SubmitButton label={t.submit} pendingLabel={t.pending} />
								</div>
							</Form>
						)}
					</section>
				</main>
			</WakabaLayout>
		);
	};
}

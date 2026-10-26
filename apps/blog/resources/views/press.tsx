/**
 * View for the press kit: a cover with the author's photos and name, then quick facts, bios
 * to copy, downloadable photos, topics, open-source work, past appearances and talk formats,
 * ending in the invitation form. Every state the form reaches renders here, in either language.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Honeypot } from "@sdxc/honeypot";
import type { Handle, RemixNode } from "remix/component";

import { HoneypotFields } from "@sdxc/honeypot/ui";
import { bg, border, borderEdge, fg } from "@sdxc/u/color";
import { rounded, shadow } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import {
	absolute,
	basis,
	container,
	flexWrap,
	gap,
	grid,
	gridTemplate,
	grow,
	hstack,
	insBe,
	insIs,
	relative,
	repeat,
	shrink,
	vstack,
} from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { aspect, bleed, circle, is, m, maxIs, mbe, minIs, p, pb, pbs, width } from "@sdxc/u/size";
import { balance, leading, overflowWrap, text, tracking, weight } from "@sdxc/u/typography";
import {
	Alert,
	Badge,
	FieldError,
	Form,
	Heading,
	Label,
	Link,
	LinkButton,
	Select,
	TextArea,
	TextField,
} from "@sdxc/ui";

import type { PressKit } from "~/app/services/press-kit";

import { PRESS_KINDS, PRESS_LIMITS, PRESS_MESSAGE_MIN } from "~/app/http/validators/press-contact";
import { CopyButton } from "~/resources/components/copy-button";
import { SubmitButton } from "~/resources/components/submit-button";
import { BlogLayout } from "~/resources/layouts/blog";
import routes from "~/routes/web";

/**
 * Types used by the press kit renderer.
 */
export namespace PressView {
	/**
	 * `sent` replaces the form with the confirmation; the others render the form, with the
	 * matching alert above it for `rate-limited`, `failed`, `invalid` and `resubmit`.
	 */
	export type State = "idle" | "sent" | "invalid" | "rate-limited" | "failed" | "resubmit";

	/** The form's values as the organizer typed them, keyed by field name. */
	export type Values = Partial<Record<"name" | "email" | "kind" | "event" | "message", string>>;

	/** Data required to render the page. */
	export interface Model {
		kit: PressKit;
		state: State;
		values: Values;
		/** Validation issues by field, already worded in the kit's language. */
		issues: ReadonlyArray<Form.Issue>;
		/** Freshly issued trap fields; `sent` renders no form and needs none. */
		honeypot?: Honeypot.Fields;
	}

	/** Props of a titled section of the kit. */
	export interface SectionProps {
		id: string;
		title: string;
		/** A line under the title saying how to use the section. */
		note?: string;
		children?: RemixNode;
	}

	/** Props of the invitation form. */
	export interface ContactProps {
		kit: PressKit;
		state: State;
		values: Values;
		issues: ReadonlyArray<Form.Issue>;
		honeypot?: Honeypot.Fields;
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

/** A profile URL as a reader would type it: no scheme, no `www.`, no trailing slash. */
function displayUrl(href: string): string {
	let url = new URL(href);
	return `${url.host.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`;
}

/** Counts a bio's words the way organizers' limits count them, on whitespace. */
function wordCount(value: string): number {
	return value.split(/\s+/).filter(Boolean).length;
}

/** The kit's URL in `locale`, which a shared link keeps regardless of the reader's browser. */
function kitHref(locale: string, hash = ""): string {
	return `${routes.press.index.href()}?lang=${locale}${hash}`;
}

/**
 * A section of the kit: a heading the page's outline lists, an optional note on how to use
 * it, and its content. Each anchors on its `id`, so a link can point an organizer at one part.
 */
function Section(handle: Handle<PressView.SectionProps>) {
	return () => {
		let { id, title, note, children } = handle.props;
		return (
			<section aria-labelledby={id} id={`${id}-section`} mix={[grid(), gap(4), minIs(0)]}>
				<div mix={[grid(), gap(1)]}>
					<Heading level={2} id={id} mix={[m(0), text("2xl")]}>
						{title}
					</Heading>
					{note ? <p mix={[m(0), fg("neutral.muted")]}>{note}</p> : null}
				</div>
				{children}
			</section>
		);
	};
}

/**
 * The cover: the wide photo with the avatar overlapping its lower edge, then the name, tagline
 * and intro, and the two things an organizer usually came for.
 */
function Cover(handle: Handle<{ kit: PressKit }>) {
	return () => {
		let { kit } = handle.props;
		let [avatar, cover] = kit.photos;

		return (
			<header mix={[grid(), gap(6)]}>
				<div mix={[hstack({ gap: 4, justify: "end", align: "center" }), flexWrap("wrap")]}>
					<Link
						href={kitHref(kit.otherLanguage.locale)}
						hreflang={kit.otherLanguage.locale}
						lang={kit.otherLanguage.locale}
						mix={[text("sm")]}
					>
						{kit.otherLanguage.label}
					</Link>
					<Link href={routes.pressMarkdown.href() + `?lang=${kit.locale}`} mix={[text("sm")]}>
						{kit.labels.viewMarkdown}
					</Link>
				</div>

				<div mix={[relative(), bleed(4), mbe(4)]}>
					{cover ? (
						<img
							src={cover.src}
							alt={cover.alt}
							width={cover.width}
							height={cover.height}
							mix={[
								width("100%"),
								aspect("widescreen"),
								rounded("xl"),
								shadow("md"),
								raw({ objectFit: "cover", display: "block" }),
							]}
						/>
					) : null}
					{avatar ? (
						<img
							src={avatar.src}
							alt={avatar.alt}
							width={avatar.width}
							height={avatar.height}
							mix={[
								absolute(),
								circle(),
								is(24),
								at("md", is(32)),
								bg("brand.tint"),
								border({ width: 4, color: "neutral.bg" }),
								shadow("lg"),
								insIs(6),
								insBe(-12),
								raw({ objectFit: "cover" }),
							]}
						/>
					) : null}
				</div>

				<div mix={[grid(), gap(3), pbs(10)]}>
					<Heading level={1} mix={[m(0), text("5xl"), tracking("tight"), balance()]}>
						Sergio Xalambrí
					</Heading>
					<p mix={[m(0), text("xl"), fg("neutral.muted"), balance()]}>{kit.tagline}</p>
					<p mix={[m(0), leading("relaxed"), maxIs("65ch")]}>{kit.intro}</p>
				</div>

				<div mix={[hstack({ gap: 3, align: "center" }), flexWrap("wrap")]}>
					<LinkButton href="#contact" color="brand">
						{kit.labels.contact}
					</LinkButton>
					<LinkButton href="#photos" variant="outline">
						{kit.labels.photos}
					</LinkButton>
				</div>
			</header>
		);
	};
}

/** Quick facts as a grid of small labeled tiles, the label above in small caps. */
function Facts(handle: Handle<{ facts: ReadonlyArray<PressKit.Fact> }>) {
	return () => (
		<dl
			mix={[
				m(0),
				grid(),
				gap(3),
				gridTemplate({ columns: repeat("auto-fill", "minmax(min(100%, 13rem), 1fr)") }),
			]}
		>
			{handle.props.facts.map((fact) => (
				<div
					key={fact.label}
					mix={[
						vstack({ gap: 1 }),
						p(4),
						rounded("lg"),
						border({ width: 1, color: "neutral" }),
						bg("neutral.bg-tint-hover"),
					]}
				>
					<dt
						mix={[
							text("xs"),
							weight("semibold"),
							tracking("wide"),
							fg("neutral.muted"),
							raw({ textTransform: "uppercase" }),
						]}
					>
						{fact.label}
					</dt>
					<dd mix={[m(0), weight("medium"), overflowWrap("break-word")]}>{fact.value}</dd>
				</div>
			))}
		</dl>
	);
}

/** One bio as a card: its length and use, a word count, the copy button, and the text. */
function BioCard(handle: Handle<{ bio: PressKit.Bio; labels: PressKit.Labels }>) {
	return () => {
		let { bio, labels } = handle.props;
		let textId = `bio-${bio.id}`;

		return (
			<article
				mix={[
					grid(),
					gap(3),
					p(5),
					rounded("lg"),
					border({ width: 1, color: "neutral" }),
					bg("neutral.bg-tint-hover"),
					minIs(0),
				]}
			>
				<div mix={[hstack({ gap: 3, align: "start", justify: "between" })]}>
					<div mix={[grid(), gap(1)]}>
						<Heading level={3} mix={[m(0), text("lg")]}>
							{bio.label}
						</Heading>
						<p mix={[m(0), text("sm"), fg("neutral.muted")]}>{bio.use}</p>
					</div>
					<div mix={[hstack({ gap: 1, align: "center" }), shrink(0)]}>
						<Badge variant="secondary">
							{wordCount(bio.text)} {labels.words}
						</Badge>
						<CopyButton target={textId} label={labels.copy} copiedLabel={labels.copied} />
					</div>
				</div>
				<div id={textId} mix={[grid(), gap(3), leading("relaxed")]}>
					{bio.text.split("\n\n").map((paragraph) => (
						<p mix={[m(0)]}>{paragraph}</p>
					))}
				</div>
			</article>
		);
	};
}

/** A photo with its size and a download link that saves the original file. */
function PhotoCard(handle: Handle<{ photo: PressKit.Photo; download: string }>) {
	return () => {
		let { photo, download } = handle.props;
		let filename = `sergio-xalambri-${photo.label.toLowerCase().replace(/\s+/g, "-")}.${photo.format.toLowerCase()}`;

		return (
			<figure
				mix={[
					m(0),
					grid(),
					gap(3),
					p(3),
					rounded("lg"),
					border({ width: 1, color: "neutral" }),
					bg("neutral.bg-tint-hover"),
				]}
			>
				<img
					src={photo.src}
					alt={photo.alt}
					width={photo.width}
					height={photo.height}
					loading="lazy"
					mix={[
						width("100%"),
						aspect("video"),
						rounded("md"),
						bg("neutral.bg"),
						raw({ objectFit: "contain", display: "block" }),
					]}
				/>
				<figcaption
					mix={[hstack({ gap: 3, align: "center", justify: "between" }), flexWrap("wrap")]}
				>
					<span mix={[grid()]}>
						<span mix={[weight("medium")]}>{photo.label}</span>
						<span mix={[text("sm"), fg("neutral.muted")]}>
							{photo.width} × {photo.height} · {photo.format}
						</span>
					</span>
					<LinkButton href={photo.src} download={filename} size="sm" variant="outline">
						{download}
					</LinkButton>
				</figcaption>
			</figure>
		);
	};
}

/**
 * The invitation form, or its confirmation. Each failure keeps what the organizer typed and
 * says what to do in the kit's language; the action carries the language, so a re-rendered
 * form and the confirmation stay in it.
 */
function Contact(handle: Handle<PressView.ContactProps>) {
	return () => {
		let { kit, state, values, issues, honeypot } = handle.props;
		let copy = kit.contact;
		let kindError = issueFor(issues, "kind");
		let messageError = issueFor(issues, "message");
		let firstInvalid = firstIssueKey(issues);

		if (state === "sent") {
			return (
				<div mix={[grid(), gap(4)]}>
					<Alert color="success" live="polite">
						<Alert.Content>
							<Alert.Description>{copy.sent}</Alert.Description>
						</Alert.Content>
					</Alert>
					<p mix={[m(0)]}>
						<Link href={kitHref(kit.locale, "#contact")}>{copy.sendAnother}</Link>
					</p>
				</div>
			);
		}

		let alert = {
			failed: { color: "danger", text: copy.failed },
			"rate-limited": { color: "warning", text: copy.rateLimited },
			resubmit: { color: "warning", text: copy.resubmit },
			invalid: { color: "danger", text: copy.invalid },
			idle: undefined,
		}[state] as { color: "danger" | "warning"; text: string } | undefined;

		return (
			<Form
				method="post"
				action={`${routes.press.action.href()}?lang=${kit.locale}`}
				issues={issues}
			>
				{alert ? (
					<Alert color={alert.color} live="assertive">
						<Alert.Content>
							<Alert.Description>{alert.text}</Alert.Description>
						</Alert.Content>
					</Alert>
				) : null}

				<div
					mix={[grid(), gap(4), at("md", gridTemplate({ columns: repeat(2, "minmax(0, 1fr)") }))]}
				>
					<TextField
						label={copy.fields.name}
						name="name"
						autoComplete="name"
						required
						maxLength={PRESS_LIMITS.name}
						defaultValue={values.name}
					/>
					<TextField
						label={copy.fields.email}
						name="email"
						type="email"
						autoComplete="email"
						required
						maxLength={PRESS_LIMITS.email}
						defaultValue={values.email}
					/>
					<div mix={[grid(), gap(2)]}>
						<Label htmlFor="press-kind">{copy.fields.kind}</Label>
						<Select
							id="press-kind"
							name="kind"
							required
							color={kindError ? "danger" : undefined}
							aria-invalid={kindError ? "true" : undefined}
							aria-describedby={kindError ? "press-kind-error" : undefined}
							// oxlint-disable-next-line jsx-a11y/no-autofocus -- Only the first invalid field after a failed submit, so the organizer lands on the problem.
							autoFocus={firstInvalid === "kind" || undefined}
						>
							<Select.Option value="" selected={!values.kind}>
								{copy.fields.kindPlaceholder}
							</Select.Option>
							{PRESS_KINDS.map((kind) => (
								<Select.Option key={kind} value={kind} selected={values.kind === kind}>
									{copy.kinds[kind]}
								</Select.Option>
							))}
						</Select>
						{kindError ? <FieldError id="press-kind-error">{kindError}</FieldError> : null}
					</div>
					<TextField
						label={copy.fields.event}
						name="event"
						autoComplete="off"
						placeholder={copy.fields.eventPlaceholder}
						maxLength={PRESS_LIMITS.event}
						defaultValue={values.event}
					/>
				</div>

				<div mix={[grid(), gap(2)]}>
					<Label htmlFor="press-message">{copy.fields.message}</Label>
					<TextArea
						id="press-message"
						name="message"
						required
						minLength={PRESS_MESSAGE_MIN}
						maxLength={PRESS_LIMITS.message}
						rows={7}
						placeholder={copy.fields.messagePlaceholder}
						color={messageError ? "danger" : undefined}
						aria-invalid={messageError ? "true" : undefined}
						aria-describedby={messageError ? "press-message-error" : undefined}
						// oxlint-disable-next-line jsx-a11y/no-autofocus -- Only the first invalid field after a failed submit, so the organizer lands on the problem.
						autoFocus={firstInvalid === "message" || undefined}
						defaultValue={values.message}
					/>
					{messageError ? <FieldError id="press-message-error">{messageError}</FieldError> : null}
				</div>

				{honeypot ? <HoneypotFields {...honeypot} /> : null}

				<div mix={[hstack({ gap: 4, align: "center", justify: "between" }), flexWrap("wrap")]}>
					<p mix={[m(0), text("sm"), fg("neutral.muted"), grow(), basis("20rem")]}>
						{copy.privacy}
					</p>
					<SubmitButton label={copy.submit} pendingLabel={copy.sending} />
				</div>
			</Form>
		);
	};
}

/** The key of the first field with an issue, which takes focus after a failed submit. */
function firstIssueKey(issues: ReadonlyArray<Form.Issue>): string | undefined {
	let first = issues[0]?.path?.[0];
	if (first === undefined) return undefined;
	return typeof first === "object" ? String(first.key) : String(first);
}

/**
 * The page.
 *
 * @returns View function rendering the press kit for the controller's state.
 */
export function PressView() {
	return ({ model, assets }: { model: PressView.Model; assets: DocumentAssets }) => {
		let { kit } = model;
		let labels = kit.labels;

		return (
			<BlogLayout
				assets={assets}
				locale={kit.locale}
				title={kit.title}
				description={kit.description}
			>
				<main mix={[grid(), gap(12), minIs(0)]}>
					<Cover kit={kit} />

					<Section id="facts" title={labels.facts}>
						<Facts facts={kit.facts} />
					</Section>

					<Section id="bios" title={labels.bios} note={labels.biosNote}>
						<div mix={[grid(), gap(4)]}>
							{kit.bios.map((bio) => (
								<BioCard key={bio.id} bio={bio} labels={labels} />
							))}
						</div>
					</Section>

					<Section id="photos" title={labels.photos} note={labels.photosNote}>
						<div mix={[grid(), gap(4), gridTemplate({ columns: repeat(2, "minmax(0, 1fr)") })]}>
							{kit.photos.map((photo) => (
								<PhotoCard key={photo.src} photo={photo} download={labels.download} />
							))}
						</div>
					</Section>

					<Section id="topics" title={labels.topics}>
						<ul
							mix={[
								m(0),
								p(0),
								grid(),
								gap(3),
								gridTemplate({ columns: repeat("auto-fill", "minmax(min(100%, 16rem), 1fr)") }),
								raw({ listStyle: "none" }),
							]}
						>
							{kit.topics.map((topic) => (
								<li
									key={topic.name}
									mix={[
										grid(),
										gap(1),
										p(4),
										rounded("lg"),
										border({ width: 1, color: "brand" }),
										bg("brand.tint"),
									]}
								>
									<span mix={[weight("semibold"), fg("brand.emphasis")]}>{topic.name}</span>
									<span mix={[text("sm")]}>{topic.detail}</span>
								</li>
							))}
						</ul>
					</Section>

					<Section id="open-source" title={labels.openSource}>
						<ul mix={[m(0), p(0), grid(), gap(2), raw({ listStyle: "none" })]}>
							{kit.openSource.map((project) => (
								<li
									key={project.name}
									mix={[
										grid(),
										gap(1),
										p(4),
										rounded("lg"),
										border({ width: 1, color: "neutral" }),
										at("md", gridTemplate({ columns: "12rem minmax(0, 1fr)" })),
										at("md", gap(4)),
									]}
								>
									<Link href={project.href} mix={[weight("semibold")]}>
										{project.name}
									</Link>
									<span mix={[fg("neutral.muted")]}>{project.description}</span>
								</li>
							))}
						</ul>
					</Section>

					<Section id="appearances" title={labels.appearances}>
						<ol mix={[m(0), p(0), grid(), raw({ listStyle: "none" })]}>
							{kit.appearances.map((item) => (
								<li
									key={item.href}
									mix={[
										grid(),
										gap(1),
										pb(3),
										borderEdge("block-end", { color: "neutral.border", width: 1, style: "solid" }),
									]}
								>
									<div mix={[hstack({ gap: 2, align: "center" }), flexWrap("wrap")]}>
										<Link href={item.href} mix={[weight("medium")]}>
											{item.title}
										</Link>
										<Badge variant="outline">{item.language}</Badge>
									</div>
									<span mix={[text("sm"), fg("neutral.muted")]}>
										{item.date ? `${item.event} · ${item.date}` : item.event}
									</span>
								</li>
							))}
						</ol>
					</Section>

					<Section id="formats" title={labels.formats}>
						<dl
							mix={[
								m(0),
								grid(),
								gap(3),
								gridTemplate({ columns: repeat("auto-fill", "minmax(min(100%, 14rem), 1fr)") }),
							]}
						>
							{kit.formats.map((format) => (
								<div
									key={format.name}
									mix={[
										grid(),
										gap(1),
										p(4),
										rounded("lg"),
										border({ width: 1, color: "neutral" }),
									]}
								>
									<dt mix={[weight("semibold")]}>{format.name}</dt>
									<dd mix={[m(0), text("sm"), fg("neutral.muted")]}>{format.detail}</dd>
								</div>
							))}
						</dl>
					</Section>

					<Section id="links" title={labels.links}>
						<ul
							mix={[
								m(0),
								p(0),
								grid(),
								gap(3),
								gridTemplate({ columns: repeat("auto-fill", "minmax(min(100%, 13rem), 1fr)") }),
								raw({ listStyle: "none" }),
							]}
						>
							{kit.links.map((link) => (
								<li
									key={link.href}
									mix={[
										vstack({ gap: 1 }),
										p(4),
										rounded("lg"),
										border({ width: 1, color: "neutral" }),
										bg("neutral.bg-tint-hover"),
									]}
								>
									<span
										mix={[
											text("xs"),
											weight("semibold"),
											tracking("wide"),
											fg("neutral.muted"),
											raw({ textTransform: "uppercase" }),
										]}
									>
										{link.label}
									</span>
									<Link href={link.href} mix={[weight("medium"), overflowWrap("anywhere")]}>
										{displayUrl(link.href)}
									</Link>
								</li>
							))}
						</ul>
					</Section>

					<section
						aria-labelledby="contact"
						mix={[
							container("press-contact"),
							grid(),
							gap(4),
							p(5),
							bleed(4),
							minIs(0),
							border({ width: 1, color: "neutral" }),
							rounded("xl"),
							bg("neutral.bg-tint-hover"),
						]}
					>
						<div mix={[vstack({ gap: 1 })]}>
							<Heading level={2} id="contact" mix={[m(0), text("2xl")]}>
								{labels.contact}
							</Heading>
							<p mix={[m(0), fg("neutral.muted")]}>{kit.contact.intro}</p>
						</div>
						<Contact
							kit={kit}
							state={model.state}
							values={model.values}
							issues={model.issues}
							honeypot={model.honeypot}
						/>
					</section>
				</main>
			</BlogLayout>
		);
	};
}

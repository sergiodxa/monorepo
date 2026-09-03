/**
 * The sign-in page for an authorization request needing a person to authenticate.
 * A wide viewport splits into two columns, client identity beside the sign-in card,
 * collapsing to the card alone on a narrow one, whose heading becomes the client's
 * name. The credential form appears only when the request asks to create an
 * account, confining the password surface to that single flow.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { bg, fg } from "@sdxc/u/color";
import {
	block,
	flex,
	flexCol,
	gap,
	grid,
	gridTemplate,
	hidden,
	items,
	justify,
	relative,
} from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { at, dark } from "@sdxc/u/responsive";
import { is, m, maxIs, minBs, p, pbs } from "@sdxc/u/size";
import { text, textAlign, weight } from "@sdxc/u/typography";
import { Button, Card, Form, Heading, Link, Logo, Separator, Text, TextField } from "@sdxc/ui";
import { css } from "remix/ui";

import routes from "~/routes/web";

/** Container scale step at which the page splits into two columns. */
const TWO_COLUMN_WIDTH = "xl";

/** Radii of the decorative rings, largest first, drawn from the panel's bottom-left. */
const RING_RADII = [560, 490, 420, 350, 280, 210, 140, 70];

namespace AuthorizeView {
	/** A credential field's visible caption and the hint shown while it is empty. */
	export interface Field {
		label: string;
		placeholder: string;
	}

	export interface Setup {
		/** Name of the client the person is signing in to, shown so they can recognize it. */
		clientName: string;
		/** The client's own description of itself, when it registered one. */
		clientDescription: string | null;
		/** The client's logo, shown in the identity panel; initials stand in when absent. */
		clientLogoUrl: string | null;
		/** Heading above the form on a wide viewport, where the client panel carries the name. */
		title: string;
		/** Sentence under the heading. */
		description: string;
		/** Copy for the credential form's fields and both submit buttons. */
		labels: {
			name: Field;
			username: Field;
			email: Field;
			password: Field;
			submit: string;
			github: string;
			separator: string;
			/** Label of the link to the password-recovery form. */
			forgotPassword: string;
		};
		/**
		 * Whether the credential form is offered at all, which `prompt=create` asks for.
		 * The same form registers and signs in — the server decides from the email — and
		 * every field is required either way, so it is shown whole or not shown.
		 */
		showRegistration: boolean;
		/** Why the previous attempt was refused, when there was one. */
		error: string | null;
	}
}

/**
 * The concentric rings filling the identity panel's lower-left corner.
 *
 * Each ring mixes its alpha into the fill color, so every ring stays translucent
 * on its own, and the overlaps still accumulate into the figure's depth.
 */
function ConcentricRings() {
	return () => (
		<svg
			viewBox="0 0 600 600"
			aria-hidden="true"
			mix={css({
				position: "absolute",
				insetBlockEnd: 0,
				insetInlineStart: 0,
				blockSize: "37.5rem",
				inlineSize: "37.5rem",
				fill: "color-mix(in oklab, var(--ui-color-brand-500) 5%, transparent)",
				".dark &": {
					fill: "color-mix(in oklab, var(--ui-color-brand-400) 5%, transparent)",
				},
				"@media (prefers-color-scheme: dark)": {
					".system &": {
						fill: "color-mix(in oklab, var(--ui-color-brand-400) 5%, transparent)",
					},
				},
			})}
		>
			{RING_RADII.map((radius) => (
				<circle key={radius} cx="0" cy="600" r={radius} />
			))}
		</svg>
	);
}

/**
 * Renders the credential and provider sign-in page for an authorization request.
 *
 * The password-recovery link stays visible whether or not the credential form
 * shows, reaching whoever cannot sign in even outside the registration flow.
 */
export default function AuthorizeView(handle: Handle<AuthorizeView.Setup>) {
	return () => {
		let {
			clientName,
			clientDescription,
			clientLogoUrl,
			title,
			description,
			labels,
			showRegistration,
			error,
		} = handle.props;

		return (
			<main
				mix={[
					grid(),
					is("100%"),
					minBs("100dvh"),
					at(TWO_COLUMN_WIDTH, gridTemplate({ columns: "repeat(2, minmax(0, 1fr))" })),
				]}
			>
				<aside
					mix={[
						hidden(),
						relative(),
						overflow("hidden"),
						p(12),
						bg("color.neutral.100"),
						fg("color.neutral.900"),
						dark([bg("color.neutral.800"), fg("color.neutral.100")]),
						at(TWO_COLUMN_WIDTH, [flex(), flexCol(), justify("between")]),
					]}
				>
					<div mix={[flex(), flexCol(), gap(4)]}>
						<div mix={[flex(), items("center"), gap(3)]}>
							<Logo size="md">
								{clientLogoUrl ? (
									<Logo.Image src={clientLogoUrl} alt={clientName} />
								) : (
									<Logo.Fallback
										mix={[
											bg("color.neutral.200"),
											dark(bg("color.neutral.700")),
											text("xl"),
											weight("semibold"),
										]}
									>
										{clientName.charAt(0).toUpperCase()}
									</Logo.Fallback>
								)}
							</Logo>

							<Heading level={2} mix={[m(0), text("xl"), weight("semibold")]}>
								{clientName}
							</Heading>
						</div>

						{clientDescription && (
							<Text mix={[maxIs("24rem"), fg("color.neutral.600"), dark(fg("color.neutral.400"))]}>
								{clientDescription}
							</Text>
						)}
					</div>

					<ConcentricRings />
				</aside>

				<section
					mix={[
						flex(),
						flexCol(),
						items("center"),
						justify("center"),
						p(6),
						bg("color.neutral.50"),
						dark(bg("color.neutral.900")),
						pbs("15vh"),
						at(TWO_COLUMN_WIDTH, pbs(6)),
					]}
				>
					<Card mix={[is("100%"), maxIs("22.5rem")]}>
						<Card.Header mix={[textAlign("center")]}>
							<Card.Title mix={[at(TWO_COLUMN_WIDTH, hidden())]}>{clientName}</Card.Title>
							<Card.Title mix={[hidden(), at(TWO_COLUMN_WIDTH, block())]}>{title}</Card.Title>
							<Card.Description>{description}</Card.Description>
						</Card.Header>

						<Card.Content mix={[flex(), flexCol(), gap(4)]}>
							{error && (
								<Text
									role="alert"
									mix={[text("sm"), fg("danger.emphasis"), dark(fg("color.danger.300"))]}
								>
									{error}
								</Text>
							)}

							{showRegistration && (
								<Form
									method="post"
									action={routes.authorize.action.href()}
									data-rmx-document=""
									mix={[flex(), flexCol(), gap(6)]}
								>
									<TextField
										name="name"
										required
										label={labels.name.label}
										placeholder={labels.name.placeholder}
										autoComplete="name"
									/>

									<TextField
										name="username"
										required
										label={labels.username.label}
										placeholder={labels.username.placeholder}
										autoComplete="username"
									/>

									<TextField
										type="email"
										name="email"
										required
										label={labels.email.label}
										placeholder={labels.email.placeholder}
										autoComplete="email"
									/>

									<TextField
										type="password"
										name="password"
										required
										label={labels.password.label}
										placeholder={labels.password.placeholder}
										autoComplete="current-password"
										minLength={8}
									/>

									<Button type="submit" color="brand" mix={[is("100%")]}>
										{labels.submit}
									</Button>
								</Form>
							)}

							{showRegistration && (
								<div mix={[relative(), flex(), items("center")]}>
									<Separator mix={[css({ flex: "1 1 0%" })]} />
									<Text mix={[p(0, 4), text("sm"), fg("neutral.muted")]}>{labels.separator}</Text>
									<Separator mix={[css({ flex: "1 1 0%" })]} />
								</div>
							)}

							<Form
								method="post"
								action={routes.auth.provider.href({ provider: "github" })}
								data-rmx-document=""
							>
								<Button
									type="submit"
									color="neutral"
									mix={[is("100%"), flex(), items("center"), justify("center"), gap(2)]}
								>
									<svg
										viewBox="0 0 24 24"
										aria-hidden="true"
										mix={css({ inlineSize: "1.25rem", blockSize: "1.25rem", fill: "currentColor" })}
									>
										<path
											fillRule="evenodd"
											clipRule="evenodd"
											d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
										/>
									</svg>
									<span>{labels.github}</span>
								</Button>
							</Form>

							<Text mix={[m(0), text("sm"), textAlign("center")]}>
								<Link href={routes.password.forgot.index.href()} color="brand">
									{labels.forgotPassword}
								</Link>
							</Text>
						</Card.Content>
					</Card>
				</section>
			</main>
		);
	};
}

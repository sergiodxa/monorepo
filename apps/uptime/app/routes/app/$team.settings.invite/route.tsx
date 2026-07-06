/**
 * Route for the team member invite modal, rendered over the team settings page. The
 * loader rejects members without admin/owner roles, and the component posts an email to
 * the create-invite action via a fetcher, then navigates back to settings on success. It
 * exists so admins can invite teammates through a dismissable dialog without leaving
 * settings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { forbidden } from "@pkg/response";
import { Button, Description, Dialog, FieldError, Input, Label, Modal, TextField } from "@pkg/ui";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { href, useNavigate } from "react-router";
import { useFetcher } from "react-router";
import { useSpinDelay } from "spin-delay";

import type { clientAction } from "~/routes/actions/$team.create-invite/route";

import { useTeam } from "~/hooks/use-team";
import { hasActiveSubscription } from "~/middleware/customer-subscription";
import { logger } from "~/middleware/logger";
import { team } from "~/middleware/team";

import type { Route } from "./+types/route";

export async function loader() {
	logger().info("settingsInvite.loader.start", {
		route: "settings.invite",
		teamId: team().id,
	});

	let { memberships } = team();
	let subjectMembership = memberships[0];

	if (subjectMembership.role === "member") {
		logger().info("settingsInvite.loader.forbidden", {
			route: "settings.invite",
			teamId: team().id,
			reason: "member role cannot invite",
		});
		throw forbidden({ hasActiveSubscription: await hasActiveSubscription() });
	}

	logger().info("settingsInvite.loader.complete", {
		route: "settings.invite",
		teamId: team().id,
	});

	return null;
}

export default function Component({ params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.invite" });
	let teamData = useTeam();
	let navigate = useNavigate();

	let $form = useRef<HTMLFormElement>(null);
	let fetcher = useFetcher<typeof clientAction>();

	let isPending = useSpinDelay(fetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	let [hasNavigated, setHasNavigated] = useState(false);

	// Navigate forward without scroll restoration after successful submission
	useEffect(() => {
		if (fetcher.state === "idle" && fetcher.data?.ok && !hasNavigated) {
			setHasNavigated(true);
			navigate(href("/app/:team/settings", params), {
				preventScrollReset: true,
			});
		}
	}, [fetcher.state, fetcher.data, navigate, params, hasNavigated]);

	// Navigate back when dismissing the dialog (only if we haven't already navigated)
	function handleDismiss() {
		if (!hasNavigated) {
			navigate(-1);
		}
	}

	return (
		<Modal.Overlay isOpen onOpenChange={(isOpen) => !isOpen && handleDismiss()} isDismissable>
			<Modal className="w-full max-w-md">
				<Dialog>
					<Dialog.Close aria-label={t("dialog.close")} />

					<Dialog.Header>
						<Dialog.Title>{t("header.title")}</Dialog.Title>
						<Dialog.Description>{t("header.description")}</Dialog.Description>
					</Dialog.Header>

					<fetcher.Form
						method="POST"
						action={href("/actions/:team/create-invite", params)}
						ref={$form}
						onSubmit={(event) => {
							event.preventDefault();
							fetcher.submit($form.current, {
								method: "POST",
								action: href("/actions/:team/create-invite", params),
							});
						}}
					>
						<TextField type="email" name="email" isRequired autoComplete="off">
							<Label>{t("form.fields.email.label")}</Label>
							<Input placeholder={t("form.fields.email.placeholder")} />
							<Description>
								{t("form.fields.email.description", {
									team: teamData.name,
								})}
							</Description>
							<FieldError />
						</TextField>

						<Dialog.Footer>
							<Button type="button" variant="outline" color="neutral" onPress={handleDismiss}>
								{t("form.cancel")}
							</Button>
							<Button type="submit" isPending={isPending}>
								{t("form.cta")}
							</Button>
						</Dialog.Footer>
					</fetcher.Form>
				</Dialog>
			</Modal>
		</Modal.Overlay>
	);
}

// Return null to prevent error bubbling to parent during navigation
export function ErrorBoundary() {
	return null;
}

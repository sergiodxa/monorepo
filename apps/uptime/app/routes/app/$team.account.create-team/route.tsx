/**
 * Route module for the create-team modal dialog. It renders a dismissable modal with a form
 * that posts a new team name to the create-team action, delegating the success redirect to
 * that action while handling dialog dismissal by navigating back. Its ErrorBoundary returns
 * null to avoid bubbling errors to the parent during navigation. It exists to let a user spin
 * up a new team from within the account area.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Button, Description, Dialog, FieldError, Input, Label, Modal, TextField } from "@pkg/ui";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { href, useFetcher, useNavigate } from "react-router";
import { useSpinDelay } from "spin-delay";

import type { clientAction } from "~/routes/actions/create-team/route";

import type { Route } from "./+types/route";

export default function Component(_props: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.createTeam" });
	let navigate = useNavigate();

	let $form = useRef<HTMLFormElement>(null);
	let fetcher = useFetcher<typeof clientAction>();

	let isPending = useSpinDelay(fetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	let [hasNavigated, setHasNavigated] = useState(false);

	// The action handles redirect on success, so we just need to handle
	// dismissal when the dialog is closed without submitting
	useEffect(() => {
		if (fetcher.state === "idle" && fetcher.data?.ok && !hasNavigated) {
			setHasNavigated(true);
		}
	}, [fetcher.state, fetcher.data, hasNavigated]);

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
						action={href("/actions/create-team")}
						ref={$form}
						onSubmit={(event) => {
							event.preventDefault();
							fetcher.submit($form.current, {
								method: "POST",
								action: href("/actions/create-team"),
							});
						}}
					>
						<TextField name="name" isRequired autoComplete="off">
							<Label>{t("form.fields.name.label")}</Label>
							<Input placeholder={t("form.fields.name.placeholder")} />
							<Description>{t("form.fields.name.description")}</Description>
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

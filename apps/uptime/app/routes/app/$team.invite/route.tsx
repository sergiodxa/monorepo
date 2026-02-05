import { LoaderIcon } from "lucide-react";
import { useActionState, useRef } from "react";
import { TextField } from "react-aria-components";
import { useTranslation } from "react-i18next";
import { data, href, useFetcher } from "react-router";

import type { clientAction } from "~/routes/actions/$team.create-invite/route";

import { AppHeader } from "~/components/app-header";
import { Button } from "~/components/ui/button";
import { Description, FieldError, Input, Label } from "~/components/ui/field";
import { useTeam } from "~/hooks/use-team";
import { hasActiveSubscription } from "~/middleware/customer-subscription";
import { team } from "~/middleware/team";

import type { Route } from "./+types/route";

export async function loader() {
	let { memberships } = team();
	let subjectMembership = memberships[0];

	if (subjectMembership.role === "member") {
		throw data(
			{ status: 403, hasActiveSubscription: await hasActiveSubscription() },
			{ status: 403, statusText: "Forbidden" },
		);
	}

	return null;
}

export default function Component({ params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.invite" });
	let team = useTeam();

	let $form = useRef<HTMLFormElement>(null);

	let fetcher = useFetcher<typeof clientAction>();

	let [_, action, isPending] = useActionState(async () => {
		await fetcher.submit($form.current, {
			method: "POST",
			action: href("/actions/:team/create-invite", params),
		});
		$form.current?.reset();
	}, null);

	return (
		<>
			<AppHeader heading={t("header.title")} />

			<div className="p-12 flex flex-col gap-4">
				<fetcher.Form
					method="POST"
					action={href("/actions/:team/create-invite", params)}
					className="max-w-prose w-full mx-auto flex flex-col gap-6"
					ref={$form}
					onSubmit={(event) => {
						event.preventDefault();
						action();
					}}
				>
					<TextField
						type="email"
						name="email"
						className="flex flex-col gap-1"
						isRequired
						autoComplete="off"
					>
						<Label>{t("form.fields.email.label")}</Label>
						<Input placeholder={t("form.fields.email.placeholder")} className="mt-2" />
						<Description>
							{t("form.fields.email.description", {
								team: team.name,
							})}
						</Description>
						<FieldError />
					</TextField>

					<Button
						type="submit"
						className="flex items-center justify-between self-end"
						isPending={isPending}
						name="intent"
					>
						<span>{t("form.cta")}</span>
						{isPending && <LoaderIcon className="size-5 animate-spin" />}
					</Button>
				</fetcher.Form>
			</div>
		</>
	);
}

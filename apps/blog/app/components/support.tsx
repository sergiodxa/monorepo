/**
 * Support component for the blog app. Renders a localized alert card inviting
 * readers to sponsor the author, with a form that submits to the /sponsor route.
 * It exists as a reusable call-to-action block surfaced across content pages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Alert, Button, Form } from "@pkg/ui";
import { useTranslation } from "react-i18next";

export function Support() {
	let { t } = useTranslation("translation", { keyPrefix: "support" });

	return (
		<Alert color="primary">
			<Alert.Content>
				<Alert.Title>{t("title")}</Alert.Title>
				<Alert.Description>{t("description")}</Alert.Description>
			</Alert.Content>
			<Alert.Action>
				<Form action="/sponsor">
					<Button type="submit" color="primary">
						{t("cta")}
					</Button>
				</Form>
			</Alert.Action>
		</Alert>
	);
}

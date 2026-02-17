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

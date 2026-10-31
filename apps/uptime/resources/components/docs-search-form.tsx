/**
 * The docs search field: a plain GET form to `/docs/search`, so the hub, the search page
 * and the 404 ask the same question the same way and a search works before any script
 * loads. The page it lands on searches every guide's body.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { hstack } from "@sdxc/u/layout";
import { minIs } from "@sdxc/u/size";
import { Button, SearchField } from "@sdxc/ui";

import routes from "~/routes/web";

namespace DocsSearchForm {
	export interface Props {
		/** The field's accessible name ("Search the docs"). */
		label: string;
		placeholder: string;
		/** The submit button's text. */
		submit: string;
		/** The question already asked, kept in the field on the results page. */
		query?: string;
	}
}

/** Renders the field and its submit button on one row. */
export default function DocsSearchForm(handle: Handle<DocsSearchForm.Props>) {
	return () => {
		let { label, placeholder, submit, query = "" } = handle.props;
		return (
			<form
				method="get"
				action={routes.docs.search.href()}
				mix={[hstack({ gap: 2, align: "center" }), raw({ maxInlineSize: "36rem" })]}
			>
				<SearchField aria-label={label} mix={[minIs(0), raw({ flex: "1 1 auto" })]}>
					<SearchField.Input
						name="q"
						defaultValue={query}
						placeholder={placeholder}
						aria-label={label}
						autoComplete="off"
						enterKeyHint="search"
					/>
				</SearchField>
				<Button type="submit" variant="solid" color="brand">
					{submit}
				</Button>
			</form>
		);
	};
}

/**
 * The Spanish body of keeping a post: the one action no expiry, unfollow or feed change
 * reaches, where kept posts are listed, what a save holds, and the plan's cap on how many.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui/docs";
import type { Handle } from "remix/component";

import { Callout, UiLabel, UiPath } from "@sdxc/ui/docs";

import type { DocBody } from "~/resources/docs/blocks";

import { Faq, H2Es, Kbd } from "~/resources/docs/blocks";
import { docHref } from "~/resources/docs/registry";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "save", text: "Guarda una entrada", level: 2 },
	{ id: "find", text: "Encuentra lo que guardaste", level: 2 },
	{ id: "keeps", text: "Qué conserva un guardado", level: 2 },
	{ id: "limit", text: "Cuántas puedes guardar", level: 2 },
	{ id: "questions", text: "Preguntas", level: 2 },
];

/** The saving guide's body. */
export default function Saving(handle: Handle<DocBody.Props>) {
	return () => {
		let { figures } = handle.props;
		return (
			<>
				<H2Es id="save">Guarda una entrada</H2Es>
				<p>
					Pulsa <UiLabel>Guardar</UiLabel> en cualquier entrada, en cualquier lista, o pulsa{" "}
					<Kbd>s</Kbd> en la entrada en la que estás. Pulsa <UiLabel>Quitar de guardadas</UiLabel>{" "}
					para dejar de conservarla.
				</p>

				<H2Es id="find">Encuentra lo que guardaste</H2Es>
				<p>
					Abre <UiPath items={["Guardadas"]} /> en la barra lateral. Muestra todas las entradas que
					conservaste, y es la única lista que nada recorta. En De pago y Premium también puedes{" "}
					<a href={docHref("labels")}>etiquetar entradas guardadas</a> y leer una etiqueta cada vez.
				</p>

				<H2Es id="keeps">Qué conserva un guardado</H2Es>
				<p>
					Una entrada guardada se queda cuando se agota el plazo de su feed, cuando dejas de seguir
					el feed y cuando el feed deja de listarla.
				</p>
				<Callout kind="note" label="Nota">
					<p>
						Guardar conserva el título, el extracto y el enlace. Si el sitio desaparece, el enlace
						también.
					</p>
				</Callout>

				<H2Es id="limit">Cuántas puedes guardar</H2Es>
				<p>
					Gratis conserva {figures.freeSaved} entradas guardadas; De pago y Premium conservan más
					(consulta <a href={docHref("plans")}>Planes y límites</a>). Cuando Guardadas está lleno,
					un nuevo guardado te lo indica: quita una entrada de Guardadas para hacer sitio, o cambia
					a un plan mayor.
				</p>

				<H2Es id="questions">Preguntas</H2Es>
				<Faq
					items={[
						{
							question: "¿Puedo llevarme mis entradas guardadas?",
							answer: (
								<p>
									Sí. <a href={docHref("export")}>Exportar tus datos</a> incluye el título, el
									enlace, el extracto y las etiquetas de cada entrada guardada.
								</p>
							),
						},
						{
							question: "¿Una entrada guardada cuenta para las entradas que conserva mi plan?",
							answer: (
								<p>
									Cuenta, y nunca es la entrada que Reader quita para hacer sitio. Cuando llegas al
									límite de entradas de tu plan, Reader retira entradas que leíste y no guardaste,
									empezando por las más antiguas. Consulta{" "}
									<a href={docHref("over-plan-limits")}>Superé los límites de mi plan</a>.
								</p>
							),
						},
					]}
				/>
			</>
		);
	};
}

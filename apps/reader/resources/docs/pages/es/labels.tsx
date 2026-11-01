/**
 * The Spanish body of labelling kept posts: putting a label on, reading one label as a
 * list, renaming and deleting labels, and the caps on how many.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui/docs";
import type { Handle } from "remix/component";

import { Steps, UiLabel, UiPath } from "@sdxc/ui/docs";

import type { DocBody } from "~/resources/docs/blocks";

import { OrganizeScene } from "~/resources/components/marketing/scenes";
import { Faq, H2Es, Scene } from "~/resources/docs/blocks";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "add", text: "Ponle una etiqueta a una entrada", level: 2 },
	{ id: "read", text: "Lee una etiqueta", level: 2 },
	{ id: "manage", text: "Renombra o borra una etiqueta", level: 2 },
	{ id: "questions", text: "Preguntas", level: 2 },
];

/** The labels guide's body. */
export default function Labels(handle: Handle<DocBody.Props>) {
	return () => {
		let { figures, t } = handle.props;
		return (
			<>
				<p>
					Una etiqueta dice por qué conservaste una entrada: "para leer este fin de semana", "para
					el ensayo", "recetas". Las etiquetas viven en las entradas guardadas, y una entrada puede
					llevar hasta {figures.tagsPerPost}.
				</p>

				<H2Es id="add">Ponle una etiqueta a una entrada</H2Es>
				<Steps>
					<Steps.Item title="Abre Guardadas">
						<p>
							Abre <UiPath items={["Guardadas"]} />. Cada entrada guardada tiene una franja de
							etiquetas bajo su título.
						</p>
					</Steps.Item>
					<Steps.Item title="Añade una etiqueta">
						<p>
							Escribe en el campo <UiLabel>Etiqueta…</UiLabel> y pulsa Enter. Elige una etiqueta que
							ya tengas entre las sugerencias, o escribe un nombre nuevo de hasta{" "}
							{figures.tagNameLength} caracteres para crear una.
						</p>
					</Steps.Item>
				</Steps>
				<p>
					Para quitar una etiqueta, pulsa la <UiLabel>×</UiLabel> de su chip. La entrada sigue
					guardada.
				</p>
				<Scene caption="Feeds organizados en carpetas, y entradas guardadas con sus etiquetas.">
					<OrganizeScene t={t} />
				</Scene>

				<H2Es id="read">Lee una etiqueta</H2Es>
				<p>
					Pulsa una etiqueta en cualquier entrada para abrir todo lo guardado con ella en una sola
					lista. La página tiene su propia dirección, así que puedes añadirla a tus marcadores.
				</p>

				<H2Es id="manage">Renombra o borra una etiqueta</H2Es>
				<p>
					En la página de una etiqueta, pulsa <UiLabel>Renombrar</UiLabel> para cambiar su nombre en
					todas partes, o <UiLabel>Borrar etiqueta</UiLabel> y confirma. Borrar una etiqueta la
					quita de todas las entradas, y todas siguen guardadas.
				</p>

				<H2Es id="questions">Preguntas</H2Es>
				<Faq
					items={[
						{
							question: "¿Cuántas etiquetas puedo tener?",
							answer: (
								<p>
									Hasta {figures.tagLimit} etiquetas, y hasta {figures.tagsPerPost} en una misma
									entrada.
								</p>
							),
						},
						{
							question: "¿Qué pasa con mis etiquetas si me paso al plan Gratis?",
							answer: (
								<p>
									Se ocultan, y no se borra ninguna. Todo lo que conservaste sigue guardado, y tus
									etiquetas vuelven cuando regresas a De pago o Premium.
								</p>
							),
						},
					]}
				/>
			</>
		);
	};
}

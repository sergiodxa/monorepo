/**
 * The Spanish body of the filters guide: writing one as a sentence about part of a post,
 * previewing what it would have caught, applying it, and the plan caps.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui/docs";
import type { Handle } from "remix/component";

import { Callout, Steps, UiLabel, UiPath } from "@sdxc/ui/docs";

import type { DocBody } from "~/resources/docs/blocks";

import { FiltersScene } from "~/resources/components/marketing/scenes";
import { FactTable, Faq, H2Es, Scene } from "~/resources/docs/blocks";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "add", text: "Añade un filtro", level: 2 },
	{ id: "actions", text: "Qué puede hacer un filtro", level: 2 },
	{ id: "preview", text: "Previsualiza antes de añadir", level: 2 },
	{ id: "manage", text: "Cambia o elimina un filtro", level: 2 },
	{ id: "questions", text: "Preguntas", level: 2 },
];

/** The filters guide's body. */
export default function Filters(handle: Handle<DocBody.Props>) {
	return () => {
		let { figures, t } = handle.props;
		return (
			<>
				<p>
					Un filtro lee una parte de cada entrada que llega, busca un texto y decide qué pasa con la
					entrada. Se lee como una frase: cuando el título de una entrada contiene "Patrocinado",
					descártala.
				</p>
				<Scene caption="Tres filtros, cada uno una frase, con cuántas entradas ha decidido cada uno.">
					<FiltersScene t={t} />
				</Scene>

				<H2Es id="add">Añade un filtro</H2Es>
				<Steps>
					<Steps.Item title="Abre Filtros">
						<p>
							Abre <UiPath items={["Preferencias", "Filtros"]} />.
						</p>
					</Steps.Item>
					<Steps.Item title="Escribe la frase">
						<p>
							En <UiLabel>Añadir un filtro</UiLabel>, elige la{" "}
							<UiLabel>Parte de la entrada</UiLabel> (título, enlace, resumen o autoría), el{" "}
							<UiLabel>Texto a buscar</UiLabel> (hasta 100 caracteres) y{" "}
							<UiLabel>Qué le pasa</UiLabel>.
						</p>
					</Steps.Item>
					<Steps.Item title="Elige dónde se aplica">
						<p>
							En <UiLabel>Dónde se aplica</UiLabel>, deja{" "}
							<UiLabel>Todos los feeds que sigues</UiLabel> o elige un feed.
						</p>
					</Steps.Item>
					<Steps.Item title="Añádelo">
						<p>
							Pulsa <UiLabel>Añadir filtro</UiLabel>. Actúa sobre lo que llegue a partir de ahora.
						</p>
					</Steps.Item>
				</Steps>

				<H2Es id="actions">Qué puede hacer un filtro</H2Es>
				<FactTable
					caption="Las tres cosas que un filtro hace con una entrada que coincide."
					head={["Acción", "Qué pasa con la entrada"]}
					rows={[
						["Descartar", "Nunca llega a tu cola."],
						["Marcar como leída", "Llega ya leída, así que Sin leer la omite."],
						["Destacar", "Llega marcada como Destacada, así que resalta en la lista."],
					]}
				/>
				<Callout kind="note" label="Nota">
					<p>
						Un filtro sobre el resumen lee sus primeros {figures.summaryChars} caracteres, que son
						la línea bajo el título, no el artículo.
					</p>
				</Callout>

				<H2Es id="preview">Previsualiza antes de añadir</H2Es>
				<p>
					Pulsa <UiLabel>Vista previa</UiLabel> mientras escribes un filtro para ver cuáles de tus
					entradas más recientes habría atrapado. Si son las entradas que buscabas, pulsa{" "}
					<UiLabel>Aplicar a las … entradas de arriba</UiLabel> para actuar también sobre ellas
					ahora. Si coincide con todas las entradas, revisa la parte de la entrada y la ortografía
					antes de añadirlo.
				</p>

				<H2Es id="manage">Cambia o elimina un filtro</H2Es>
				<p>
					Cada filtro aparece en la página Filtros con cuántas entradas ha decidido y cuándo
					coincidió por última vez. Cámbialo y pulsa <UiLabel>Guardar cambios</UiLabel>, o pulsa{" "}
					<UiLabel>Eliminar filtro</UiLabel>. Eliminar un filtro no borra ninguna entrada.
				</p>

				<H2Es id="questions">Preguntas</H2Es>
				<Faq
					items={[
						{
							question: "¿Cuántos filtros puedo tener?",
							answer: (
								<p>
									{figures.paidRules} en De pago y {figures.premiumRules} en Premium. Gratis no
									tiene filtros.
								</p>
							),
						},
						{
							question: "¿Un filtro cambia las entradas que ya tengo?",
							answer: (
								<p>
									No. Los filtros actúan sobre lo que llega a partir de ahora. La vista previa puede
									aplicar uno a entradas recientes si se lo pides.
								</p>
							),
						},
						{
							question: "¿Qué pasa con mis filtros si cambio a Gratis?",
							answer: (
								<p>
									Se quedan donde están y dejan de ejecutarse. Nada de lo que sigues o has leído
									cambia.
								</p>
							),
						},
					]}
				/>
			</>
		);
	};
}

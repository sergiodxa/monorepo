/**
 * The Spanish body of the appearance page: the colour scheme and the reading face, both of
 * which follow the reader to any browser they sign in on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui";
import type { Handle } from "remix/component";

import { Steps, UiLabel, UiPath } from "@sdxc/ui";

import type { DocBody } from "~/resources/docs/blocks";

import { H2Es } from "~/resources/docs/blocks";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "change", text: "Cambia los colores y la tipografía", level: 2 },
	{ id: "where", text: "Dónde se aplica", level: 2 },
];

/** The appearance guide's body. */
export default function Appearance(_handle: Handle<DocBody.Props>) {
	return () => (
		<>
			<H2Es id="change">Cambia los colores y la tipografía</H2Es>
			<Steps>
				<Steps.Item title="Abre el ajuste">
					<p>
						Abre <UiPath items={["Preferencias", "Cómo se ven tus páginas"]} />.
					</p>
				</Steps.Item>
				<Steps.Item title="Elige los colores">
					<p>
						En <UiLabel>Colores</UiLabel>, elige <UiLabel>Seguir a mi sistema</UiLabel>,{" "}
						<UiLabel>Claro</UiLabel> u <UiLabel>Oscuro</UiLabel>.
					</p>
				</Steps.Item>
				<Steps.Item title="Elige una tipografía de lectura">
					<p>
						En <UiLabel>Tipografía de lectura</UiLabel>, elige <UiLabel>Sin serifa</UiLabel> o{" "}
						<UiLabel>Con serifa</UiLabel> y pulsa <UiLabel>Guardar</UiLabel>.
					</p>
				</Steps.Item>
			</Steps>

			<H2Es id="where">Dónde se aplica</H2Es>
			<p>
				Ambos ajustes se aplican desde la siguiente página y te siguen a cualquier navegador en el
				que inicies sesión. La tipografía se usa en las entradas y los artículos; los menús y los
				controles quedan como están.
			</p>
		</>
	);
}

/**
 * The Spanish body of the folders guide: filing a feed, making a folder from that same menu,
 * reading a folder as one stream, renaming and deleting one, and what a plan change does.
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
import { docHref } from "~/resources/docs/registry";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "file", text: "Guarda un feed en una carpeta", level: 2 },
	{ id: "read", text: "Lee una carpeta", level: 2 },
	{ id: "manage", text: "Renombra o elimina una carpeta", level: 2 },
	{ id: "questions", text: "Preguntas", level: 2 },
];

/** The folders guide's body. */
export default function Folders(handle: Handle<DocBody.Props>) {
	return () => {
		let { t } = handle.props;
		return (
			<>
				<H2Es id="file">Guarda un feed en una carpeta</H2Es>
				<Steps>
					<Steps.Item title="Abre el feed">
						<p>
							Elige el feed bajo <UiLabel>Feeds</UiLabel> en la barra lateral.
						</p>
					</Steps.Item>
					<Steps.Item title="Elige su carpeta">
						<p>
							Abre <UiPath items={["Más acciones", "En qué carpeta se lee este feed"]} />. Elige una
							carpeta que ya tengas, o escribe un nombre en <UiLabel>Nombra esta carpeta…</UiLabel>{" "}
							para crear una nueva.
						</p>
					</Steps.Item>
					<Steps.Item title="Guárdalo">
						<p>
							Pulsa <UiLabel>Guardar</UiLabel>. El feed aparece ahora bajo esa carpeta en la barra
							lateral. Para sacarlo, elige <UiLabel>Sacar de esta carpeta</UiLabel> en el mismo
							menú.
						</p>
					</Steps.Item>
				</Steps>
				<Scene caption="Feeds agrupados en carpetas en la barra lateral, cada una con sus entradas sin leer.">
					<OrganizeScene t={t} />
				</Scene>

				<H2Es id="read">Lee una carpeta</H2Es>
				<p>
					Pulsa el nombre de una carpeta en la barra lateral. Su página reúne todas las entradas de
					todos los feeds guardados en ella, de la más nueva a la más antigua, y se lee como la cola
					principal. Muestra cuántas entradas te esperan en toda la carpeta.
				</p>

				<H2Es id="manage">Renombra o elimina una carpeta</H2Es>
				<p>
					En la página de la carpeta, pulsa <UiLabel>Renombrar</UiLabel>, o{" "}
					<UiLabel>Eliminar carpeta</UiLabel> y confirma. Al eliminar una carpeta, sus feeds vuelven
					a estar sin carpeta, y todas las entradas se conservan.
				</p>

				<H2Es id="questions">Preguntas</H2Es>
				<Faq
					items={[
						{
							question: "¿Las carpetas vienen con OPML?",
							answer: (
								<p>
									Sí. Al <a href={docHref("import-opml")}>importar</a>, los feeds se guardan en las
									carpetas que indica el archivo, y al <a href={docHref("export")}>exportar</a> se
									escriben las tuyas.
								</p>
							),
						},
						{
							question: "¿Qué pasa con mis carpetas si cambio a Gratis?",
							answer: (
								<p>
									Las carpetas que tienes se quedan donde están. Crear carpetas nuevas y guardar
									feeds en ellas requiere De pago o Premium.
								</p>
							),
						},
					]}
				/>
			</>
		);
	};
}

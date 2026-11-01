/**
 * The Spanish body of the notifications guide: picking the feeds worth an interruption,
 * turning on push and email, allowing a browser, quiet hours, and each plan's check cadence.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui/docs";
import type { Handle } from "remix/component";

import { Callout, Steps, UiLabel, UiPath } from "@sdxc/ui/docs";

import type { DocBody } from "~/resources/docs/blocks";

import { NotifyScene } from "~/resources/components/marketing/scenes";
import { Faq, H2Es, Scene } from "~/resources/docs/blocks";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "how", text: "Cómo funcionan las notificaciones", level: 2 },
	{ id: "set-up", text: "Actívalas", level: 2 },
	{ id: "quiet", text: "Horas de silencio", level: 2 },
	{ id: "browsers", text: "Tus navegadores", level: 2 },
	{ id: "questions", text: "Preguntas", level: 2 },
];

/** The notifications guide's body. */
export default function Notifications(handle: Handle<DocBody.Props>) {
	return () => {
		let { figures, t } = handle.props;
		return (
			<>
				<H2Es id="how">Cómo funcionan las notificaciones</H2Es>
				<p>
					Reader revisa tus feeds en segundo plano, cada {figures.paidCheck} en De pago y cada{" "}
					{figures.premiumCheck} en Premium. Cuando una revisión encuentra entradas en un feed que
					elegiste, recibes una sola notificación sobre todas ellas. Nunca se envía nada sobre un
					feed que no hayas elegido.
				</p>
				<Scene caption="Una notificación que nombra cada feed elegido en el que una revisión encontró entradas.">
					<NotifyScene t={t} />
				</Scene>

				<H2Es id="set-up">Actívalas</H2Es>
				<Steps>
					<Steps.Item title="Elige un feed">
						<p>
							En la página del feed, elige{" "}
							<UiPath items={["Más acciones", "Avisarme de esta fuente"]} />. Repite con cada feed
							del que quieras enterarte.
						</p>
					</Steps.Item>
					<Steps.Item title="Elige cómo te avisamos">
						<p>
							En <UiPath items={["Preferencias", "Notificaciones"]} />, en{" "}
							<UiLabel>Por dónde te avisamos</UiLabel>, activa{" "}
							<UiLabel>En los navegadores que permitas</UiLabel>, <UiLabel>Por correo</UiLabel>, o
							ambos, y pulsa <UiLabel>Guardar</UiLabel>.
						</p>
					</Steps.Item>
					<Steps.Item title="Permite este navegador">
						<p>
							Para las notificaciones push, pulsa{" "}
							<UiLabel>Permitir notificaciones en este navegador</UiLabel> y acepta el aviso del
							navegador. Lo pregunta una vez, y no se envía nada hasta que lo permitas.
						</p>
					</Steps.Item>
				</Steps>
				<Callout kind="note" label="Nota">
					<p>
						El correo viene con Premium y llega como mucho una vez cada {figures.emailGapHours}{" "}
						horas. Las notificaciones push llegan como mucho una vez cada {figures.pushGapMinutes}{" "}
						minutos.
					</p>
				</Callout>

				<H2Es id="quiet">Horas de silencio</H2Es>
				<p>
					En <UiLabel>Horas de silencio</UiLabel>, activa{" "}
					<UiLabel>No me avises entre estas horas</UiLabel>, elige <UiLabel>Desde</UiLabel> y{" "}
					<UiLabel>Hasta</UiLabel>, y guarda. Las horas están en la zona horaria que indica tu
					navegador. Una notificación retenida no se pierde: la lleva la siguiente revisión fuera de
					ese horario.
				</p>

				<H2Es id="browsers">Tus navegadores</H2Es>
				<p>
					<UiLabel>Navegadores</UiLabel> lista cada navegador que permitiste, con la última vez que
					recibió una notificación. Pulsa <UiLabel>Olvidar</UiLabel> para dejar de notificar a uno.
				</p>

				<H2Es id="questions">Preguntas</H2Es>
				<Faq
					items={[
						{
							question: "¿Funciona en mi teléfono?",
							answer: (
								<p>
									Sí, en un navegador compatible con notificaciones push web, incluido un iPhone con
									Reader añadido a la pantalla de inicio.
								</p>
							),
						},
						{
							question: "¿Cómo dejo de recibir los correos?",
							answer: (
								<p>
									Cada correo tiene un enlace para dejar de recibirlos. Vuelve a activarlos en
									Preferencias.
								</p>
							),
						},
						{
							question: "¿Por qué no recibo notificaciones en Gratis?",
							answer: (
								<p>
									Las notificaciones salen de las revisiones en segundo plano, que hacen De pago y
									Premium. En Gratis, las entradas nuevas llegan cuando abres Reader.
								</p>
							),
						},
					]}
				/>
			</>
		);
	};
}

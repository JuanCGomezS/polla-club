import { useState } from 'react';

type PhaseId = 'before' | 'during';

const steps = [
  {
    title: '1. Activa tu plan y crea el grupo',
    description:
      'Para jugar primero debes activar un plan. Con ese pago se habilita la creación del grupo y el acceso a toda la gestión de la polla.',
  },
  {
    title: '2. Invita participantes y registren sus pronósticos',
    description:
      'Comparte enlace y código del grupo para que todos se inscriban. Cada participante puede cargar y editar marcadores y bonus hasta el cierre automático.',
  },
  {
    title: '3. PollaClub bloquea, calcula y ordena',
    description:
      'Cuando inician los partidos se bloquean los campos. La plataforma aplica reglas, calcula puntajes y actualiza la tabla de posiciones automáticamente.',
  },
];

const phases: { id: PhaseId; label: string; title: string; items: string[] }[] = [
  {
    id: 'before',
    label: 'Antes del torneo',
    title: 'Lo que haces antes de que ruede el balón',
    items: [
      'El administrador crea el grupo después de activar su plan y define la competición.',
      'Invita participantes enviando el enlace y el código del grupo.',
      'Cada participante registra sus marcadores y sus bonus (campeón, 2do, 3ro, goleador, asistidor) según la configuración del grupo.',
      'Los pronósticos se pueden editar hasta el momento de bloqueo automático.',
    ],
  },
  {
    id: 'during',
    label: 'Durante el torneo',
    title: 'Cómo se vive mientras se juega',
    items: [
      'Cada partido se bloquea justo en su hora de inicio (por ejemplo, si empieza 7:00 pm, 7:00 pm queda cerrado).',
      'Los marcadores pronosticados y evaluados corresponden a los 90 minutos reglamentarios.',
      'Esto también aplica en fases finales desde octavos en adelante: solo se pronostica marcador de tiempo reglamentario.',
      'PollaClub se encarga de aplicar reglas, bloquear campos, calcular puntos y actualizar tabla de posiciones.',
    ],
  },
];

export default function HowItWorks() {
  const [activePhase, setActivePhase] = useState<PhaseId>('before');

  const currentPhase = phases.find((p) => p.id === activePhase) ?? phases[0];

  return (
    <section
      id="como-funciona"
      className="mt-10 max-w-5xl mx-auto scroll-mt-[calc(var(--pc-header-height)+0.75rem)] text-left"
    >
      <div className="mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-[color:var(--pc-text-on-dark)] mb-3 text-center">
          ¿Cómo funciona PollaClub?
        </h2>
        <p className="text-[color:var(--pc-muted)] text-center max-w-2xl mx-auto">
          PollaClub es una plataforma para organizar pollas deportivas entre amigos. Tú pones los
          participantes, nosotros nos encargamos de los partidos, los puntos y las tablas de
          posiciones.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-10">
        {steps.map((step, index) => (
          <div
            key={step.title}
            className="bg-[color:var(--pc-surface)]/80 rounded-xl shadow-sm border border-[color:var(--pc-main-dark)]/60 p-5 flex flex-col h-full transition transform hover:-translate-y-1 hover:shadow-lg"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[color:var(--pc-accent)] text-[color:var(--pc-text-strong)] font-bold">
                {index + 1}
              </span>
              <span className="text-xs uppercase tracking-wide text-[color:var(--pc-accent)] font-semibold">
                Paso {index + 1}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-[color:var(--pc-text-on-dark)] mb-2">
              {step.title}
            </h3>
            <p className="text-sm text-[color:var(--pc-muted)]">{step.description}</p>
          </div>
        ))}
      </div>

      <div className="bg-[color:var(--pc-surface)]/80 rounded-2xl shadow-sm border border-[color:var(--pc-main-dark)]/60 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <h3 className="text-lg md:text-xl font-semibold text-[color:var(--pc-text-on-dark)]">
            Lo que debe saber cada participante
          </h3>
          <div className="inline-flex rounded-full bg-[color:var(--pc-main-dark)]/60 p-1 text-sm">
            {phases.map((phase) => (
              <button
                key={phase.id}
                type="button"
                onClick={() => setActivePhase(phase.id)}
                className={`px-3 py-1.5 rounded-full font-medium transition text-xs md:text-sm ${
                  activePhase === phase.id
                    ? 'bg-[color:var(--pc-accent)] text-[color:var(--pc-text-strong)] shadow-sm'
                    : 'text-[color:var(--pc-muted)] hover:text-[color:var(--pc-text-on-dark)]'
                }`}
              >
                {phase.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-md font-semibold text-[color:var(--pc-text-on-dark)] mb-3">
              {currentPhase.title}
            </h4>
            <ul className="space-y-2 text-sm text-[color:var(--pc-muted)]">
              {currentPhase.items.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[color:var(--pc-accent)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-[color:var(--pc-main-dark)]/60 border border-[color:var(--pc-main-dark)] rounded-xl p-4 text-sm text-[color:var(--pc-muted)] space-y-2">
            <p className="font-semibold">Reglas generales de los puntos</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Cada grupo define su puntaje: marcador exacto, ganador, diferencia de gol y
                pronósticos bonus.
              </li>
              <li>
                Los puntos se suman automáticamente cuando se cargan los resultados oficiales.
              </li>
              <li>
                La premiación no la gestiona PollaClub: cada grupo la define internamente.
              </li>
              <li>Puedes ver en cualquier momento la tabla y comparar posiciones con el grupo.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

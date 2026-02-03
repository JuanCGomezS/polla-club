import { useState, useEffect, useRef } from 'react';
import { getCurrentUser } from '../../lib/auth';
import {
  getBonusPrediction,
  saveBonusPrediction,
  isBonusLocked,
  hasAnyBonus,
  type BonusPredictionInput
} from '../../lib/bonus-predictions';
import { getCompetition } from '../../lib/competitions';
import { PARTICIPATING_TEAMS, BONUS_PLAYERS_PLACEHOLDER } from '../../lib/constants/teams-and-players';
import type { Group, Competition } from '../../lib/types';

interface BonusPredictionsFormProps {
  groupId: string;
  group: Group;
}

function filterOptions(options: string[], query: string): string[] {
  if (!query.trim()) return options;
  const q = query.trim().toLowerCase();
  return options.filter((opt) => opt.toLowerCase().includes(q));
}

function FilterableSelect({
  label,
  options,
  value,
  onChange,
  placeholder = 'Seleccionar...'
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const filtered = filterOptions(options, filter);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-left text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <span className={value ? '' : 'text-gray-500'}>{value || placeholder}</span>
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-56 flex flex-col">
          <input
            type="text"
            placeholder="Filtrar..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="mx-2 mt-2 py-1.5 px-2 border border-gray-200 rounded text-sm"
            autoFocus
          />
          <ul className="overflow-auto py-1 max-h-44">
            <li>
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                  setFilter('');
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
              >
                — Ninguno —
              </button>
            </li>
            {filtered.map((opt) => (
              <li key={opt}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                    setFilter('');
                  }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 ${value === opt ? 'bg-blue-50 font-medium' : ''}`}
                >
                  {opt}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-500">Sin resultados</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function BonusPredictionsForm({ groupId, group }: BonusPredictionsFormProps) {
  const user = getCurrentUser();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [locked, setLocked] = useState<boolean | null>(null);
  const [existing, setExisting] = useState<BonusPredictionInput | null>(null);
  const [form, setForm] = useState<BonusPredictionInput>({});
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user || !group) return;
      try {
        const [comp, isLocked, pred] = await Promise.all([
          getCompetition(group.competitionId),
          isBonusLocked(group.competitionId),
          getBonusPrediction(groupId, user.uid)
        ]);
        if (cancelled) return;
        setCompetition(comp ?? null);
        setLocked(isLocked);
        if (pred) {
          const data: BonusPredictionInput = {
            winner: pred.winner ?? '',
            runnerUp: pred.runnerUp ?? '',
            thirdPlace: pred.thirdPlace ?? '',
            topScorer: pred.topScorer ?? '',
            topAssister: pred.topAssister ?? ''
          };
          setExisting(data);
          setForm(data);
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Error al cargar');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [groupId, group?.competitionId, user?.uid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || locked === true) return;
    setSaving(true);
    try {
      await saveBonusPrediction(groupId, user.uid, form);
      setExisting({ ...form });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;
  if (loadError) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
        {loadError}
      </div>
    );
  }
  if (competition === null || locked === null) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg flex items-center gap-2">
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />
        <span className="text-gray-600">Cargando pronósticos bonus...</span>
      </div>
    );
  }
  if (!hasAnyBonus(competition)) return null;
  if (locked) {
    return (
      <section className="bg-white p-5 rounded-lg shadow border border-gray-200">
        <h2 className="text-lg font-bold text-gray-900 mb-2">Pronósticos bonus</h2>
        <p className="text-gray-600 text-sm">
          Los pronósticos bonus están cerrados. No se pueden enviar ni modificar.
        </p>
        {existing && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm space-y-1">
            {existing.winner && <p><span className="text-gray-500">Ganador:</span> {existing.winner}</p>}
            {existing.runnerUp && <p><span className="text-gray-500">Subcampeón:</span> {existing.runnerUp}</p>}
            {existing.thirdPlace && <p><span className="text-gray-500">Tercero:</span> {existing.thirdPlace}</p>}
            {existing.topScorer && <p><span className="text-gray-500">Goleador:</span> {existing.topScorer}</p>}
            {existing.topAssister && <p><span className="text-gray-500">Máximo asistidor:</span> {existing.topAssister}</p>}
          </div>
        )}
      </section>
    );
  }

  const b = competition.bonusSettings;

  return (
    <section className="bg-white p-5 rounded-lg shadow border border-gray-200">
      <h2 className="text-lg font-bold text-gray-900 mb-1">Pronósticos bonus</h2>
      <p className="text-gray-600 text-sm mb-4">
        Pronósticos globales de la competición. Puedes filtrar cada lista escribiendo en el cuadro.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {b.hasWinner && (
            <FilterableSelect
              label="Ganador de la competición"
              options={PARTICIPATING_TEAMS}
              value={form.winner ?? ''}
              onChange={(v) => setForm((f) => ({ ...f, winner: v }))}
              placeholder="Seleccionar equipo"
            />
          )}
          {b.hasRunnerUp && (
            <FilterableSelect
              label="Subcampeón"
              options={PARTICIPATING_TEAMS}
              value={form.runnerUp ?? ''}
              onChange={(v) => setForm((f) => ({ ...f, runnerUp: v }))}
              placeholder="Seleccionar equipo"
            />
          )}
          {b.hasThirdPlace && (
            <FilterableSelect
              label="Tercer lugar"
              options={PARTICIPATING_TEAMS}
              value={form.thirdPlace ?? ''}
              onChange={(v) => setForm((f) => ({ ...f, thirdPlace: v }))}
              placeholder="Seleccionar equipo"
            />
          )}
          {b.hasTopScorer && (
            <FilterableSelect
              label="Goleador"
              options={BONUS_PLAYERS_PLACEHOLDER}
              value={form.topScorer ?? ''}
              onChange={(v) => setForm((f) => ({ ...f, topScorer: v }))}
              placeholder="Seleccionar jugador"
            />
          )}
          {(b.hasTopAssister || b.hasTopScorer) && (
            <FilterableSelect
              label="Máximo asistidor"
              options={BONUS_PLAYERS_PLACEHOLDER}
              value={form.topAssister ?? ''}
              onChange={(v) => setForm((f) => ({ ...f, topAssister: v }))}
              placeholder="Seleccionar jugador"
            />
          )}
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Guardando...' : existing ? 'Actualizar pronósticos bonus' : 'Guardar pronósticos bonus'}
          </button>
        </div>
      </form>
    </section>
  );
}

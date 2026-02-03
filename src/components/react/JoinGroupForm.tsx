import { useState } from 'react';
import type { FormEvent } from 'react';
import { joinGroupByCode } from '../../lib/groups';
import { getCurrentUser } from '../../lib/auth';
import { getRoute } from '../../lib/utils';

export default function JoinGroupForm() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = getCurrentUser();
      if (!user) {
        throw new Error('No hay usuario autenticado');
      }

      const normalizedCode = code.trim().toUpperCase();

      if (!normalizedCode) {
        throw new Error('Por favor ingresa un código');
      }

      const group = await joinGroupByCode(normalizedCode, user.uid);

      // Redirigir a la lista de grupos
      window.location.href = getRoute('/groups');
    } catch (err: any) {
      setError(err.message || 'Error al unirse al grupo');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Unirse a un Grupo</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow-md">
        <p className="text-gray-600 mb-6">
          Ingresa el código del grupo que te compartió el administrador. El código tiene el formato <span className="font-mono font-semibold">PD-XXXXXX</span>.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
              Código del Grupo *
            </label>
            <input
              type="text"
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-lg tracking-wider"
              placeholder="PD-ABC123"
              required
              minLength={3}
              maxLength={20}
              autoFocus
            />
          </div>

          <div className="flex space-x-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Uniéndose...' : 'Unirse al Grupo'}
            </button>
            <a
              href={getRoute('/groups')}
              className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 text-center"
            >
              Cancelar
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

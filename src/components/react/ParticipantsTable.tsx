import { useEffect, useState } from 'react';
import { getGroup, isGroupAdmin } from '../../lib/groups';
import { getUserData } from '../../lib/auth';
import type { Group, User } from '../../lib/types';

interface ParticipantsTableProps {
  groupId: string;
}

interface ParticipantWithPoints {
  user: User;
  totalPoints: number;
  predictionsCount: number;
}

export default function ParticipantsTable({ groupId }: ParticipantsTableProps) {
  const [group, setGroup] = useState<Group | null>(null);
  const [participants, setParticipants] = useState<ParticipantWithPoints[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [groupId]);

  const loadData = async () => {
    try {
      const groupData = await getGroup(groupId);
      if (!groupData) {
        setError('Grupo no encontrado');
        setLoading(false);
        return;
      }

      setGroup(groupData);

      const participantsData: ParticipantWithPoints[] = [];
      const uids = [...new Set([...groupData.participants, groupData.adminUid])];

      for (const uid of uids) {
        try {
          const userData = await getUserData(uid);
          if (userData) {
            participantsData.push({
              user: userData,
              totalPoints: 0,
              predictionsCount: 0
            });
          } else {
            // Mostrar usuario aunque no tenga documento completo
            participantsData.push({
              user: {
                uid,
                displayName: `Usuario ${uid.substring(0, 8)}...`,
                email: 'Sin email',
                groups: [],
                canCreateGroups: false,
                createdAt: { toMillis: () => Date.now() } as any
              },
              totalPoints: 0,
              predictionsCount: 0
            });
          }
        } catch (err) {
          // Mostrar usuario aunque haya error
          participantsData.push({
            user: {
              uid,
              displayName: `Usuario ${uid.substring(0, 8)}...`,
              email: 'Error al cargar',
              groups: [],
              canCreateGroups: false,
              createdAt: { toMillis: () => Date.now() } as any
            },
            totalPoints: 0,
            predictionsCount: 0
          });
        }
      }

      participantsData.sort((a, b) => b.totalPoints - a.totalPoints);
      setParticipants(participantsData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar participantes');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Cargando participantes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-100 border border-red-400 text-red-700 rounded">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Posición
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Participante
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Puntos Totales
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pronósticos
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {participants.map((participant, index) => (
              <tr key={participant.user.uid} className={index === 0 ? 'bg-yellow-50' : ''}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="text-lg font-bold text-gray-900">{index + 1}</span>
                    {index === 0 && <span className="ml-2 text-yellow-500">🏆</span>}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{participant.user.displayName}</div>
                      <div className="text-sm text-gray-500">{participant.user.email}</div>
                    </div>
                    {group && participant.user.uid === group.adminUid && (
                      <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">Admin</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-lg font-semibold text-gray-900">{participant.totalPoints}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {participant.predictionsCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {participants.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No hay participantes en este grupo.</p>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import Modal from './Modal';
import MatchLeaderboard from './MatchLeaderboard';
import { calculateMatchMinute, formatMatchMinute } from '../../lib/match-time';
import { getTeamById } from '../../lib/competition-data';
import type { Match, Group } from '../../lib/types';

interface MatchLeaderboardModalProps {
  match: Match;
  group: Group;
  groupId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function MatchLeaderboardModal({
  match,
  group,
  groupId,
  isOpen,
  onClose
}: MatchLeaderboardModalProps) {
  const [team1Short, setTeam1Short] = useState('');
  const [team2Short, setTeam2Short] = useState('');

  useEffect(() => {
    Promise.all([
      getTeamById(group.competitionId, match.team1Id),
      getTeamById(group.competitionId, match.team2Id)
    ]).then(([t1, t2]) => {
      setTeam1Short(t1?.shortName ?? '');
      setTeam2Short(t2?.shortName ?? '');
    });
  }, [group.competitionId, match.team1Id, match.team2Id]);

  const [currentTime, setCurrentTime] = useState(new Date());
  const extraTime1 = match.extraTime1 ?? 0;
  const extraTime2 = match.extraTime2 ?? 0;
  const halftimeDuration = match.halftimeDuration ?? 15;
  
  useEffect(() => {
    if (match.status === 'live' && isOpen) {
      setCurrentTime(new Date());
      
      const interval = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [match.status, match.scheduledTime, match.startTime, isOpen]);
  
  const calculatedMinute = match.status === 'live' 
    ? calculateMatchMinute(match.scheduledTime, match.startTime, extraTime1, extraTime2, currentTime, halftimeDuration)
    : null;

  const displayMinute = calculatedMinute?.minute ?? null;
  const displayExtraTime = calculatedMinute?.extraTime ?? null;
  const displayExtraTimeTotal = calculatedMinute?.extraTimeTotal ?? null;
  const minuteStatus = calculatedMinute?.status;

  let title = '';
  if (match.result) {
    title = `${team1Short} ${match.result.team1Score} - ${match.result.team2Score} ${team2Short}`;
    if (match.status === 'live' && displayMinute != null) {
      const timeStr = formatMatchMinute(displayMinute, displayExtraTime, displayExtraTimeTotal, minuteStatus);
      title += ` - ${timeStr}`;
    }
  } else {
    title = `${team1Short} vs ${team2Short}`;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <MatchLeaderboard groupId={groupId} match={match} group={group} />
    </Modal>
  );
}

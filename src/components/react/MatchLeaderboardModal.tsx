import { useState, useEffect } from 'react';
import Modal from './Modal';
import MatchLeaderboard from './MatchLeaderboard';
import { calculateMatchMinute, formatMatchMinute } from '../../lib/match-time';
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
  const getTeamShort = (teamName: string, shortName?: string): string => {
    return shortName || teamName.substring(0, 3).toUpperCase();
  };

  const team1Short = getTeamShort(match.team1, match.team1Short);
  const team2Short = getTeamShort(match.team2, match.team2Short);

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
  const displaySeconds = calculatedMinute?.seconds ?? null;
  const minuteStatus = calculatedMinute?.status;

  let title = '';
  if (match.result) {
    title = `${team1Short} ${match.result.team1Score} - ${match.result.team2Score} ${team2Short}`;
    if (match.status === 'live' && displayMinute != null) {
      const timeStr = formatMatchMinute(displayMinute, displayExtraTime, displayExtraTimeTotal, displaySeconds, minuteStatus);
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

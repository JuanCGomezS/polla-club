import { Timestamp } from 'firebase/firestore';

export function calculateMatchMinute(
  scheduledTime: Timestamp | undefined,
  startTime: Timestamp | undefined,
  extraTime1: number = 0,
  extraTime2: number = 0,
  currentTime?: Date,
  halftimeDuration: number = 15
): { 
  minute: number | null; 
  extraTime: number | null;
  extraTimeTotal: number | null;
  seconds: number | null;
  status: 'not_started' | 'first_half' | 'first_half_extra' | 'halftime' | 'second_half' | 'second_half_extra' | 'finished' 
} {
  let matchStartTime: Date | null = null;
  
  if (startTime?.toDate) {
    matchStartTime = startTime.toDate();
  } else if (scheduledTime?.toDate) {
    matchStartTime = scheduledTime.toDate();
  }
  
  if (!matchStartTime) {
    return { minute: null, extraTime: null, extraTimeTotal: null, seconds: null, status: 'not_started' };
  }

  const now = currentTime || new Date();
  
  const elapsedMs = now.getTime() - matchStartTime.getTime();
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const secondsInMinute = elapsedSeconds % 60;

  if (elapsedMinutes < 0) {
    return { minute: null, extraTime: null, extraTimeTotal: null, seconds: null, status: 'not_started' };
  }

  const firstHalfEnd = 45 + extraTime1;
  const halftimeEnd = firstHalfEnd + halftimeDuration;
  const secondHalfEnd = 90 + extraTime2;

  if (elapsedMinutes <= firstHalfEnd) {
    if (elapsedMinutes < 45) {
      return { minute: elapsedMinutes, extraTime: null, extraTimeTotal: null, seconds: secondsInMinute, status: 'first_half' };
    } else {
      const extraTime = elapsedMinutes - 45;
      return { minute: 45, extraTime, extraTimeTotal: extraTime1, seconds: secondsInMinute, status: 'first_half_extra' };
    }
  }

  if (elapsedMinutes <= halftimeEnd) {
    return { minute: 45, extraTime: extraTime1, extraTimeTotal: extraTime1, seconds: null, status: 'halftime' };
  }

  const halftimeStart = firstHalfEnd + halftimeDuration;
  const secondHalfElapsed = elapsedMinutes - halftimeStart;
  const secondHalfMinute = 45 + secondHalfElapsed;

  if (secondHalfMinute < 90) {
    return { minute: secondHalfMinute, extraTime: null, extraTimeTotal: null, seconds: secondsInMinute, status: 'second_half' };
  }

  const extraTime = secondHalfMinute - 90;
  if (extraTime <= extraTime2) {
    return { minute: 90, extraTime, extraTimeTotal: extraTime2, seconds: secondsInMinute, status: 'second_half_extra' };
  }

  return { minute: 90, extraTime: extraTime2, extraTimeTotal: extraTime2, seconds: null, status: 'finished' };
}

export function formatMatchMinute(
  minute: number | null | undefined,
  extraTime: number | null | undefined = null,
  extraTimeTotal: number | null | undefined = null,
  status?: 'not_started' | 'first_half' | 'first_half_extra' | 'halftime' | 'second_half' | 'second_half_extra' | 'finished'
): string {
  if (minute === null || minute === undefined) {
    return '';
  }

  if (status === 'halftime') {
    if (extraTimeTotal !== null && extraTimeTotal !== undefined && extraTimeTotal > 0) {
      return `Entretiempo (45+${extraTimeTotal}')`;
    }
    return 'Entretiempo';
  }

  if (status === 'first_half_extra' && extraTimeTotal !== null && extraTimeTotal !== undefined && extraTimeTotal > 0) {
    return `45+${extraTimeTotal}'`;
  }

  if (status === 'second_half_extra' && extraTimeTotal !== null && extraTimeTotal !== undefined && extraTimeTotal > 0) {
    return `90+${extraTimeTotal}'`;
  }

  if (status === 'first_half' && minute === 45) {
    return "45'";
  }

  if (status === 'second_half' && minute === 90) {
    return "90'";
  }

  if (status === 'finished') {
    if (extraTime !== null && extraTime !== undefined && extraTime > 0) {
      return `90+${extraTime}'`;
    }
    return "90+'";
  }

  return `${minute}'`;
}

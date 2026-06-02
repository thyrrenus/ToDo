import { parseISO } from 'date-fns';

/**
 * Parses a timezone offset string like "UTC+4", "UTC-5", "UTC+5.5" or "browser"
 * and returns the offset in minutes.
 * Standard offset definition: local_time = UTC + offset_minutes
 */
export const parseTimezoneOffset = (tzString) => {
  if (!tzString || tzString === 'browser') {
    return -new Date().getTimezoneOffset();
  }
  const match = tzString.match(/UTC([+-]\d+(\.\d+)?)/);
  if (match) {
    const hours = parseFloat(match[1]);
    return Math.round(hours * 60);
  }
  return -new Date().getTimezoneOffset();
};

/**
 * Calculates the difference in minutes between the home timezone and browser's current timezone:
 * diff = home_timezone_offset - browser_timezone_offset
 */
export const getTimezoneDiffMinutes = (homeTz, activeMode) => {
  if (activeMode !== 'home' || !homeTz || homeTz === 'browser') {
    return 0;
  }
  const homeOffset = parseTimezoneOffset(homeTz);
  const browserOffset = -new Date().getTimezoneOffset();
  return homeOffset - browserOffset;
};

/**
 * Adjusts an absolute/UTC event date by adding the timezone difference in minutes
 * if active timezone mode is 'home'.
 */
export const adjustExternalDate = (date, homeTz, activeMode) => {
  if (!date || isNaN(date.getTime())) return date;
  const diffMinutes = getTimezoneDiffMinutes(homeTz, activeMode);
  if (diffMinutes === 0) return date;
  return new Date(date.getTime() + diffMinutes * 60 * 1000);
};

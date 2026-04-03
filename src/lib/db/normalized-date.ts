import { parseISO } from 'date-fns';

function isValidDate(value: Date) {
  return !Number.isNaN(value.getTime());
}

export function parseDateOnly(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (match) {
    const [, year, month, day] = match;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  }

  const parsed = parseISO(trimmed);
  if (!isValidDate(parsed)) return null;

  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

export function parseTimestamp(value: string | Date | null | undefined) {
  if (!value) return null;

  if (value instanceof Date) {
    return isValidDate(value) ? value : null;
  }

  const parsed = parseISO(value);
  return isValidDate(parsed) ? parsed : null;
}

export function formatDateOnly(value: Date | null | undefined) {
  if (!value) return null;

  const year = value.getUTCFullYear();
  const month = `${value.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${value.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function periodToMonthStart(period: string) {
  const [year, month] = period.split('-').map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, 1));
}

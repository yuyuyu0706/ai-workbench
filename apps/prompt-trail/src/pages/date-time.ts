export function formatDateTime(
  isoDateTime: string,
  options: { includeSeconds?: boolean } = {},
): string {
  const date = new Date(isoDateTime);

  if (Number.isNaN(date.getTime())) {
    return isoDateTime;
  }

  const pad = (value: number) => String(value).padStart(2, '0');

  const minutePrecision = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;

  return options.includeSeconds
    ? `${minutePrecision}:${pad(date.getSeconds())}`
    : minutePrecision;
}

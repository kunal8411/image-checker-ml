type LogValue = string | number | boolean | null;

export function logEvent(event: string, fields: Record<string, LogValue> = {}): void {
  const payload = {
    event,
    timestamp: new Date().toISOString(),
    ...fields,
  };
  console.log(JSON.stringify(payload));
}

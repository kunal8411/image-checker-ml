import type { AnalyzeResponse, EvaluationItem, EvaluationReport } from '../types/index';

export async function analyzeUpload(file: File, rows: number, columns: number): Promise<AnalyzeResponse> {
  const form = new FormData();
  form.append('image', file);
  form.append('rows', String(rows));
  form.append('columns', String(columns));
  const response = await fetch('/api/analyze', { method: 'POST', body: form });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(readError(body, response.status));
  if (!isAnalyzeResponse(body)) throw new Error('Analysis response was incomplete');
  return body;
}

export async function submitEvaluation(items: EvaluationItem[]): Promise<EvaluationReport> {
  const response = await fetch('/api/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(readError(body, response.status));
  if (!isEvaluationReport(body)) throw new Error('Evaluation response was incomplete');
  return body;
}

function readError(body: unknown, status: number): string {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const message = (body as { error?: unknown }).error;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return `Request failed (${String(status)})`;
}

function isAnalyzeResponse(value: unknown): value is AnalyzeResponse {
  return typeof value === 'object' && value !== null && Array.isArray((value as AnalyzeResponse).regions);
}

function isEvaluationReport(value: unknown): value is EvaluationReport {
  return typeof value === 'object' && value !== null && Array.isArray((value as EvaluationReport).perClass);
}

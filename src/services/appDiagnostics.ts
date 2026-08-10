import AsyncStorage from '@react-native-async-storage/async-storage';

const DIAGNOSTICS_KEY = '@bcmp_diagnostics_v1';
const MAX_DIAGNOSTICS = 50;

export interface AppDiagnosticIssue {
  id: string;
  area: string;
  message: string;
  timestamp: number;
  recoverable: boolean;
}
function sanitizeMessage(message: string): string {
  return message
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-***')
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer ***')
    .slice(0, 500);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '未知错误';
}

export async function recordAppIssue(
  area: string,
  error: unknown,
  recoverable = true
): Promise<void> {
  try {
    const current = await getAppIssues();
    const now = Date.now();
    const issue: AppDiagnosticIssue = {
      id: `issue_${now}_${Math.random().toString(36).slice(2, 8)}`,
      area,
      message: sanitizeMessage(errorMessage(error)),
      timestamp: now,
      recoverable,
    };
    await AsyncStorage.setItem(
      DIAGNOSTICS_KEY,
      JSON.stringify([issue, ...current].slice(0, MAX_DIAGNOSTICS))
    );
  } catch {
    // Diagnostics must never become a second failure source.
  }
}

export async function getAppIssues(): Promise<AppDiagnosticIssue[]> {
  try {
    const raw = await AsyncStorage.getItem(DIAGNOSTICS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function clearAppIssues(): Promise<void> {
  await AsyncStorage.removeItem(DIAGNOSTICS_KEY);
}

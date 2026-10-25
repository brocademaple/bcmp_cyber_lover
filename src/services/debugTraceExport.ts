import * as FileSystem from 'expo-file-system/legacy';
import type { DebugTurnTrace } from '../types';
import {
  DEBUG_TRACE_EXPORT_DIR,
  buildDebugTraceExportFileStem,
  buildDebugTraceHtml,
  buildDebugTraceMarkdown,
} from '../utils/debugTraceExport';

export type DebugTraceExportResult = {
  directoryUri: string;
  markdownUri: string;
  htmlUri: string;
  traceCount: number;
};

export async function exportDebugTurnTraces(
  traces: DebugTurnTrace[],
  nowTs = Date.now()
): Promise<DebugTraceExportResult> {
  if (!FileSystem.documentDirectory) {
    throw new Error('当前运行环境没有可写入的 documentDirectory');
  }

  const directoryUri = `${FileSystem.documentDirectory}${DEBUG_TRACE_EXPORT_DIR}/`;
  await FileSystem.makeDirectoryAsync(directoryUri, { intermediates: true });

  const fileStem = buildDebugTraceExportFileStem(nowTs);
  const markdownUri = `${directoryUri}${fileStem}.md`;
  const htmlUri = `${directoryUri}${fileStem}.html`;

  await FileSystem.writeAsStringAsync(markdownUri, buildDebugTraceMarkdown(traces, nowTs));
  await FileSystem.writeAsStringAsync(htmlUri, buildDebugTraceHtml(traces, nowTs));

  return {
    directoryUri,
    markdownUri,
    htmlUri,
    traceCount: traces.length,
  };
}

import type { DebugTurnTrace } from '../types';

export const DEBUG_TRACE_EXPORT_DIR = 'docs/private/chat-logic';

function formatLocalTime(ts: number) {
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatFileTime(ts: number) {
  const date = new Date(ts);
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

function jsonBlock(value: unknown) {
  return JSON.stringify(value ?? null, null, 2);
}

function markdownFence(content: string, lang = '') {
  const safe = content.replace(/```/g, '`` `');
  return `\`\`\`${lang}\n${safe || '空'}\n\`\`\``;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function traceHeading(trace: DebugTurnTrace, index: number) {
  return `${index + 1}. ${trace.characterName} · ${formatLocalTime(trace.timestamp)}`;
}

function sortChronological(traces: DebugTurnTrace[]) {
  return traces.slice().sort((a, b) => a.timestamp - b.timestamp);
}

export function buildDebugTraceExportFileStem(nowTs = Date.now()) {
  return `debug-turn-traces-${formatFileTime(nowTs)}`;
}

export function buildDebugTraceMarkdown(traces: DebugTurnTrace[], nowTs = Date.now()) {
  const ordered = sortChronological(traces);
  const lines: string[] = [
    '# AI 调试台真实 Turn Trace 导出',
    '',
    `导出时间：${formatLocalTime(nowTs)}`,
    `导出目录：${DEBUG_TRACE_EXPORT_DIR}/`,
    `Trace 数量：${ordered.length}`,
    '',
    '## 使用说明',
    '',
    '- 本文件来自 AI 调试台的真实聊天 turn trace。',
    '- Trace 使用独立调试存储，不读写聊天记录主存储。',
    '- 时间按 trace 发生时间升序排列。',
    '',
  ];

  ordered.forEach((trace, index) => {
    lines.push(`## ${traceHeading(trace, index)}`);
    lines.push('');
    lines.push(`- Trace ID：${trace.id}`);
    lines.push(`- 角色：${trace.characterName} (${trace.characterId})`);
    lines.push(`- 时间：${formatLocalTime(trace.timestamp)} / ${new Date(trace.timestamp).toISOString()}`);
    lines.push(`- 模型：${trace.model}`);
    lines.push(`- 记忆判断：${trace.memoryDecision}`);
    lines.push(`- 亲密度 delta：${trace.affinityDelta ?? '未运行'}`);
    if (trace.userMessageId) lines.push(`- 用户消息 ID：${trace.userMessageId}`);
    if (trace.assistantMessageId) lines.push(`- AI 消息 ID：${trace.assistantMessageId}`);
    lines.push('');
    lines.push('### 用户消息');
    lines.push('');
    lines.push(markdownFence(trace.userText));
    lines.push('');
    lines.push('### Prompt 摘要');
    lines.push('');
    lines.push(markdownFence(trace.promptSummary));
    if (trace.promptRequestSummary?.length) {
      lines.push('');
      lines.push('#### Prompt 请求摘要');
      lines.push('');
      for (const item of trace.promptRequestSummary) {
        lines.push(`- ${item.label}: ${item.value}`);
      }
    }
    if (trace.promptSections?.length) {
      lines.push('');
      lines.push('#### Prompt 分段');
      lines.push('');
      for (const section of trace.promptSections) {
        lines.push(`##### ${section.active === false ? '未启用 - ' : ''}${section.title}`);
        lines.push('');
        lines.push(markdownFence(section.content));
        lines.push('');
      }
    }
    if (trace.promptMessagesPreview?.length) {
      lines.push('#### API Messages Preview');
      lines.push('');
      trace.promptMessagesPreview.forEach((message, messageIndex) => {
        lines.push(`##### ${messageIndex + 1}. ${message.role}${message.hasImage ? ' + image' : ''}`);
        lines.push('');
        lines.push(markdownFence(message.contentPreview));
        lines.push('');
      });
    }
    if (trace.promptNotes?.length) {
      lines.push('#### Prompt Notes');
      lines.push('');
      for (const note of trace.promptNotes) {
        lines.push(`- ${note}`);
      }
      lines.push('');
    }
    lines.push('### 记忆判断');
    lines.push('');
    lines.push(markdownFence(trace.memoryDecisionDetail || trace.memoryDecision, 'json'));
    lines.push('');
    lines.push('### 情绪前后状态');
    lines.push('');
    lines.push('#### Before');
    lines.push('');
    lines.push(markdownFence(jsonBlock(trace.emotionBefore), 'json'));
    lines.push('');
    lines.push('#### After');
    lines.push('');
    lines.push(markdownFence(jsonBlock(trace.emotionAfter), 'json'));
    lines.push('');
    lines.push('### AI 回复');
    lines.push('');
    lines.push(markdownFence(trace.assistantText || '未生成回复'));
    if (trace.errorMessage) {
      lines.push('');
      lines.push('### Error');
      lines.push('');
      lines.push(markdownFence(trace.errorMessage));
    }
    lines.push('');
  });

  return lines.join('\n').trimEnd() + '\n';
}

export function buildDebugTraceHtml(traces: DebugTurnTrace[], nowTs = Date.now()) {
  const markdown = buildDebugTraceMarkdown(traces, nowTs);
  const lines = markdown.split(/\r?\n/);
  const htmlLines: string[] = [];
  let inCode = false;
  let codeLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (!inCode) {
        inCode = true;
        codeLines = [];
      } else {
        htmlLines.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        inCode = false;
        codeLines = [];
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      htmlLines.push(`<h${level}>${escapeHtml(heading[2])}</h${level}>`);
      continue;
    }
    if (line.startsWith('- ')) {
      htmlLines.push(`<p class="bullet">${escapeHtml(line)}</p>`);
      continue;
    }
    htmlLines.push(line.trim() ? `<p>${escapeHtml(line)}</p>` : '');
  }

  if (inCode) {
    htmlLines.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  }

  const body = htmlLines.join('\n');

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AI 调试台真实 Turn Trace</title>
  <style>
    body { margin: 0; padding: 32px; font: 14px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #172033; background: #f7f7fb; }
    main { max-width: 1040px; margin: 0 auto; background: #fff; border: 1px solid #dde1ea; border-radius: 8px; padding: 28px; }
    h1, h2, h3, h4, h5 { line-height: 1.25; margin: 24px 0 10px; }
    h1 { margin-top: 0; font-size: 28px; }
    h2 { border-top: 1px solid #e8ebf2; padding-top: 22px; }
    p { white-space: pre-wrap; margin: 6px 0; }
    pre { overflow: auto; padding: 14px; background: #101827; color: #f4f7fb; border-radius: 8px; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
    .bullet { padding-left: 16px; }
  </style>
</head>
<body>
  <main>
${body}
  </main>
</body>
</html>`;
}

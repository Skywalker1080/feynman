import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import xml from 'highlight.js/lib/languages/xml';
import markdown from 'highlight.js/lib/languages/markdown';
import diff from 'highlight.js/lib/languages/diff';
import sql from 'highlight.js/lib/languages/sql';
import yaml from 'highlight.js/lib/languages/yaml';
import ini from 'highlight.js/lib/languages/ini';
import powershell from 'highlight.js/lib/languages/powershell';
import css from 'highlight.js/lib/languages/css';
import type { LanguageFn } from 'highlight.js';
import type { Theme } from './theme';

const REGISTERED_LANGUAGES: Array<[string, LanguageFn]> = [
  ['javascript', javascript],
  ['typescript', typescript],
  ['python', python],
  ['json', json],
  ['bash', bash],
  ['xml', xml],
  ['markdown', markdown],
  ['diff', diff],
  ['sql', sql],
  ['yaml', yaml],
  ['ini', ini],
  ['powershell', powershell],
  ['css', css],
];

/** Language aliases hljs does not already resolve. */
const LANGUAGE_ALIASES: Record<string, string> = {
  shell: 'bash',
  html: 'xml',
  htm: 'xml',
  tsx: 'javascript',
  jsx: 'javascript',
  text: 'plaintext',
};

const AUTO_LANGUAGES = [
  'javascript',
  'typescript',
  'python',
  'json',
  'bash',
  'yaml',
  'diff',
  'markdown',
  'xml',
  'sql',
];

let languagesRegistered = false;
function ensureRegistered(): void {
  if (languagesRegistered) return;
  for (const [name, fn] of REGISTERED_LANGUAGES) hljs.registerLanguage(name, fn);
  languagesRegistered = true;
}

function resolveLanguage(language: string | undefined): string | undefined {
  if (!language) return undefined;
  ensureRegistered();
  const name = LANGUAGE_ALIASES[language] ?? language;
  return hljs.getLanguage(name)?.name?.toLowerCase() ?? name;
}

const FENCE_RE = /^([ \t]*)(`{3,}|~{3,})(.*)$/;

export type TextPart = { type: 'text'; text: string };
export type CodePart = { type: 'code'; language?: string; code: string };
export type Segment = TextPart | CodePart;

/**
 * Split markdown text into plain-text and fenced code-block segments.
 * An unclosed trailing fence (still streaming) is kept as a code segment.
 */
export function splitCodeBlocks(text: string): Segment[] {
  const segments: Segment[] = [];
  const textLines: string[] = [];
  let codeLines: string[] = [];
  let codeLang: string | undefined;
  let inCode = false;

  const flushText = (): void => {
    if (textLines.length > 0) {
      segments.push({ type: 'text', text: textLines.join('\n') });
      textLines.length = 0;
    }
  };
  const flushCode = (): void => {
    if (inCode) {
      segments.push({ type: 'code', language: codeLang, code: codeLines.join('\n') });
      codeLines = [];
      codeLang = undefined;
      inCode = false;
    }
  };

  for (const line of text.split('\n')) {
    const m = FENCE_RE.exec(line);
    if (m) {
      if (inCode) {
        flushCode();
      } else {
        flushText();
        inCode = true;
        codeLang = resolveLanguage(m[3]?.trim() || undefined);
        codeLines = [];
      }
      continue;
    }
    if (inCode) codeLines.push(line);
    else textLines.push(line);
  }
  flushCode();
  flushText();
  return segments;
}

export interface CodeToken {
  text: string;
  className?: string;
}

const SPAN_RE = /<span class="([^"]+)">|<\/span>/g;

function unescapeHtml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightToHtml(code: string, language: string | undefined): string {
  ensureRegistered();
  const resolved = resolveLanguage(language);
  if (resolved && hljs.getLanguage(resolved)) {
    try {
      return hljs.highlight(code, { language: resolved, ignoreIllegals: true }).value;
    } catch {
      // fall through to auto-detection
    }
  }
  try {
    return hljs.highlightAuto(code, AUTO_LANGUAGES).value;
  } catch {
    return escapeHtml(code);
  }
}

function normalizeClass(className: string): string {
  return className.split(' ')[0]!.replace(/^hljs-/, '');
}

/** Flatten hljs HTML into runs of text with an active class (nesting-aware). */
function htmlToRuns(html: string): CodeToken[] {
  const runs: CodeToken[] = [];
  const stack: Array<string | undefined> = [];
  let className: string | undefined;
  let lastIndex = 0;
  SPAN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SPAN_RE.exec(html))) {
    if (m.index > lastIndex) {
      runs.push({ text: unescapeHtml(html.slice(lastIndex, m.index)), className });
    }
    if (m[1] !== undefined) {
      stack.push(className);
      className = normalizeClass(m[1]);
    } else {
      className = stack.pop() ?? undefined;
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < html.length) {
    runs.push({ text: unescapeHtml(html.slice(lastIndex)), className });
  }
  return runs;
}

/** Tokenize code into per-line token runs (colors carry across line breaks). */
export function tokenizeLines(code: string, language?: string): CodeToken[][] {
  const html = highlightToHtml(code, language);
  const runs = htmlToRuns(html);
  const lines: CodeToken[][] = [];
  let line: CodeToken[] = [];
  for (const run of runs) {
    const parts = run.text.split('\n');
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        lines.push(line);
        line = [];
      }
      if (parts[i]!.length > 0) line.push({ text: parts[i]!, className: run.className });
    }
  }
  lines.push(line);
  return lines;
}

/** Map an hljs class to a theme color role; `undefined` renders plain. */
const CLASS_TO_ROLE: Record<string, keyof Theme> = {
  keyword: 'accent',
  title: 'accent',
  function: 'accent',
  class: 'accent',
  type: 'accent',
  built_in: 'accent',
  tag: 'accent',
  string: 'success',
  'meta-string': 'success',
  number: 'warning',
  literal: 'warning',
  symbol: 'warning',
  section: 'warning',
  attr: 'warning',
  name: 'warning',
  comment: 'muted',
  doctag: 'muted',
  params: 'muted',
  meta: 'muted',
  operator: 'muted',
  punctuation: 'muted',
  addition: 'success',
  deletion: 'error',
};

export function colorForClass(className: string | undefined, theme: Theme): string | undefined {
  if (!className) return undefined;
  const base = className.split(' ')[0]!.replace(/^hljs-/, '');
  const role = CLASS_TO_ROLE[base];
  return role ? theme[role] : undefined;
}

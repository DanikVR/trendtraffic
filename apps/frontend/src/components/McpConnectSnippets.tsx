/**
 * McpConnectSnippets — общий блок «как подключить MCP» с ключом, встроенным
 * в готовые артефакты. Используется в ДВУХ местах:
 *   - /settings → карточка «Claude Connector (MCP)» (McpConnectorCard);
 *   - /settings/enterprise → вкладка MCP (Section5Mcp).
 *
 * Способ 1 — приложение Claude («Add custom connector», без терминала):
 *   два копируемых поля (Название + URL-с-ключом ?key=) и 5 шагов.
 * Способ 2 — Claude Desktop: кнопка «Скачать MCP для Claude»
 *   (готовый claude_desktop_config.json) + сниппет конфига.
 * Способ 3 — Claude Code: команда одной строкой.
 *
 * rawKey=null → плейсхолдер в сниппетах, кнопка скачивания выключена.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Download } from 'lucide-react';

const KEY_PLACEHOLDER = 'vbvx_mcp_ВАШ-КЛЮЧ';

export function desktopSnippet(url: string, rawKey: string): string {
  return JSON.stringify({
    mcpServers: {
      trendtraffic: {
        command: 'npx',
        args: ['-y', 'mcp-remote', url, '--transport', 'http-only', '--header', 'Authorization:${MCP_AUTH}'],
        env: { MCP_AUTH: `Bearer ${rawKey}` },
      },
    },
  }, null, 2);
}

export function codeSnippet(url: string, rawKey: string): string {
  return `claude mcp add --transport http trendtraffic ${url} --header "Authorization: Bearer ${rawKey}"`;
}

/** URL для «Add custom connector» в приложении Claude: ключ прямо в URL
 *  (кастом-коннекторы не умеют слать заголовки; бэкенд принимает ?key=). */
export function connectorUrl(url: string, rawKey: string): string {
  return `${url}?key=${rawKey}`;
}

/** «Скачать MCP для Claude» — готовый файл конфига Claude Desktop с ключом. */
function downloadDesktopConfig(url: string, rawKey: string): void {
  const blob = new Blob([desktopSnippet(url, rawKey)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'claude_desktop_config.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

export function McpConnectSnippets({ url, rawKey }: { url: string; rawKey?: string | null }) {
  const { t } = useTranslation('common');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const snippetKey = rawKey || KEY_PLACEHOLDER;
  const hasKey = !!rawKey;

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch { /* clipboard недоступен */ }
  };

  const CopyBtn = ({ text, field }: { text: string; field: string }) => (
    <button
      type="button"
      onClick={() => handleCopy(text, field)}
      className="flex-shrink-0 px-2.5 py-2 rounded-lg text-xs transition-colors"
      style={{
        background: copiedField === field ? 'rgba(16,185,129,0.15)' : 'var(--bg-tertiary)',
        border: `1px solid ${copiedField === field ? 'rgba(16,185,129,0.35)' : 'var(--border-medium)'}`,
        color: copiedField === field ? '#10b981' : 'var(--text-secondary)',
      }}
      title={t('settings.mcp.copy', 'Скопировать')}
    >
      {copiedField === field ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );

  return (
    <div>
      {/* ── Способ 1 — приложение Claude (Add custom connector), без терминала ── */}
      <div className="rounded-xl p-3.5 mb-3" style={{ background: 'rgba(217,119,87,0.06)', border: '1px solid rgba(217,119,87,0.25)' }}>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-xs font-700" style={{ color: 'var(--text-primary)' }}>
            {t('settings.mcp.way1Title', 'Способ 1 — в приложении Claude')}
          </span>
          <span className="text-[10px] font-700 px-2 py-0.5 rounded-full" style={{ background: 'rgba(217,119,87,0.15)', color: '#D97757' }}>
            {t('settings.mcp.way1Badge', 'рекомендуется, без терминала')}
          </span>
        </div>

        {/* Два поля для формы «Add custom connector» */}
        <div className="space-y-1.5 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] w-16 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
              {t('settings.mcp.way1Name', 'Название')}
            </span>
            <code className="flex-1 text-xs px-3 py-2 rounded-lg truncate"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', fontFamily: 'ui-monospace, monospace' }}>
              TrendTraffic
            </code>
            <CopyBtn text="TrendTraffic" field="cname" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] w-16 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>URL</span>
            <code className="flex-1 text-xs px-3 py-2 rounded-lg truncate"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', fontFamily: 'ui-monospace, monospace' }}>
              {connectorUrl(url, snippetKey)}
            </code>
            <CopyBtn text={connectorUrl(url, snippetKey)} field="curl" />
          </div>
        </div>

        <ol className="space-y-1 mb-1" style={{ margin: 0, paddingInlineStart: 0, listStyle: 'none' }}>
          {[
            t('settings.mcp.way1Step1', 'Внизу слева нажмите на профиль и откройте настройки'),
            t('settings.mcp.way1Step2', 'В колонке слева выберите «Connectors»'),
            t('settings.mcp.way1Step3', 'Справа вверху: «Add», затем «Add custom connector»'),
            t('settings.mcp.way1Step4', 'Вставьте название и URL выше, поля OAuth оставьте пустыми, нажмите «Add»'),
            t('settings.mcp.way1Step5', 'В новом чате напишите: проверь связь с TrendTraffic'),
          ].map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-[11.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              <span className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-700 mt-[1px]"
                    style={{ background: 'rgba(217,119,87,0.15)', color: '#D97757' }}>{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* ── Способ 2 — Claude Desktop: скачать готовый файл конфига ── */}
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
            <label className="text-xs font-600 uppercase tracking-wider"
                   style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
              {t('settings.mcp.way2Title', 'Способ 2 — Claude Desktop (файл)')}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => downloadDesktopConfig(url, snippetKey)}
                disabled={!hasKey}
                title={hasKey ? undefined : t('settings.mcp.way2NeedKey', 'Сначала создайте ключ — он попадёт в файл')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-700 transition-colors"
                style={{
                  background: hasKey ? '#D97757' : 'var(--bg-tertiary)',
                  border: '1px solid ' + (hasKey ? '#D97757' : 'var(--border-medium)'),
                  color: hasKey ? '#fff' : 'var(--text-muted)',
                  cursor: hasKey ? 'pointer' : 'not-allowed',
                }}
              >
                <Download size={13} /> {t('settings.mcp.way2Download', 'Скачать MCP для Claude')}
              </button>
              <CopyBtn text={desktopSnippet(url, snippetKey)} field="desktop" />
            </div>
          </div>
          <pre className="text-[11px] px-3 py-2.5 rounded-xl overflow-x-auto leading-relaxed"
               style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', fontFamily: 'ui-monospace, monospace', margin: 0 }}>
            {desktopSnippet(url, snippetKey)}
          </pre>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-600 uppercase tracking-wider"
                   style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
              {t('settings.mcp.way3Title', 'Способ 3 — Claude Code (одна команда)')}
            </label>
            <CopyBtn text={codeSnippet(url, snippetKey)} field="code" />
          </div>
          <pre className="text-[11px] px-3 py-2.5 rounded-xl overflow-x-auto leading-relaxed"
               style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', fontFamily: 'ui-monospace, monospace', margin: 0 }}>
            {codeSnippet(url, snippetKey)}
          </pre>
        </div>

        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {t('settings.mcp.snippetHint', 'Windows: конфиг Claude Desktop лежит в %APPDATA%\\Claude\\claude_desktop_config.json. После вставки перезапустите Claude Desktop. Тонкая настройка прав ключа — в Настройках Enterprise → MCP.')}
        </p>
      </div>
    </div>
  );
}

export default McpConnectSnippets;

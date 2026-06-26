/**
 * Обработчик MCP по JSON-RPC 2.0 (Streamable HTTP, режим JSON-ответа без SSE).
 *
 * Поддержано: initialize, notifications/initialized, ping, tools/list, tools/call,
 * resources/list, prompts/list. Каждый запрос несёт свой контекст (tenantId + scopes),
 * полученный из Bearer MCP-ключа в роутере — сервер сам по себе stateless.
 *
 * SSE-стриминг и OAuth — следующие фазы; для запрос/ответ-инструментов JSON-режим
 * совместим со спецификацией.
 */

import { toolsForScopes, toToolSpec, getTool, type McpToolContext } from './registry.js';
import './tools.js'; // side-effect: регистрация инструментов в реестре

const PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = { name: 'VibeVox', version: '1.0.0' };

interface JsonRpcMessage {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: any;
}

function rpcResult(id: any, result: any) {
  return { jsonrpc: '2.0', id, result };
}
function rpcError(id: any, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

/**
 * Обрабатывает одно JSON-RPC сообщение. Возвращает объект-ответ или null для
 * нотификаций (на них ответ не отправляется).
 */
export async function handleMcpMessage(ctx: McpToolContext, msg: JsonRpcMessage): Promise<any | null> {
  const { id, method, params } = msg || {};
  const isNotification = id === undefined || id === null;

  try {
    switch (method) {
      case 'initialize':
        return rpcResult(id, {
          protocolVersion: typeof params?.protocolVersion === 'string' ? params.protocolVersion : PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
        });

      case 'notifications/initialized':
      case 'notifications/cancelled':
        return null;

      case 'ping':
        return rpcResult(id, {});

      case 'tools/list':
        return rpcResult(id, { tools: toolsForScopes(ctx.scopes).map(toToolSpec) });

      case 'tools/call': {
        const name = String(params?.name || '');
        const tool = getTool(name);
        if (!tool) return rpcError(id, -32602, `Неизвестный инструмент: ${name}`);
        if (!tool.requiredScopes.every((s) => ctx.scopes.includes(s))) {
          return rpcResult(id, {
            content: [{ type: 'text', text: 'Недостаточно прав (scope) для этого инструмента' }],
            isError: true,
          });
        }
        try {
          const data = await tool.handler(ctx, params?.arguments || {});
          return rpcResult(id, {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
            structuredContent: data as any,
          });
        } catch (err: any) {
          return rpcResult(id, {
            content: [{ type: 'text', text: `Ошибка: ${err?.message || err}` }],
            isError: true,
          });
        }
      }

      case 'resources/list':
        return rpcResult(id, { resources: [] });
      case 'prompts/list':
        return rpcResult(id, { prompts: [] });

      default:
        if (isNotification) return null;
        return rpcError(id, -32601, `Метод не поддерживается: ${method}`);
    }
  } catch (err: any) {
    if (isNotification) return null;
    return rpcError(id, -32603, err?.message || 'Внутренняя ошибка');
  }
}

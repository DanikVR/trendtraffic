/**
 * Реестр MCP-инструментов — ядро расширяемости.
 *
 * Каждый блок программы регистрирует свои тулзы здесь одним вызовом registerTool().
 * MCP-сервер итерирует реестр для tools/list и диспатчит tools/call. Добавить новый
 * блок = добавить дескриптор + registerTool(...) — MCP-слой переписывать не нужно.
 *
 * tools/list для конкретного ключа отдаёт только те тулзы, чьи requiredScopes ⊆ scopes ключа.
 */

import { hasScopes, type McpScope } from './scopes.js';

export interface McpToolContext {
  tenantId: string;
  scopes: string[];
}

export interface McpToolDef {
  /** Имя тулзы (snake_case), уникально. */
  name: string;
  /** Человекочитаемый заголовок (опц.). */
  title?: string;
  description: string;
  /** JSON Schema входных аргументов (как ожидает MCP tools/list). */
  inputSchema: Record<string, any>;
  /** Скоупы, без которых тулза не видна и не вызывается. */
  requiredScopes: McpScope[];
  /** Обработчик: получает контекст (tenantId + scopes) и аргументы. */
  handler: (ctx: McpToolContext, args: Record<string, any>) => Promise<unknown>;
}

const TOOLS = new Map<string, McpToolDef>();

export function registerTool(tool: McpToolDef): void {
  TOOLS.set(tool.name, tool);
}

export function getTool(name: string): McpToolDef | undefined {
  return TOOLS.get(name);
}

/** Тулзы, доступные данному набору скоупов. */
export function toolsForScopes(scopes: string[]): McpToolDef[] {
  return Array.from(TOOLS.values()).filter((t) => hasScopes(scopes, t.requiredScopes));
}

/** Спецификация тулзы для ответа tools/list (без handler'а). */
export function toToolSpec(t: McpToolDef): Record<string, any> {
  return {
    name: t.name,
    ...(t.title ? { title: t.title } : {}),
    description: t.description,
    inputSchema: t.inputSchema,
  };
}

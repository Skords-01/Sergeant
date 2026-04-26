/**
 * Anthropic tool-use definitions + system-prompt префікс для `/api/chat`.
 *
 * Tool-дефініції розбиті по доменних файлах у `toolDefs/`, щоб кожен домен
 * можна було редагувати незалежно. Цей файл збирає їх у єдиний масив `TOOLS`
 * і реекспортує `SYSTEM_PREFIX` — публічний контракт, який імпортує `chat.ts`.
 *
 * Всі tool-результати виконуються клієнтом, сервер лише пересилає `tool_use`-
 * блоки від моделі й отримує назад `tool_results` — тому змінювати сигнатури
 * tools треба синхронно з frontend-виконавцями (`src/core/lib/hubChatActions.ts`).
 */

export type { AnthropicTool } from "./toolDefs/types.js";

import { FINYK_TOOLS } from "./toolDefs/finyk.js";
import { FIZRUK_TOOLS } from "./toolDefs/fizruk.js";
import { ROUTINE_TOOLS } from "./toolDefs/routine.js";
import { NUTRITION_TOOLS } from "./toolDefs/nutrition.js";
import { CROSS_MODULE_TOOLS } from "./toolDefs/crossModule.js";
import { UTILITY_TOOLS } from "./toolDefs/utility.js";
import { MEMORY_TOOLS } from "./toolDefs/memory.js";

import type { AnthropicTool } from "./toolDefs/types.js";

export const TOOLS: AnthropicTool[] = [
  ...FINYK_TOOLS,
  ...ROUTINE_TOOLS,
  ...FIZRUK_TOOLS,
  ...NUTRITION_TOOLS,
  ...CROSS_MODULE_TOOLS,
  ...UTILITY_TOOLS,
  ...MEMORY_TOOLS,
];

export {
  SYSTEM_PREFIX,
  SYSTEM_PROMPT_VERSION,
} from "./toolDefs/systemPrompt.js";

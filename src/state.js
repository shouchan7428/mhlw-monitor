/**
 * state.js
 * 既読アイテムIDの永続化管理
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

export function loadState(filePath) {
  if (!existsSync(filePath)) {
    return { seenIds: new Set(), lastRun: null };
  }
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf-8"));
    return {
      seenIds: new Set(raw.seenIds || []),
      lastRun: raw.lastRun ? new Date(raw.lastRun) : null,
    };
  } catch {
    return { seenIds: new Set(), lastRun: null };
  }
}

export function saveState(filePath, state, maxAgeDays = 90) {
  // 古いIDをプルーン（maxAgeDays日以上前のものは削除対象だが、
  // IDだけでは日付がわからないので件数上限で管理）
  const ids = Array.from(state.seenIds);
  const pruned = ids.slice(-5000); // 最大5000件保持

  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  writeFileSync(
    filePath,
    JSON.stringify(
      { seenIds: pruned, lastRun: new Date().toISOString() },
      null,
      2,
    ),
    "utf-8",
  );
}

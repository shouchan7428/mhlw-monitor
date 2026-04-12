#!/usr/bin/env node
/**
 * main.js
 * 厚生労働省・PMDA 新着情報モニタリング メインスクリプト
 *
 * 使い方:
 *   node main.js               通常実行
 *   node main.js --test-email  メール設定のテスト送信
 *   node main.js --force       既読状態を無視して全件処理（デバッグ用）
 */

import { readFileSync, appendFileSync } from "fs";
import { resolve } from "path";
import { fetchAllSources } from "./src/fetcher.js";
import { filterRelevantItems } from "./src/filter.js";
import { sendDigestEmail, sendTestEmail } from "./src/emailer.js";
import { loadState, saveState } from "./src/state.js";

// ─── 設定読み込み ─────────────────────────────────────────────────
const configPath = resolve("./config.json");
let config;
try {
  config = JSON.parse(readFileSync(configPath, "utf-8"));
} catch (err) {
  console.error("❌ config.json の読み込みに失敗しました:", err.message);
  process.exit(1);
}

const stateFile = resolve(config.state?.file || "./data/seen.json");
const maxAgeDays = config.state?.maxAge || 90;
const logFile = resolve("./data/monitor.log");

// ─── ロガー ───────────────────────────────────────────────────────
function log(level, message) {
  const ts = new Date().toLocaleString("ja-JP", { hour12: false });
  const line = `${ts} [${level}] ${message}`;
  console.log(line);
  appendFileSync(logFile, line + "\n", "utf-8");
}

// ─── CLI フラグ解析 ───────────────────────────────────────────────
const args = process.argv.slice(2);
const isTestEmail = args.includes("--test-email");
const isForce = args.includes("--force");

// ─── メイン処理 ───────────────────────────────────────────────────
async function main() {
  const startTime = Date.now();
  log("INFO", "========== 実行開始 ==========");

  // テストメール
  if (isTestEmail) {
    log("INFO", "テストメールを送信します...");
    await sendTestEmail(config);
    log("INFO", "テストメール送信完了");
    return;
  }

  // ── 1. 状態読み込み ──────────────────────────────────────────
  const state = loadState(stateFile);
  log("INFO", `既読アイテム数: ${state.seenIds.size}件`);

  // ── 2. RSS取得 ───────────────────────────────────────────────
  log("INFO", "フィード取得中...");
  const allItems = await fetchAllSources(config.sources);
  log("INFO", `フィード取得完了: ${allItems.length}件`);

  // ── 3. 新着フィルタ ──────────────────────────────────────────
  const newItems = isForce
    ? allItems
    : allItems.filter((item) => !state.seenIds.has(item.id));

  log("INFO", `新着アイテム: ${newItems.length}件${isForce ? " (--force モード)" : ""}`);

  if (newItems.length === 0) {
    log("INFO", "新着情報なし。終了します。");
    updateStateAndExit(state, allItems, stateFile, maxAgeDays, startTime);
    return;
  }

  // ── 4. AI関連性フィルタ ──────────────────────────────────────
  log("INFO", "AI関連性判定中...");
  const relevantItems = await filterRelevantItems(newItems, config);
  log("INFO", `関連情報: ${relevantItems.length}件`);

  // ── 5. 状態更新（メール送信前に保存） ────────────────────────
  for (const item of allItems) {
    state.seenIds.add(item.id);
  }
  saveState(stateFile, state, maxAgeDays);
  log("INFO", "状態を保存しました");

  // ── 6. メール送信 ────────────────────────────────────────────
  if (relevantItems.length === 0) {
    log("INFO", "関連情報なし。メールは送信しません。");
  } else {
    log("INFO", `メール送信中... (${relevantItems.length}件)`);
    try {
      await sendDigestEmail(relevantItems, config);
      log("INFO", "メール送信完了");
    } catch (err) {
      log("ERROR", `メール送信失敗: ${err.message}`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log("INFO", `完了 (${elapsed}秒)`);
}

function updateStateAndExit(state, allItems, stateFile, maxAgeDays, startTime) {
  for (const item of allItems) state.seenIds.add(item.id);
  saveState(stateFile, state, maxAgeDays);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log("INFO", `完了 (${elapsed}秒)`);
}

main().catch((err) => {
  log("ERROR", `予期しないエラー: ${err.message}`);
  process.exit(1);
});

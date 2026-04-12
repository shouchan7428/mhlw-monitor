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

import { readFileSync } from "fs";
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

// ─── CLI フラグ解析 ───────────────────────────────────────────────
const args = process.argv.slice(2);
const isTestEmail = args.includes("--test-email");
const isForce = args.includes("--force");

// ─── メイン処理 ───────────────────────────────────────────────────
async function main() {
  const startTime = Date.now();
  console.log(`\n${"=".repeat(60)}`);
  console.log(
    `厚生労働省モニタリング 開始: ${new Date().toLocaleString("ja-JP")}`,
  );
  console.log("=".repeat(60));

  // テストメール
  if (isTestEmail) {
    console.log("テストメールを送信します...");
    await sendTestEmail(config);
    return;
  }

  // ── 1. 状態読み込み ──────────────────────────────────────────
  const state = loadState(stateFile);
  console.log(`\n📋 既読アイテム数: ${state.seenIds.size}件`);
  if (state.lastRun) {
    console.log(`   前回実行: ${state.lastRun.toLocaleString("ja-JP")}`);
  }

  // ── 2. RSS取得 ───────────────────────────────────────────────
  console.log(`\n📡 フィード取得中...`);
  const allItems = await fetchAllSources(config.sources);
  console.log(`   合計: ${allItems.length}件取得`);

  // ── 3. 新着フィルタ ──────────────────────────────────────────
  const newItems = isForce
    ? allItems
    : allItems.filter((item) => !state.seenIds.has(item.id));

  console.log(
    `\n🆕 新着アイテム: ${newItems.length}件${isForce ? " (--force モード)" : ""}`,
  );

  if (newItems.length === 0) {
    console.log("   新着情報はありませんでした。");
    updateStateAndExit(state, allItems, stateFile, maxAgeDays, startTime);
    return;
  }

  // ── 4. AI関連性フィルタ ──────────────────────────────────────
  console.log(`\n🤖 AI関連性判定中...`);
  const relevantItems = await filterRelevantItems(newItems, config);
  console.log(`   関連情報: ${relevantItems.length}件`);

  // ── 5. 状態更新（メール送信前に保存） ────────────────────────
  for (const item of allItems) {
    state.seenIds.add(item.id);
  }
  saveState(stateFile, state, maxAgeDays);
  console.log(`\n💾 状態を保存しました`);

  // ── 6. メール送信 ────────────────────────────────────────────
  if (relevantItems.length === 0) {
    console.log("\n📭 関連情報なし。メールは送信しません。");
  } else {
    console.log(`\n📧 メール送信中... (${relevantItems.length}件)`);
    try {
      await sendDigestEmail(relevantItems, config);
      console.log("   ✅ 送信完了");
    } catch (err) {
      console.error("   ❌ メール送信失敗:", err.message);
      // メール失敗でも状態はすでに保存済み
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ 完了 (${elapsed}秒)\n`);
}

function updateStateAndExit(state, allItems, stateFile, maxAgeDays, startTime) {
  for (const item of allItems) state.seenIds.add(item.id);
  saveState(stateFile, state, maxAgeDays);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ 完了 (${elapsed}秒)\n`);
}

main().catch((err) => {
  console.error("\n❌ 予期しないエラー:", err);
  process.exit(1);
});

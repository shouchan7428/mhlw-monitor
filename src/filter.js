/**
 * filter.js
 * Claude APIを使って関連性フィルタリングと要約を行う
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const BATCH_SIZE = 20; // 1リクエストで処理するアイテム数

/**
 * 新着アイテムを関連性スコアでフィルタし、要約を付与して返す
 */
export async function filterRelevantItems(items, config) {
  const { keywords, description } = config.relevanceProfile;

  // ステップ1: キーワードで高速プレフィルタ
  const kwFiltered = items.filter((item) =>
    keywords.some(
      (kw) => item.title.includes(kw) || item.description.includes(kw),
    ),
  );

  console.log(`  キーワードマッチ: ${kwFiltered.length}/${items.length}件`);

  if (kwFiltered.length === 0) {
    // キーワードマッチがなくても全件をAIに渡す（見逃し防止）
    console.log("  → キーワード未マッチのため全件をAI判定に渡します");
    return await batchFilter(items.slice(0, 50), description);
  }

  return await batchFilter(kwFiltered, description);
}

/**
 * バッチでClaude APIに関連性を問い合わせ
 */
async function batchFilter(items, profileDescription) {
  const results = [];

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const filtered = await filterBatch(batch, profileDescription);
    results.push(...filtered);
    if (i + BATCH_SIZE < items.length) {
      await sleep(500); // レートリミット対策
    }
  }

  return results;
}

async function filterBatch(batch, profileDescription) {
  const itemList = batch
    .map(
      (it, idx) =>
        `[${idx}] タイトル: ${it.title}\n    概要: ${it.description.slice(0, 200)}`,
    )
    .join("\n\n");

  const prompt = `あなたは日本の医療機器・薬事規制の専門家です。
以下のプロフィールに照らして、各記事が「関連あり」かどうかを判定してください。

## 関心プロフィール
${profileDescription}

## 記事一覧
${itemList}

## 出力形式（JSONのみ、前置き不要）
{
  "results": [
    {
      "index": 0,
      "relevant": true,
      "score": 0.9,
      "reason": "医療機器の認証基準改正に関する通知であるため",
      "summary": "○○に関する認証基準が改正され、△△が変更される。施行日は□□。"
    },
    ...
  ]
}

relevantはtrue/false。scoreは0.0〜1.0（0.7以上を関連ありと判断）。
summaryは関連の有無に関わらず２～３文で記載。内容・背景を含める。`;

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON not found in response");

    const parsed = JSON.parse(jsonMatch[0]);
    const relevant = [];

    for (const r of parsed.results) {
      if (r.relevant && r.score >= 0.7) {
        relevant.push({
          ...batch[r.index],
          aiSummary: r.summary,
          aiScore: r.score,
          aiReason: r.reason,
        });
      }
    }

    return relevant;
  } catch (err) {
    console.error("  AI判定エラー:", err.message);
    // フォールバック: キーワードマッチのみで返す
    return batch.map((it) => ({
      ...it,
      aiSummary: it.description.slice(0, 150),
      aiScore: null,
    }));
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

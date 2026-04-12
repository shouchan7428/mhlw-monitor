/**
 * emailer.js
 * 関連記事のダイジェストメールを送信する
 */

import nodemailer from "nodemailer";

/**
 * ダイジェストメールを送信
 */
export async function sendDigestEmail(items, config) {
  const { from, to, subjectPrefix, smtp } = config.email;
  const today = formatDate(new Date());

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure || false,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });

  const subject = `${subjectPrefix} 新着${items.length}件 (${today})`;
  const html = buildHtml(items, today);
  const text = buildText(items, today);

  await transporter.sendMail({ from, to, subject, html, text });
}

/**
 * HTMLメール本文を生成
 */
function buildHtml(items, today) {
  const rows = items
    .map(
      (it, i) => `
    <tr style="border-bottom:1px solid #e5e7eb;">
      <td style="padding:16px 12px; vertical-align:top;">
        <div style="font-size:11px; color:#6b7280; margin-bottom:4px;">
          ${escHtml(it.source)}
          ${it.pubDate ? " · " + formatDate(it.pubDate) : ""}
          ${it.aiScore ? ` · 関連度 ${Math.round(it.aiScore * 100)}%` : ""}
        </div>
        <a href="${escHtml(it.link)}" style="font-size:15px; font-weight:600; color:#1d4ed8; text-decoration:none;">
          ${escHtml(it.title)}
        </a>
        ${
          it.aiSummary
            ? `<div style="margin-top:8px; font-size:13px; color:#374151; line-height:1.6;">
                ${escHtml(it.aiSummary)}
               </div>`
            : ""
        }
        ${
          it.aiReason
            ? `<div style="margin-top:6px; font-size:11px; color:#9ca3af;">📌 ${escHtml(it.aiReason)}</div>`
            : ""
        }
      </td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0; padding:0; background:#f9fafb; font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans',sans-serif;">
  <div style="max-width:680px; margin:24px auto; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.1);">

    <div style="background:#1e40af; padding:20px 24px; color:#fff;">
      <div style="font-size:11px; opacity:.7; margin-bottom:4px;">厚生労働省・PMDA モニタリング</div>
      <div style="font-size:20px; font-weight:700;">薬事規制 新着情報 ${today}</div>
      <div style="font-size:13px; opacity:.8; margin-top:4px;">${items.length}件の関連情報が見つかりました</div>
    </div>

    <table style="width:100%; border-collapse:collapse;">
      ${rows}
    </table>

    <div style="padding:16px 24px; background:#f3f4f6; font-size:11px; color:#9ca3af; border-top:1px solid #e5e7eb;">
      このメールは mhlw-monitor により自動生成されました。<br>
      ソース: 厚生労働省 / PMDA RSS フィード + Claude AI による関連性判定
    </div>
  </div>
</body>
</html>`;
}

/**
 * プレーンテキストメール本文を生成（HTMLが表示できない環境向け）
 */
function buildText(items, today) {
  const lines = [
    `厚生労働省・PMDA 新着情報 ${today}`,
    `${items.length}件の関連情報\n`,
    "=".repeat(60),
  ];

  for (const it of items) {
    lines.push("");
    lines.push(
      `【${it.source}】${it.pubDate ? " " + formatDate(it.pubDate) : ""}`,
    );
    lines.push(it.title);
    if (it.aiSummary) lines.push(it.aiSummary);
    lines.push(it.link);
    lines.push("-".repeat(40));
  }

  return lines.join("\n");
}

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(d) {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, "0")}/${String(dt.getDate()).padStart(2, "0")}`;
}

/**
 * テスト送信（接続確認用）
 */
export async function sendTestEmail(config) {
  const { from, to, smtp } = config.email;
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure || false,
    auth: { user: smtp.user, pass: smtp.pass },
  });

  await transporter.verify();
  await transporter.sendMail({
    from,
    to,
    subject: "[厚労省モニタリング] テスト送信",
    text: "メール設定が正常に動作しています。",
  });
  console.log("テストメール送信成功");
}

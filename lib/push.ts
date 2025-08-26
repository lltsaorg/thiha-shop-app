// /lib/push.ts
import webpush from "web-push";

const PUB = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const PRI = process.env.VAPID_PRIVATE_KEY || "";
const SUB = process.env.VAPID_SUBJECT || ""; // 例: "mailto:admin@example.com" or "https://yourdomain.com"

function validSubject(s: string) {
  return /^mailto:|^https:\/\//.test(s);
}

let ready = false;
if (PUB && PRI && SUB && validSubject(SUB)) {
  webpush.setVapidDetails(SUB, PUB, PRI);
  ready = true;
} else {
  console.warn(
    "[web-push] disabled. Provide NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT (mailto: or https://)"
  );
}

export function isPushReady() {
  return ready;
}

/**
 * 管理者へ通知（安全化版）
 * いまは設定が揃っていない場合は何もしません（例外を出しません）
 * 実際に配信したい場合は、ここで AdminSubscriptions シートから購読情報を読んで
 * webpush.sendNotification(subscription, JSON.stringify({ title, body })) を呼んでください。
 */
export async function notifyAdmins(title: string, body: string) {
  if (!ready) return; // 設定が無効なら黙ってスキップ
  // TODO: AdminSubscriptions シートから購読一覧を読み、for...of で送信するなど
  // ここではダミー実装（安全に no-op）
  console.log(`[web-push] notifyAdmins (${title}): ${body}`);
}

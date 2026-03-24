interface TelegramOptions {
  chatId: string;
  message: string;
}

export function escapeTelegramHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function sendTelegramNotification({
  chatId,
  message,
}: TelegramOptions) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.log("[TELEGRAM STUB]", { chatId, message });
    return { success: true, stub: true };
  }

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("[TELEGRAM ERROR]", error);
    return { success: false, error };
  }

  return { success: true };
}

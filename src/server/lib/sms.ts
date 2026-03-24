interface SendSMSOptions {
  phone: string;
  message: string;
}

export async function sendSMS({ phone, message }: SendSMSOptions) {
  const apiKey = process.env.SMSTOOLS_API_KEY;

  if (!apiKey) {
    console.log("[SMS STUB]", { phone, message });
    return { success: true, stub: true };
  }

  const response = await fetch("https://api.smstools.sk/3/send_batch", {
    method: "POST",
    headers: { "Content-Type": "application/json;charset=UTF-8" },
    body: JSON.stringify({
      auth: { apikey: apiKey },
      data: {
        message,
        sender: { text: "Strojcek" },
        recipients: [{ phonenr: phone }],
      },
    }),
  });

  const result = await response.json();

  if (result.id !== "OK") {
    console.error("[SMS ERROR]", result);
    return { success: false, error: result.note || result.id };
  }

  return { success: true, batchId: result.data?.batch_id };
}

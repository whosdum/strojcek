interface SendSMSOptions {
  phone: string;
  message: string;
}

export async function sendSMS({ phone, message }: SendSMSOptions) {
  const token = process.env.GATEWAYAPI_TOKEN;

  if (!token) {
    console.log("[SMS STUB]", { phone, message });
    return { success: true, stub: true };
  }

  const response = await fetch("https://gatewayapi.com/rest/mtsms", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(token + ":").toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: "Strojcek",
      recipients: [{ msisdn: phone.replace("+", "") }],
      message,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[SMS ERROR]", error);
    return { success: false, error };
  }

  return { success: true };
}

export type DiscordMessageRequest = {
  body: BodyInit;
  headers?: Record<string, string>;
};

const JSON_HEADERS = { "Content-Type": "application/json" };

function getImageExtension(contentType: string): string {
  if (contentType.includes("jpeg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "png";
}

export async function buildDiscordCertificateMessage(
  embed: Record<string, unknown>,
  certificateUrl?: string | null,
): Promise<DiscordMessageRequest> {
  if (!certificateUrl) {
    return {
      headers: JSON_HEADERS,
      body: JSON.stringify({ embeds: [embed] }),
    };
  }

  try {
    const imageResponse = await fetch(certificateUrl);
    if (!imageResponse.ok) {
      throw new Error(`Certificate image fetch failed with ${imageResponse.status}`);
    }

    const contentType = imageResponse.headers.get("content-type") || "image/png";
    const extension = getImageExtension(contentType);
    const filename = `certificate.${extension}`;

    const formData = new FormData();
    formData.append(
      "payload_json",
      JSON.stringify({
        embeds: [
          {
            ...embed,
            image: { url: `attachment://${filename}` },
          },
        ],
      }),
    );
    formData.append("files[0]", await imageResponse.blob(), filename);

    return { body: formData };
  } catch (error) {
    console.error("Falling back to remote certificate URL in Discord embed:", error);
    return {
      headers: JSON_HEADERS,
      body: JSON.stringify({
        embeds: [
          {
            ...embed,
            image: { url: certificateUrl },
          },
        ],
      }),
    };
  }
}
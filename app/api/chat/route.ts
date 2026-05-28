import { NextResponse } from "next/server";

const DEEPSEEK_API_URL = "https://api.deepseek.com";
const API_KEY = process.env.DEEPSEEK_API_KEY;

function extractJsonObject(text: string) {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    return cleaned;
  }

  return cleaned.slice(start, end + 1);
}

function buildFallbackReply(contentStr: string) {
  if (contentStr) {
    return contentStr.slice(0, 80);
  }

  return "\u4f60\u521a\u624d\u7684\u95ee\u9898\u91cc\uff0c\u54ea\u4e2a\u524d\u63d0\u6700\u503c\u5f97\u5148\u88ab\u8ffd\u95ee\uff1f";
}

export async function POST(req: Request) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const { messages } = await req.json();

    if (!API_KEY) {
      return NextResponse.json(
        {
          error:
            "API Key \u672a\u914d\u7f6e\u3002\u8bf7\u5728 .env.local \u4e2d\u6dfb\u52a0 DEEPSEEK_API_KEY\u3002",
        },
        { status: 500 }
      );
    }

    const response = await fetch(`${DEEPSEEK_API_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        temperature: 1.3,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("DeepSeek API Error:", errorData);
      return NextResponse.json(
        {
          error: `DeepSeek API \u8c03\u7528\u5931\u8d25: ${response.status} ${response.statusText}`,
          details: errorData,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const contentStr = (data.choices?.[0]?.message?.content || "").trim();
    const extractedJson = extractJsonObject(contentStr);

    let jsonContent;
    try {
      jsonContent = JSON.parse(extractedJson);
    } catch {
      console.error("JSON Parse Error:", contentStr);
      jsonContent = {
        reply: buildFallbackReply(contentStr),
        analysis: {
          is_new_topic: false,
          reasoning:
            "\u6a21\u578b\u8fd4\u56de\u5185\u5bb9\u4e0d\u662f\u5408\u6cd5 JSON\uff0c\u5df2\u515c\u5e95",
        },
      };
    }

    return NextResponse.json(jsonContent);
  } catch (error: any) {
    console.error("Server Fetch Error:", error);

    if (error.cause?.code === "UND_ERR_CONNECT_TIMEOUT" || error.name === "TypeError") {
      return NextResponse.json(
        {
          error:
            "\u7f51\u7edc\u8fde\u63a5\u8d85\u65f6\u6216\u5931\u8d25\u3002\u8bf7\u68c0\u67e5\u60a8\u7684\u7f51\u7edc\u8bbe\u7f6e\u6216\u5c1d\u8bd5\u914d\u7f6e HTTPS_PROXY\u3002",
          details: error.message,
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

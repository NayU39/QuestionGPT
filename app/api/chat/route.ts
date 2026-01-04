import { NextResponse } from 'next/server';

// ---------------------------------------------------------
// DeepSeek API 配置
// ---------------------------------------------------------
// 修改为 Base URL
const DEEPSEEK_API_URL = "https://api.deepseek.com";
const API_KEY = process.env.DEEPSEEK_API_KEY;

// 如果你在本地无法连接，尝试在终端设置代理环境变量启动：
// Mac/Linux: export HTTPS_PROXY=http://127.0.0.1:7890 && npm run dev
// Windows (PowerShell): $env:HTTPS_PROXY="http://127.0.0.1:7890"; npm run dev

export async function POST(req: Request) {
  const controller = new AbortController();
  // 设置 60 秒超时，防止默认连接超时过短
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const { messages } = await req.json();

    if (!API_KEY) {
      return NextResponse.json(
        { error: "API Key 未配置。请在 .env.local 中添加 DEEPSEEK_API_KEY。" },
        { status: 500 }
      );
    }

    // 在此处补全路径 /chat/completions
    const response = await fetch(`${DEEPSEEK_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat', 
        messages: messages,
        temperature: 1.3, // 苏格拉底模式
        response_format: { type: "json_object" }, 
      }),
      signal: controller.signal, // 绑定超时控制
    });

    clearTimeout(timeoutId); // 请求成功，清除超时定时器

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("DeepSeek API Error:", errorData);
      return NextResponse.json({ 
        error: `DeepSeek API 调用失败: ${response.status} ${response.statusText}`,
        details: errorData
      }, { status: response.status });
    }

    const data = await response.json();
    
    // 清理 Markdown 标记
    let contentStr = data.choices[0].message.content || "";
    contentStr = contentStr.replace(/```json/g, "").replace(/```/g, "").trim();
    
    let jsonContent;
    try {
        jsonContent = JSON.parse(contentStr);
    } catch (e) {
        console.error("JSON Parse Error:", contentStr);
        jsonContent = { 
            reply: contentStr, 
            analysis: { is_new_topic: false, reasoning: "Parse Error" } 
        };
    }

    return NextResponse.json(jsonContent);

  } catch (error: any) {
    console.error("Server Fetch Error:", error);
    
    // 专门处理连接超时/网络错误
    if (error.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' || error.name === 'TypeError') {
        return NextResponse.json({ 
            error: "网络连接超时或失败。请检查您的网络设置或尝试配置 HTTPS_PROXY。",
            details: error.message
        }, { status: 504 });
    }

    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  } finally {
    clearTimeout(timeoutId);
  }
}
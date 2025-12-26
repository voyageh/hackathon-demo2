// Background service worker for YouTube Memories.ai Assistant

// ============================================
// 配置区域 - 在这里填写你的 API Key
// ============================================
const GEMINI_API_KEY = 'AIzaSyCV_B39KAETfZuoJcaQ1x3q7rY6ypwCw4s';

// Gemini API configuration
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL = 'gemini-3-pro-preview';

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Received:', request.action);

  if (request.action === 'analyzeVideo') {
    handleAnalyzeVideo(request)
      .then(result => {
        console.log('[Background] Success, result length:', result?.length);
        sendResponse({ success: true, result });
      })
      .catch(error => {
        console.error('[Background] Error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }

  if (request.action === 'generateKnowledgeGraph') {
    handleGenerateKnowledgeGraph(request)
      .then(result => {
        console.log('[Background] Knowledge graph generated');
        sendResponse({ success: true, result });
      })
      .catch(error => {
        console.error('[Background] Error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

// Handle knowledge graph generation
async function handleGenerateKnowledgeGraph(request) {
  const { videoUrl, metadata } = request;

  console.log('[Background] Generating knowledge graph...');
  console.log('[Background] Video:', metadata.title);

  // Check API key
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
    throw new Error('Please configure API Key in background.js');
  }

  const knowledgeGraphPrompt = `
你是一个专业的知识图谱生成助手。请基于以下 YouTube 视频信息，生成一份可视化的知识图谱。

【视频信息】
标题：${metadata.title || '未知'}
频道：${metadata.channel || '未知'}
简介：${metadata.description || '无'}
链接：${videoUrl}

【任务】
生成一个 Mermaid 格式的知识图谱，展示视频的核心知识结构和关联关系。

【输出格式】（严格遵守 JSON 格式）

输出一个 JSON 对象，包含以下字段：

{
  "title": "${metadata.title || '视频知识图谱'}",
  "summary": "2-3句话的视频核心内容总结",
  "mermaidCode": "Mermaid mindmap 代码",
  "keyPoints": [
    {
      "title": "关键点标题",
      "description": "简短描述",
      "importance": "high/medium/low"
    }
  ],
  "connections": [
    {
      "from": "概念A",
      "to": "概念B",
      "relationship": "关系类型"
    }
  ]
}

【Mermaid 代码要求】
1. 使用 mindmap 类型
2. 视频主题作为根节点
3. 分支包含 3-5 个主要部分
4. 每个主要部分下有 2-4 个子节点
5. 层级不超过 3 层

【Mermaid mindmap 示例】
mindmap
  root((视频主题))
    第一部分
      关键点1
      关键点2
    第二部分
      关键点3

【输出要求 - 极其重要】
1. 严格输出纯 JSON，第一个字符是 {，最后一个字符是 }
2. 不要输出任何其他文字、解释、markdown 标记
3. mermaidCode 字段：直接写 mindmap 代码，用 \\n 表示换行
4. keyPoints 数组：精确 4 个元素，每个包含 title、description（20字内）、importance
5. connections 数组：精确 3 个元素，每个包含 from、to、relationship
6. 确保数组最后一个元素后面没有逗号
7. 确保所有括号、引号正确闭合
8. summary 控制在 50 字以内
9. mermaidCode 控制在 10 个节点以内

【必须完整输出 JSON，包括闭合的 ] 和 }】

【示例输出格式】
{"title":"示例","summary":"简短总结","mermaidCode":"mindmap\\n  root((主题))\\n    分支1\\n      点1\\n    分支2\\n      点2","keyPoints":[{"title":"点1","description":"简短描述","importance":"high"},{"title":"点2","description":"简短描述","importance":"medium"},{"title":"点3","description":"简短描述","importance":"medium"},{"title":"点4","description":"简短描述","importance":"low"}],"connections":[{"from":"概念A","to":"概念B","relationship":"关系"},{"from":"概念B","to":"概念C","relationship":"关系"},{"from":"概念A","to":"概念C","relationship":"关系"}]}
`;

  const result = await callGeminiAPI(knowledgeGraphPrompt, null, 0.3);
  console.log('[Background] Knowledge graph generated');

  return result;
}

// Handle video analysis
async function handleAnalyzeVideo(request) {
  const { prompt, videoUrl, metadata, conversationHistory, isInitial } = request;

  console.log('[Background] Starting analysis...');
  console.log('[Background] Video:', metadata.title);
  console.log('[Background] Is initial:', isInitial);

  // Check API key
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
    throw new Error('Please configure API Key in background.js');
  }

  // Build prompt
  let fullPrompt = buildPrompt(prompt, videoUrl, metadata, conversationHistory, isInitial);
  console.log('[Background] Prompt:', fullPrompt.substring(0, 200) + '...');

  // Build system prompt for follow-up questions
  let systemPrompt = null;
  if (!isInitial && conversationHistory && conversationHistory.length > 0) {
    systemPrompt = `
    你是一个 YouTube 视频学习助手，负责回答用户在观看视频过程中的追问。
你必须以“视频内容”为唯一可信来源，帮助用户理解、推理和应用视频信息。

【输入信息】
- 视频标题：{title}
- 视频简介：{description}
- 视频内容（字幕/片段/摘要）：{transcript_or_chunks}
- 当前用户提问：{user_question}
- 对话历史：{chat_history}

【核心原则（最重要）】
1) 严格基于视频内容回答，不要凭空补充视频没说过的事实。
2) 若视频内容无法支持回答：
   - 明确告诉用户“视频中没有提到/无法确认”
   - 提供你可以做的替代帮助（解释概念、给通用建议、或请用户提供时间点/原句）
3) 避免答非所问：先用一句话直接回答用户问题，再补充依据。
4) 回答要简洁、有结构：结论 → 依据（引用视频点）→ 延伸（可选）。
5) 不要输出长篇总结、不要复述整段视频，优先针对用户问题。
6) 禁止出现编造的引用、编造的时间戳、编造的“视频里说过…”。
7) 对视频观点保持中立，不替用户下结论，但可以帮助用户分析利弊与逻辑。

【回答格式（强制）】
- 用中文回答。
- 优先使用以下结构（根据问题选择）：

【一句话回答】
（直接回答用户问的内容）

【视频依据】
- 依据点1：用视频中的原意转述（不要编造引用）
- 依据点2：...

【补充解释/举例】（可选）
（用更通俗的方式解释，让用户听懂）

【你可以继续问】（可选）
给用户 1~2 个能推进理解的追问方向

【处理追问的策略】
- 如果用户问“为什么/怎么做到/有什么证据”，你需要：
  ①先给答案 ②再讲逻辑链（因果、条件、前提）③指出视频的依据点
- 如果用户问“能不能应用到我身上/我该怎么做”，你需要：
  ①先给适用条件 ②给 1-3 个可执行步骤 ③说明哪些点来自视频，哪些是通用建议
- 如果用户问“这个视频讲的对吗/我不同意”，你需要：
  ①总结视频观点 ②列出支持与反对理由 ③给出判断标准，而不是替用户站队
- 如果用户问“视频里有没有提到X”，你需要：
  ①明确回答“提到/没提到/不确定” ②如果提到，概括相关内容 ③如果没提到，告诉用户可以看哪些相关段落或我能提供通用解释

【输出限制】
- 不要输出任何“作为AI我无法…”的套话
- 不要输出“以下是总结/概括”
- 不要使用过度热情或冗余的语气
- 单次回答尽量控制在 120~200 字，除非用户明确要求详细
    `;
  }

  // Call API
  const result = await callGeminiAPI(fullPrompt, systemPrompt);
  console.log('[Background] API call completed');

  return result;
}

function buildPrompt(userPrompt, videoUrl, metadata, history, isInitial) {
  let prompt = '';

  // Add video context
  prompt += `YouTube视频信息：\n`;
  if (metadata.title) prompt += `标题：${metadata.title}\n`;
  if (metadata.channel) prompt += `频道：${metadata.channel}\n`;
  if (metadata.description) prompt += `描述：${metadata.description.substring(0, 500)}\n`;
  prompt += `链接：${videoUrl}\n\n`;

  // Add conversation history if exists
  if (history && history.length > 0) {
    prompt += `对话历史：\n`;
    history.forEach(msg => {
      if (msg.role === 'user') {
        prompt += `用户：${msg.content}\n`;
      } else {
        prompt += `助手：${msg.content}\n`;
      }
    });
    prompt += `\n`;
  }

  // Add current request
  prompt += `用户问题：${userPrompt}`;

  return prompt;
}

async function callGeminiAPI(prompt, systemPrompt = null) {
  const url = `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  console.log('[Background] Calling API:', url.replace(GEMINI_API_KEY, 'HIDDEN'));
  if (systemPrompt) {
    console.log('[Background] Using system prompt');
  }

  const requestBody = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 4096,
    }
  };

  // Add system instruction if provided
  if (systemPrompt) {
    requestBody.systemInstruction = {
      parts: [{ text: systemPrompt }]
    };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    console.log('[Background] API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `API request failed (${response.status})`;
      console.error('[Background] API Error:', errorMessage);

      if (errorMessage.includes('API key')) {
        throw new Error('Invalid API Key');
      } else if (errorMessage.includes('not found') || errorMessage.includes('not supported')) {
        throw new Error('Model not available');
      } else if (response.status === 429) {
        throw new Error('API rate limit exceeded');
      } else if (response.status === 403) {
        throw new Error('Insufficient API Key permissions');
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();

    // Extract text from response
    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
        return candidate.content.parts[0].text;
      }
    }

    throw new Error('API returned empty response');
  } catch (error) {
    console.error('[Background] Fetch error:', error);
    throw error;
  }
}

// Log when service worker starts
console.log('[Background] YouTube Memories.ai Assistant started');

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Background] Extension installed');
});

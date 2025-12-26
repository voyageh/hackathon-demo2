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
});

// Handle video analysis
async function handleAnalyzeVideo(request) {
  const { prompt, videoUrl, metadata, conversationHistory, isInitial } = request;

  console.log('[Background] Starting analysis...');
  console.log('[Background] Video:', metadata.title);
  console.log('[Background] Is initial:', isInitial);

  // Check API key
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
    throw new Error('请在 background.js 中配置 API Key');
  }

  // Build prompt
  let fullPrompt = buildPrompt(prompt, videoUrl, metadata, conversationHistory, isInitial);
  console.log('[Background] Prompt:', fullPrompt.substring(0, 200) + '...');

  // Call API
  const result = await callGeminiAPI(fullPrompt);
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

async function callGeminiAPI(prompt) {
  const url = `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  console.log('[Background] Calling API:', url.replace(GEMINI_API_KEY, 'HIDDEN'));

  const requestBody = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    console.log('[Background] API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `API请求失败 (${response.status})`;
      console.error('[Background] API Error:', errorMessage);

      if (errorMessage.includes('API key')) {
        throw new Error('API Key 无效');
      } else if (errorMessage.includes('not found') || errorMessage.includes('not supported')) {
        throw new Error('模型不可用');
      } else if (response.status === 429) {
        throw new Error('API 调用频率超限');
      } else if (response.status === 403) {
        throw new Error('API Key 权限不足');
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

    throw new Error('API 返回空响应');
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

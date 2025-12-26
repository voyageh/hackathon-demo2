// Content script for YouTube Memories.ai Assistant - Proactive Guide
class YouTubeMemoriesChat {
  constructor() {
    this.container = null;
    this.conversationHistory = [];
    this.currentVideoId = null;
    this.isStreaming = false;
    this.hasInitialAnalysis = false;
    this.init();
  }

  init() {
    this.waitForElement('#secondary', (secondaryColumn) => {
      this.injectUI(secondaryColumn);
      // Auto-analyze video when UI is injected
      this.autoAnalyzeVideo();
    });
    this.observeUrlChanges();
  }

  waitForElement(selector, callback, maxAttempts = 50) {
    let attempts = 0;
    const interval = setInterval(() => {
      const element = document.querySelector(selector);
      if (element) {
        clearInterval(interval);
        callback(element);
      } else if (++attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 200);
  }

  isVideoPage() {
    return window.location.pathname === '/watch' && new URLSearchParams(window.location.search).has('v');
  }

  getCurrentVideoUrl() {
    return window.location.href;
  }

  getVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
  }

  async getVideoMetadata() {
    try {
      const titleElement = document.querySelector('h1.ytd-video-primary-info-renderer yt-formatted-string, h1.title yt-formatted-string, #title h1 yt-formatted-string');
      const title = titleElement ? titleElement.textContent.trim() : '';

      const descriptionElement = document.querySelector('#description-inline-expander yt-attributed-string span, ytd-text-inline-expander #description yt-formatted-string');
      const description = descriptionElement ? descriptionElement.textContent.trim().substring(0, 1000) : '';

      const channelElement = document.querySelector('#channel-name a, ytd-channel-name a');
      const channel = channelElement ? channelElement.textContent.trim() : '';

      return { title, description, channel };
    } catch (error) {
      console.error('Failed to get video metadata:', error);
      return { title: '', description: '', channel: '' };
    }
  }

  injectUI(secondaryColumn) {
    if (!this.isVideoPage()) return;

    const existing = document.getElementById('yt-gemini-chat');
    if (existing) existing.remove();

    this.container = document.createElement('div');
    this.container.id = 'yt-gemini-chat';
    this.container.className = 'yt-gemini-container';

    this.container.innerHTML = `
      <div class="yt-gemini-header">
        <div class="yt-gemini-title">
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="24" viewBox="0 0 26 24" fill="none">
            <path d="M23.4699 6.18321V23L14.0316 19.7178L19.9161 4.93815L23.4699 6.18321ZM19.5318 1L14.1677 14.5492L2.60156 14.5352L16.0833 1H19.5318Z" fill="#F9F9F9"/>
          </svg>
          <span>Memories.ai Learning Assistant</span>
        </div>
        <div class="yt-gemini-header-buttons">
          <button class="yt-gemini-download-btn" id="yt-gemini-download-btn" title="Download Knowledge Graph">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </button>
          <button class="yt-gemini-clear-chat" id="yt-gemini-clear-chat" title="Regenerate">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
          </button>
        </div>
      </div>

      <div class="yt-gemini-messages" id="yt-gemini-messages">
        <div class="yt-gemini-analyzing">
          <div class="yt-gemini-spinner-large"></div>
          <p>Analyzing video, generating guiding questions...</p>
        </div>
      </div>

      <div class="yt-gemini-input-area">
        <div class="yt-gemini-input-wrapper">
          <textarea
            id="yt-gemini-input"
            placeholder="Ask a question..."
            rows="1"
          ></textarea>
          <button class="yt-gemini-send-btn" id="yt-gemini-send-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
    `;

    secondaryColumn.insertBefore(this.container, secondaryColumn.firstChild);
    this.attachEventListeners();

    const videoId = this.getVideoId();
    if (videoId !== this.currentVideoId) {
      this.currentVideoId = videoId;
      this.conversationHistory = [];
      this.hasInitialAnalysis = false;
    }
  }

  attachEventListeners() {
    const sendBtn = document.getElementById('yt-gemini-send-btn');
    sendBtn.addEventListener('click', () => this.sendUserMessage());

    const input = document.getElementById('yt-gemini-input');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendUserMessage();
      }
    });

    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });

    document.getElementById('yt-gemini-clear-chat').addEventListener('click', () => {
      this.regenerateAnalysis();
    });

    document.getElementById('yt-gemini-download-btn').addEventListener('click', () => {
      this.downloadKnowledgeGraph();
    });
  }

  async autoAnalyzeVideo() {
    if (this.hasInitialAnalysis) return;

    const metadata = await this.getVideoMetadata();
    const videoUrl = this.getCurrentVideoUrl();

    const initialPrompt = `
    你是 YouTube 视频的学习助手。用户即将观看这个视频，你的任务是生成一条简短消息，包含几个引导性问题，让用户带着问题看视频更容易理解和思考。

【输入】
- 视频标题：{title}
- 视频简介：{description}
- 视频内容（字幕/片段）：{transcript}

【目标】
生成 5 个与视频内容高度相关的问题，让用户边看边思考。
每个问题必须满足：
1) 与视频内容强相关，可在视频中找到答案或依据
2) 不是“是/否”题，而是开放式
3) 每个问题不超过 25 个汉字
4) 问题之间不重复，角度不同
5) 覆盖多个层次：理解（2个）、推理（2个）、应用或反思（1个）

【输出格式】
输出一条直接发给用户的消息（不要 JSON），格式如下：

我帮你整理了几个问题，带着它们看会更清晰：
1) ...
2) ...
3) ...
4) ...
5) ...

【禁止】
- 不要输出任何解释过程
- 不要输出总结、回答、或额外信息
- 不要出现“以下是”“当然可以”等客套话
    `;
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'analyzeVideo',
        videoUrl: videoUrl,
        videoId: this.getVideoId(),
        metadata: metadata,
        prompt: initialPrompt,
        isInitial: true
      });

      console.log('Auto-analysis response:', response);

      if (response && response.success) {
        this.hasInitialAnalysis = true;
        this.hideAnalyzing();
        this.addMessage('assistant', response.result);
      } else {
        this.showError(response?.error || 'Analysis failed, please refresh the page');
      }
    } catch (error) {
      console.error('Auto-analysis error:', error);
      this.showError('Analysis failed: ' + error.message);
    }
  }

  async sendUserMessage() {
    const input = document.getElementById('yt-gemini-input');
    const message = input.value.trim();

    if (!message || this.isStreaming) return;

    this.addMessage('user', message);
    input.value = '';
    input.style.height = 'auto';

    this.setInputState(false);

    // Add loading message
    const loadingMsgId = this.addLoadingMessage();

    try {
      const metadata = await this.getVideoMetadata();
      const videoUrl = this.getCurrentVideoUrl();

      const response = await chrome.runtime.sendMessage({
        action: 'analyzeVideo',
        videoUrl: videoUrl,
        videoId: this.getVideoId(),
        metadata: metadata,
        prompt: message,
        conversationHistory: this.conversationHistory,
        isInitial: false
      });

      console.log('User message response:', response);

      // Remove loading message
      this.removeMessage(loadingMsgId);

      if (response && response.success) {
        this.addMessage('assistant', response.result);
        this.conversationHistory.push(
          { role: 'user', content: message },
          { role: 'assistant', content: response.result }
        );
      } else {
        this.showError(response?.error || 'Reply failed');
      }
    } catch (error) {
      console.error('Send message error:', error);
      this.removeMessage(loadingMsgId);
      this.showError('Error occurred: ' + error.message);
    } finally {
      this.setInputState(true);
    }
  }

  async regenerateAnalysis() {
    const messagesContainer = document.getElementById('yt-gemini-messages');
    messagesContainer.innerHTML = `
      <div class="yt-gemini-analyzing">
        <div class="yt-gemini-spinner-large"></div>
        <p>Re-analyzing video...</p>
      </div>
    `;
    this.conversationHistory = [];
    this.hasInitialAnalysis = false;
    await this.autoAnalyzeVideo();
  }

  async downloadKnowledgeGraph() {
    const downloadBtn = document.getElementById('yt-gemini-download-btn');

    // Save original button content
    const originalHTML = downloadBtn.innerHTML;

    // Show loading state on button
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" style="opacity: 0.25;"></circle>
        <path d="M12 2 A10 10 0 0 1 22 12" style="animation: spin 1s linear infinite;"></path>
      </svg>
    `;

    try {
      const metadata = await this.getVideoMetadata();
      const videoUrl = this.getCurrentVideoUrl();

      console.log('[Content] Requesting knowledge graph generation...');

      const response = await chrome.runtime.sendMessage({
        action: 'generateKnowledgeGraph',
        videoUrl: videoUrl,
        videoId: this.getVideoId(),
        metadata: metadata
      });

      console.log('[Content] Knowledge graph response:', response);

      if (response && response.success) {
        // Parse JSON response with better error handling
        let knowledgeData;
        try {
          console.log('[Content] Raw response:', response.result.substring(0, 200));

          // Try to extract JSON from response
          let jsonStr = response.result.trim();

          // Remove markdown code blocks if present
          jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');

          // Find JSON object
          const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error('No JSON object found in response');
          }

          jsonStr = jsonMatch[0];

          // Try to fix common JSON issues
          // Remove trailing commas before closing brackets
          jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');

          // Try to auto-fix truncated JSON
          // Count opening and closing brackets
          const openBraces = (jsonStr.match(/\{/g) || []).length;
          const closeBraces = (jsonStr.match(/\}/g) || []).length;
          const openBrackets = (jsonStr.match(/\[/g) || []).length;
          const closeBrackets = (jsonStr.match(/\]/g) || []).length;

          // If JSON is truncated, try to close it
          if (openBrackets > closeBrackets || openBraces > closeBraces) {
            console.log('[Content] JSON appears truncated, attempting to fix...');

            // Close any open arrays
            for (let i = 0; i < openBrackets - closeBrackets; i++) {
              jsonStr += ']';
            }

            // Close any open objects
            for (let i = 0; i < openBraces - closeBraces; i++) {
              jsonStr += '}';
            }
          }

          console.log('[Content] Cleaned JSON:', jsonStr.substring(0, 200));
          console.log('[Content] JSON end:', jsonStr.substring(jsonStr.length - 100));

          knowledgeData = JSON.parse(jsonStr);

          // Validate required fields
          if (!knowledgeData.mermaidCode) {
            throw new Error('Missing mermaidCode field');
          }

        } catch (parseError) {
          console.error('[Content] JSON parse error:', parseError);
          console.error('[Content] Failed JSON string:', response.result);
          this.showError('Failed to parse knowledge graph. The AI response format was invalid. Please try again.');
          return;
        }

        // Generate HTML file
        const htmlContent = this.generateKnowledgeGraphHTML(knowledgeData, metadata, videoUrl);
        const filename = `${metadata.title || 'video'}_knowledge_graph.html`.replace(/[<>:"/\\|?*]/g, '_');
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Show success message briefly
        this.showTemporaryMessage('Knowledge graph downloaded!');
      } else {
        this.showError(response?.error || 'Failed to generate knowledge graph');
      }
    } catch (error) {
      console.error('[Content] Download error:', error);
      this.showError('Error generating knowledge graph: ' + error.message);
    } finally {
      // Restore button state
      downloadBtn.disabled = false;
      downloadBtn.innerHTML = originalHTML;
    }
  }

  generateKnowledgeGraphHTML(knowledgeData, metadata, videoUrl) {
    const { title, summary, mermaidCode, keyPoints, connections } = knowledgeData;

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title || '知识图谱')}</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 40px 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px;
      color: white;
    }
    .header h1 {
      font-size: 32px;
      margin-bottom: 16px;
      font-weight: 700;
    }
    .header .summary {
      font-size: 16px;
      line-height: 1.6;
      opacity: 0.95;
    }
    .header .meta {
      margin-top: 20px;
      font-size: 14px;
      opacity: 0.9;
    }
    .header .meta a {
      color: white;
      text-decoration: underline;
    }
    .content {
      padding: 40px;
    }
    .section {
      margin-bottom: 40px;
    }
    .section-title {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 20px;
      color: #333;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .mermaid-container {
      background: #f8f9fa;
      padding: 30px;
      border-radius: 12px;
      margin: 20px 0;
      overflow-x: auto;
    }
    .key-points {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }
    .key-point {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 12px;
      border-left: 4px solid #667eea;
    }
    .key-point.high {
      border-left-color: #e74c3c;
      background: #fff5f5;
    }
    .key-point.medium {
      border-left-color: #f39c12;
      background: #fffaf0;
    }
    .key-point.low {
      border-left-color: #3498db;
      background: #f0f8ff;
    }
    .key-point h3 {
      font-size: 18px;
      margin-bottom: 10px;
      color: #333;
    }
    .key-point p {
      font-size: 14px;
      line-height: 1.6;
      color: #666;
    }
    .connections {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 12px;
    }
    .connection {
      padding: 12px;
      margin: 8px 0;
      background: white;
      border-radius: 8px;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .connection .arrow {
      color: #667eea;
      font-weight: bold;
    }
    .footer {
      background: #f8f9fa;
      padding: 20px 40px;
      text-align: center;
      font-size: 14px;
      color: #666;
    }
    @media print {
      body {
        background: white;
        padding: 0;
      }
      .container {
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${this.escapeHtml(title || '知识图谱')}</h1>
      <div class="summary">${this.escapeHtml(summary || '')}</div>
      <div class="meta">
        <div><strong>视频：</strong>${this.escapeHtml(metadata.title || '')}</div>
        <div><strong>频道：</strong>${this.escapeHtml(metadata.channel || '')}</div>
        <div><strong>链接：</strong><a href="${videoUrl}" target="_blank">观看视频</a></div>
      </div>
    </div>

    <div class="content">
      <div class="section">
        <h2 class="section-title">🗺️ 知识结构图</h2>
        <div class="mermaid-container">
          <div class="mermaid">
${mermaidCode || ''}
          </div>
        </div>
      </div>

      ${keyPoints && keyPoints.length > 0 ? `
      <div class="section">
        <h2 class="section-title">💡 关键知识点</h2>
        <div class="key-points">
          ${keyPoints.map(point => `
          <div class="key-point ${point.importance || 'medium'}">
            <h3>${this.escapeHtml(point.title || '')}</h3>
            <p>${this.escapeHtml(point.description || '')}</p>
          </div>
          `).join('')}
        </div>
      </div>
      ` : ''}

      ${connections && connections.length > 0 ? `
      <div class="section">
        <h2 class="section-title">🔗 知识关联</h2>
        <div class="connections">
          ${connections.map(conn => `
          <div class="connection">
            <span><strong>${this.escapeHtml(conn.from || '')}</strong></span>
            <span class="arrow">→</span>
            <span><em>${this.escapeHtml(conn.relationship || '')}</em></span>
            <span class="arrow">→</span>
            <span><strong>${this.escapeHtml(conn.to || '')}</strong></span>
          </div>
          `).join('')}
        </div>
      </div>
      ` : ''}
    </div>

    <div class="footer">
      <p>此知识图谱由 <strong>Memories.ai</strong> 自动生成 | 生成时间：${new Date().toLocaleString('zh-CN')}</p>
    </div>
  </div>

  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      themeVariables: {
        primaryColor: '#667eea',
        primaryTextColor: '#fff',
        primaryBorderColor: '#764ba2',
        lineColor: '#667eea',
        secondaryColor: '#764ba2',
        tertiaryColor: '#f8f9fa'
      }
    });
  </script>
</body>
</html>`;
  }

  showTemporaryMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'yt-gemini-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 2000);
  }

  hideAnalyzing() {
    const analyzing = document.querySelector('.yt-gemini-analyzing');
    if (analyzing) analyzing.remove();
  }

  addMessage(role, content) {
    this.hideAnalyzing();

    const messagesContainer = document.getElementById('yt-gemini-messages');
    const messageId = 'msg-' + Date.now();

    const messageDiv = document.createElement('div');
    messageDiv.id = messageId;
    messageDiv.className = `yt-gemini-message yt-gemini-message-${role}`;

    const logoUrl = chrome.runtime.getURL('icons/logo.svg');

    if (role === 'user') {
      messageDiv.innerHTML = `
        <div class="yt-gemini-msg-avatar">👤</div>
        <div class="yt-gemini-msg-content">${this.escapeHtml(content)}</div>
      `;
    } else if (role === 'assistant') {
      messageDiv.innerHTML = `
        <div class="yt-gemini-msg-avatar">
          <img src="${logoUrl}" alt="Bot" style="width: 70%; height: 100%; border-radius: 50%;">
        </div>
        <div class="yt-gemini-msg-content">${this.markdownToHtml(content)}</div>
      `;
    }

    messagesContainer.appendChild(messageDiv);
    this.scrollToBottom();

    return messageId;
  }

  addLoadingMessage() {
    const messagesContainer = document.getElementById('yt-gemini-messages');
    const messageId = 'msg-loading-' + Date.now();

    const messageDiv = document.createElement('div');
    messageDiv.id = messageId;
    messageDiv.className = 'yt-gemini-message yt-gemini-message-assistant';

    const logoUrl = chrome.runtime.getURL('icons/logo.svg');

    messageDiv.innerHTML = `
      <div class="yt-gemini-msg-avatar">
        <img src="${logoUrl}" alt="Bot" style="width: 70%; height: 100%; border-radius: 50%;">
      </div>
      <div class="yt-gemini-msg-content yt-gemini-loading">
        <span class="yt-gemini-typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </span>
      </div>
    `;

    messagesContainer.appendChild(messageDiv);
    this.scrollToBottom();

    return messageId;
  }

  removeMessage(messageId) {
    const message = document.getElementById(messageId);
    if (message) {
      message.remove();
    }
  }

  showError(message) {
    this.hideAnalyzing();
    const messagesContainer = document.getElementById('yt-gemini-messages');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'yt-gemini-message yt-gemini-message-error';
    errorDiv.innerHTML = `<div class="yt-gemini-msg-content">❌ ${message}</div>`;
    messagesContainer.appendChild(errorDiv);
    this.scrollToBottom();
  }

  scrollToBottom() {
    const messagesContainer = document.getElementById('yt-gemini-messages');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  setInputState(enabled) {
    const input = document.getElementById('yt-gemini-input');
    const sendBtn = document.getElementById('yt-gemini-send-btn');
    input.disabled = !enabled;
    sendBtn.disabled = !enabled;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  markdownToHtml(markdown) {
    let html = markdown;

    html = html.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;');

    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

    html = html.replace(/\*([^*]+?)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+?)_/g, '<em>$1</em>');

    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    const blocks = html.split('\n\n');
    const processedBlocks = [];

    for (let block of blocks) {
      const lines = block.split('\n');
      const firstLine = lines[0].trim();

      if (firstLine.match(/^[-*]\s/) || firstLine.match(/^\d+\.\s/)) {
        let listItems = [];
        let isOrdered = firstLine.match(/^\d+\.\s/) !== null;

        for (let line of lines) {
          if (line.match(/^[-*]\s(.+)$/)) {
            listItems.push('<li>' + line.replace(/^[-*]\s/, '') + '</li>');
            isOrdered = false;
          } else if (line.match(/^\d+\.\s(.+)$/)) {
            listItems.push('<li>' + line.replace(/^\d+\.\s/, '') + '</li>');
            isOrdered = true;
          }
        }

        if (listItems.length > 0) {
          const listTag = isOrdered ? 'ol' : 'ul';
          processedBlocks.push(`<${listTag}>${listItems.join('')}</${listTag}>`);
        }
      } else if (firstLine.startsWith('<h')) {
        processedBlocks.push(block);
      } else if (block.trim()) {
        processedBlocks.push('<p>' + block.replace(/\n/g, '<br>') + '</p>');
      }
    }

    html = processedBlocks.join('');
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<br><\/p>/g, '</p>');

    return html;
  }

  observeUrlChanges() {
    let lastUrl = location.href;
    new MutationObserver(() => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        if (this.isVideoPage()) {
          this.waitForElement('#secondary', (secondaryColumn) => {
            this.injectUI(secondaryColumn);
            this.autoAnalyzeVideo();
          });
        }
      }
    }).observe(document, { subtree: true, childList: true });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new YouTubeMemoriesChat();
  });
} else {
  new YouTubeMemoriesChat();
}

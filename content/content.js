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
        <button class="yt-gemini-clear-chat" id="yt-gemini-clear-chat" title="重新生成">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
        </button>
      </div>

      <div class="yt-gemini-messages" id="yt-gemini-messages">
        <div class="yt-gemini-analyzing">
          <div class="yt-gemini-spinner-large"></div>
          <p>正在分析视频，生成引导性问题...</p>
        </div>
      </div>

      <div class="yt-gemini-input-area">
        <div class="yt-gemini-input-wrapper">
          <textarea
            id="yt-gemini-input"
            placeholder="继续提问..."
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
        this.showError(response?.error || '分析失败，请刷新页面重试');
      }
    } catch (error) {
      console.error('Auto-analysis error:', error);
      this.showError('分析失败：' + error.message);
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
        this.showError(response?.error || '回复失败');
      }
    } catch (error) {
      console.error('Send message error:', error);
      this.removeMessage(loadingMsgId);
      this.showError('发生错误：' + error.message);
    } finally {
      this.setInputState(true);
    }
  }

  async regenerateAnalysis() {
    const messagesContainer = document.getElementById('yt-gemini-messages');
    messagesContainer.innerHTML = `
      <div class="yt-gemini-analyzing">
        <div class="yt-gemini-spinner-large"></div>
        <p>正在重新分析视频...</p>
      </div>
    `;
    this.conversationHistory = [];
    this.hasInitialAnalysis = false;
    await this.autoAnalyzeVideo();
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
        <img src="${logoUrl}" alt="Bot" style="width: 100%; height: 100%; border-radius: 50%;">
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

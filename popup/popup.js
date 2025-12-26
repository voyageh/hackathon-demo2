// Popup script for YouTube Gemini Assistant

document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('api-key-input');
  const toggleVisibilityBtn = document.getElementById('toggle-visibility');
  const saveBtn = document.getElementById('save-btn');
  const testBtn = document.getElementById('test-btn');
  const statusMessage = document.getElementById('status-message');
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');

  // Load saved API key
  loadApiKey();

  // Toggle password visibility
  toggleVisibilityBtn.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleVisibilityBtn.textContent = '🙈';
    } else {
      apiKeyInput.type = 'password';
      toggleVisibilityBtn.textContent = '👁️';
    }
  });

  // Save API key
  saveBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showStatus('请输入 API Key', 'error');
      return;
    }

    try {
      await chrome.storage.sync.set({ geminiApiKey: apiKey });
      showStatus('API Key 保存成功！', 'success');
      updateApiStatus('configured');
    } catch (error) {
      showStatus('保存失败：' + error.message, 'error');
    }
  });

  // Test API connection
  testBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showStatus('请先输入 API Key', 'error');
      return;
    }

    showStatus('正在测试连接...', 'info');
    testBtn.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'testApiKey',
        apiKey: apiKey
      });

      if (response.success) {
        showStatus('连接成功！API Key 有效', 'success');
        updateApiStatus('active');
      } else {
        showStatus('连接失败：' + response.error, 'error');
        updateApiStatus('error');
      }
    } catch (error) {
      showStatus('测试失败：' + error.message, 'error');
      updateApiStatus('error');
    } finally {
      testBtn.disabled = false;
    }
  });

  // Load API key from storage
  async function loadApiKey() {
    try {
      const result = await chrome.storage.sync.get('geminiApiKey');
      if (result.geminiApiKey) {
        apiKeyInput.value = result.geminiApiKey;
        updateApiStatus('configured');
      } else {
        updateApiStatus('unconfigured');
      }
    } catch (error) {
      console.error('Failed to load API key:', error);
      updateApiStatus('error');
    }
  }

  // Show status message
  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = 'status-message ' + type;
    statusMessage.style.display = 'block';

    // Auto hide after 5 seconds
    setTimeout(() => {
      statusMessage.style.display = 'none';
    }, 5000);
  }

  // Update API status indicator
  function updateApiStatus(status) {
    statusDot.className = 'status-dot ' + status;

    switch (status) {
      case 'unconfigured':
        statusText.textContent = '未配置';
        break;
      case 'configured':
        statusText.textContent = '已配置';
        break;
      case 'active':
        statusText.textContent = '连接正常';
        break;
      case 'error':
        statusText.textContent = '连接错误';
        break;
    }
  }
});

# 快速安装指南

## 第一步：配置 API Key

1. 获取 Gemini API Key：https://makersuite.google.com/app/apikey

2. 打开 `background/background.js` 文件

3. 在第 6 行修改：
   ```javascript
   const GEMINI_API_KEY = 'YOUR_API_KEY_HERE';  // 改成你的 API Key
   ```

## 第二步：生成图标

1. 用浏览器打开 `icons/icon-generator.html`

2. 点击三个下载按钮

3. 将下载的文件保存到 `icons/` 目录

## 第三步：加载扩展

1. Chrome 浏览器打开：`chrome://extensions/`

2. 开启右上角"开发者模式"

3. 点击"加载已解压的扩展程序"

4. 选择本项目文件夹

5. 完成！

## 第四步：使用

1. 打开任意 YouTube 视频

2. 在右侧会看到 "Gemini AI 视频分析" 组件

3. 点击模板按钮或输入自定义提示词

4. 点击"开始分析"，等待结果

## 常见问题

### 提示"请在 background.js 中配置 API Key"
→ 检查第一步是否正确配置了 API Key

### 看不到分析组件
→ 确保在视频页面（URL 包含 `/watch?v=`）
→ 刷新页面重试

### API 调用失败
→ 检查网络连接
→ 确认 API Key 有效
→ 尝试将模型改为 `'gemini-pro'`

## 自定义配置

### 更换模型

在 `background/background.js` 第 15 行：
```javascript
const GEMINI_MODEL = 'gemini-3-pro-preview';  // 可改为其他模型
```

可用模型：
- `gemini-3-pro-preview` - 最新预览版
- `gemini-1.5-flash-latest` - 速度快
- `gemini-1.5-pro-latest` - 更强大
- `gemini-pro` - 稳定版

### 修改提示词模板

在 `content/content.js` 第 5-9 行修改预设模板。

## 技术支持

遇到问题？查看完整文档：[README.md](./README.md)

# YouTube Gemini Assistant

一个简洁的 Chrome 扩展，在 YouTube 视频页面直接嵌入 Gemini AI 分析功能。

## 功能特点

- 直接嵌入 YouTube 页面，类似原生组件
- 简洁优雅的设计，完美融入 YouTube 界面
- 预设三种常用分析模板：
  - 📝 总结视频
  - 💡 提炼要点
  - 📋 生成提纲
- 支持自定义提示词
- 结果一键复制功能
- API Key 直接在代码中配置，简单方便
- 支持暗色模式

## 安装步骤

### 1. 生成图标文件

1. 在浏览器中打开 `icons/icon-generator.html`
2. 点击三个下载按钮，将生成的图标保存到 `icons/` 目录
3. 确保文件名为：
   - `icon16.png`
   - `icon48.png`
   - `icon128.png`

### 2. 配置 API Key

1. 访问 [Google AI Studio](https://makersuite.google.com/app/apikey) 获取 Gemini API Key
2. 打开 `background/background.js` 文件
3. 在第 6 行找到：
   ```javascript
   const GEMINI_API_KEY = 'YOUR_API_KEY_HERE';
   ```
4. 将 `'YOUR_API_KEY_HERE'` 替换为你的实际 API Key：
   ```javascript
   const GEMINI_API_KEY = 'AIzaSy...你的密钥...';
   ```
5. 保存文件

### 3. 安装扩展

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 启用右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择本项目的根目录
6. 安装完成！

## 使用方法

1. 打开任意 YouTube 视频页面
2. 在右侧栏顶部会看到 "Gemini AI 视频分析" 组件
3. 点击三个模板按钮之一，或在文本框输入自定义提示词
4. 点击"开始分析"按钮
5. 等待几秒钟，AI 分析结果会显示在下方
6. 点击复制按钮可以复制结果到剪贴板

## 项目结构

```
hackathon-demo2/
├── manifest.json           # 扩展配置文件
├── background/
│   └── background.js      # 后台服务，处理 API 调用
├── content/
│   ├── content.js         # 内容脚本，注入 YouTube 页面
│   └── content.css        # 页面内 UI 样式
├── popup/
│   ├── popup.html         # 扩展弹窗页面
│   ├── popup.js           # 弹窗逻辑
│   └── popup.css          # 弹窗样式
├── icons/
│   ├── icon16.png         # 16x16 图标
│   ├── icon48.png         # 48x48 图标
│   ├── icon128.png        # 128x128 图标
│   └── icon-generator.html # 图标生成工具
└── README.md              # 项目说明文档
```

## 技术栈

- Manifest V3
- Vanilla JavaScript
- Chrome Extension APIs
- Google Gemini API (gemini-1.5-flash)

## 权限说明

- `activeTab`: 用于获取当前标签页的 URL
- `https://www.youtube.com/*`: 仅在 YouTube 页面注入功能
- `https://generativelanguage.googleapis.com/*`: 调用 Gemini API

## 隐私与安全

- API Key 直接写在代码中，仅存在于你的本地
- 不会收集或上传任何用户数据
- 仅在用户主动触发时才调用 API
- 所有数据处理都在本地完成

## 常见问题

### 1. 为什么没有看到分析组件？

- 确保你在 YouTube 视频播放页面（URL 包含 `/watch?v=`）
- 刷新页面后重试
- 检查扩展是否正确加载（访问 `chrome://extensions/`）
- 查看浏览器控制台是否有错误信息

### 2. API 调用失败怎么办？

- 确认 API Key 配置正确（检查 `background/background.js` 第 6 行）
- 检查网络连接是否正常
- 确认 Gemini API 配额未超限
- 查看错误提示信息
- 尝试更换模型：将 `GEMINI_MODEL` 改为 `'gemini-pro'`

### 3. 如何更换 API Key？

- 编辑 `background/background.js` 文件
- 修改第 6 行的 `GEMINI_API_KEY` 值
- 在 `chrome://extensions/` 页面重新加载扩展

### 4. 分析结果不准确？

- Gemini 只能通过视频链接进行分析，无法直接访问视频内容
- 尝试使用更详细的自定义提示词
- 某些私密或地区限制的视频可能无法分析

## 开发说明

### 修改代码后重新加载

1. 在 `chrome://extensions/` 页面
2. 找到本扩展
3. 点击"重新加载"按钮

### 调试

- 内容脚本：在 YouTube 页面按 F12，查看 Console
- 后台脚本：在扩展页面点击"服务工作进程"旁的"查看"链接
- 弹窗页面：右键点击扩展图标，选择"检查弹出内容"

## 未来改进

- [ ] 支持更多提示词模板
- [ ] 添加历史记录功能
- [ ] 支持导出分析结果
- [ ] 优化 UI 动画效果
- [ ] 支持暗色主题
- [ ] 添加快捷键支持
- [ ] 支持多语言界面

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

如有问题或建议，请通过 GitHub Issues 联系。

---

Made with ❤️ for YouTube and AI enthusiasts

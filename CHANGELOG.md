# Changelog

All significant changes to this project will be recorded in this file.

此项目的所有显著更改都将记录在此文件中。

## [v1.4.3] - 2026-11-03

<!-- i18n:en:start -->
### Fixed & Optimized

- Fix MiniMax voice cloning when the uploaded audio file ID is returned as a large integer.
<!-- i18n:en:end -->

<!-- i18n:zh-CN:start -->
### 修复与优化

- 修复 MiniMax 音色克隆时上传音频编号识别失败的问题。
<!-- i18n:zh-CN:end -->

## [v1.4.2] - 2026-11-03

<!-- i18n:en:start -->
### Fixed & Optimized

- Bundle a verified yt-dlp executable and its licenses with the application, so supported link imports no longer require a separate installation.
<!-- i18n:en:end -->

<!-- i18n:zh-CN:start -->
### 修复与优化

- 安装包内置经过校验的 yt-dlp 下载引擎及其许可说明，导入支持的平台链接时无需另行安装。
<!-- i18n:zh-CN:end -->

## [v1.4.1] - 2026-11-03

<!-- i18n:en:start -->
### Added

- Import public video links into a material folder, including an anonymous Douyin adapter. Other platforms require yt-dlp installed separately.
- Show editable storyboard suggestions based on material analysis.

### Fixed & Optimized

- Prevent batch exports from overwriting each other and improve subtitle sizing and Edge TTS reliability.
- Improve spoken-script guidance, material selection, and handling of special characters in file names.
- Point release checks to this repository and keep fork analytics separate from the upstream project.
<!-- i18n:en:end -->

<!-- i18n:zh-CN:start -->
### 新增

- 支持通过链接导入公开视频素材，并提供抖音免登录适配；其他平台需要单独安装 yt-dlp。
- 根据素材分析提供可编辑的分镜建议。

### 修复与优化

- 修复批量导出文件互相覆盖的问题，改进字幕大小和 Edge TTS 稳定性。
- 优化口播文案、素材选择和包含特殊字符的文件路径处理。
- 更新检查指向本仓库，副本版本不向上游项目发送统计事件。
<!-- i18n:zh-CN:end -->

## [v1.4.0] - 2026-11-02

<!-- i18n:en:start -->
### Added

- Rebuild the app as a creator studio with separate material library, creator workflow, model settings, voice settings, and export areas
- Add AI agent workflow for analyzing video materials and generating platform-aware scripts
- Add MiniMax TTS with system voice selection and connection settings
- Add multi-folder material scanning and folder selection for video composition

### Fixed & Optimized

- Use the selected output aspect ratio when positioning rendered subtitles
<!-- i18n:en:end -->

<!-- i18n:zh-CN:start -->
### 新增

- 将应用重构为创作台，分区呈现素材库、创作流程、模型配置、配音配置和合成导出
- 新增 Agent 创作流程，用于分析视频素材并按发布平台生成文案
- 新增 MiniMax TTS，支持系统音色选择和连接配置
- 新增多文件夹素材扫描，并可在视频合成时选择素材文件夹

### 修复与优化

- 根据所选导出比例调整渲染字幕的位置
<!-- i18n:zh-CN:end -->

## [v1.3.0] - 2026-10-16

<!-- i18n:en:start -->
### Added

- Expand AI copywriting configuration with support for multiple API protocols, sampling parameters, and copywriting diversity controls
- Add a new subtitle rendering engine, subtitle visibility controls, and SRT export alongside videos
- Enhance batch video composition controls and export operations
- Add in-app update checks with localized release notes and dual-source checking via the Metadata API and GitHub
- Add announcements and diagnostic export

### Fixed & Optimized

- Fix Edge TTS 403 errors caused by authentication changes and improve speech synthesis stability and audio validation
- Optimize video segment selection in large media libraries and improve handling of unreadable media
- Fix video rendering progress calculation and IPC listener cleanup to improve composition stability
- Fix startup update notification timing and improve update-check error messages
- Improve macOS window controls and title bar interactions, and refine interface layout and status indicators
- Include the application version in copied error details and improve anonymous error reporting for troubleshooting
<!-- i18n:en:end -->

<!-- i18n:zh-CN:start -->
### 新增

- 增强 AI 文案生成配置，支持多种 API 协议、采样参数调整与文案多样性控制
- 新增字幕渲染引擎，支持字幕显示控制和随视频同步导出 SRT 字幕文件
- 完善批量视频合成控制与导出操作
- 新增应用内更新检查，按语言展示发布说明，并支持元数据 API 与 GitHub 双源检查
- 新增公告展示与诊断导出

### 修复与优化

- 修复鉴权变化导致的 Edge TTS 403 错误，增强语音合成稳定性与音频校验
- 优化大素材库的视频片段选择性能，改善不可读素材处理
- 修正视频渲染进度计算与 IPC 监听清理，提升合成流程稳定性
- 修复启动时更新通知的时序问题，改善更新检查错误提示
- 改善 macOS 窗口控制与标题栏交互，优化界面布局和状态提示
- 复制错误详情时附带应用版本，完善匿名错误统计，便于问题排查
<!-- i18n:zh-CN:end -->

## [v1.2.2] - 2026-04-07

<!-- i18n:en:start -->
### Fixed & Optimized

- Optimize segment duration acquisition in large media libraries by switching to offscreen metadata probing with cache, reducing undefined duration failures during composition
- Decouple preview rendering from duration dependency and improve random segment selection stability
- Add robust default folder fallback for Windows folder picker (downloads -> desktop -> documents -> home -> cwd) to avoid dialog open failures when downloads path is unavailable
- Add safer TTS audio metadata parsing guards and clearer error messages for invalid duration scenarios
<!-- i18n:en:end -->

<!-- i18n:zh-CN:start -->
### 修复与优化

- 优化大素材库场景下的分镜时长获取，改为离屏读取并缓存 metadata，降低合成阶段 duration 为空导致的失败
- 解耦预览组件与时长依赖，提升随机分镜流程稳定性
- 为 Windows 文件夹选择增加默认目录回退链路（downloads -> desktop -> documents -> home -> cwd），避免下载目录不可用时无法打开选择器
- 增强 TTS 音频元数据解析兜底与错误提示，避免无效时长引发不明确报错
<!-- i18n:zh-CN:end -->

为方便大家下载，传了一份网盘，可以订阅链接，会同步更新：
百度网盘：https://pan.baidu.com/s/1o-vGG_bli8NrhCbyT_8sGA?pwd=mi4c
夸克网盘：https://pan.quark.cn/s/8f958543d20e?pwd=8qe3

## [v1.2.1] - 2026-03-12

### Added

- Add anonymous event reporting in the Electron main process for key workflow events

### Fixed & Optimized

- Fix BGM filename matching edge cases during media selection
- Resolve voice truncation caused by loudness normalization when adding BGM
- Fix TTS audio metadata parsing by specifying mimeType to avoid format detection failures
- Fix synthesis flow when BGM folder is missing and optimize related error handling
- Upgrade AI SDK dependency

### 新增

- 增加主进程匿名统计上报，覆盖关键流程事件

### 修复与优化

- 修复素材选择过程中 BGM 文件名匹配边界问题
- 解决添加 BGM 后因响度归一化导致语音截断的问题
- 通过指定 mimeType 修复 TTS 音频元数据读取，避免自动识别格式失败
- 修复 BGM 文件夹不存在时合成流程未正确中断的问题，并优化相关异常处理
- 升级 AI SDK 依赖

## [v1.2.0] - 2026-01-22

### Added

- Add error details copy button
- Automatically stop the previous sound when trying to play the next sound in the text
- Better background music and vocal volume balance control

### Fixed & Optimized

- Implementing Unicode Non Space Sentence System Matching
- Solving the problem of non Chinese subtitle sticking
- Cancel subtitle segmentation length limit
- Fix EdgeTTS synthesis failure issue
- Adjust UI Text

### 新增

- 增加报错详细信息复制按钮
- 试听文本播放下一个声音时，自动停止上一个
- 更好的背景音乐和人声音量均衡控制

### 修复与优化

- 实现Unicode非空格断句语言体系匹配
- 解决非中文字幕黏连问题
- 取消字幕分割长度限制
- 修复EdgeTTS合成失败问题
- 调整UI文本

## [v1.1.10] - 2025-10-22

### Added

- Add MAC embedding FFmpeg support

### Fixed

- Resolve the error of not setting BGM folder
- Resolve the issue of reporting errors when there are non mp3 files in the BGM folder
- Remove the restriction that the total duration of video materials should not be shorter than that of voice
- Optimize some details

### 添加

- 增加MAC嵌入FFmpeg支持

### 修复

- 解决不设置bgm文件夹报错
- 解决 BGM 文件夹存在非 mp3 文件时报错问题
- 移除视频素材总时长不的短于语音的限制
- 优化一些细节

## [v1.1.1] - 2025-08-26

### Fixed

- Fix MAC copy and paste shortcut key failure issue

### 修复

- 修复MAC复制粘贴快捷键失效问题

## [v1.1.0] - 2025-08-22

### Added

- Multi-Language Support

### 添加

- 多语言支持

## [v1.0.1] - 2025-08-12

### Fixed

- 修复混剪片段与语音时长不一致问题
- 修复渲染卡帧问题

## [v1.0.0] - 2025-08-08

### Added

- 发布第一个正式版本
- 支持使用大语言模型生成文案（推荐免费的GLM-4.5-Flash）
- 支持使用EdgeTTS免费合成语音
- 支持视频分镜自动混剪
- 支持渲染合成视频
- 支持自动化批量任务
- 美观的UI界面

## [v0.7.12] - 2025-08-08

### Added

- 构建测试
- 跨平台: macOS dmg, Windows exe, Linux AppImage.


# 官网验证记录

日期：2026-10-22。

- 独立 Node.js 测试 17/17 通过，官网无需 npm install。
- 覆盖 Windows x64、ARM、32 位、未知架构、macOS、Linux、iOS、Android、iPad 桌面模式、未知系统和手动/自动模式切换。
- 新增两个回归测试先失败后通过：Windows 精简 UA 不能证明 x64 架构；切回自动识别后允许更新迟到的可靠架构信息。
- 原始安装包通过本地 HTTP 下载校验：115094734 字节，SHA-256 e87c807c8920bd45d3faa858968b350fa87f8a435e6fb8dcb7649def839fbb00。
- 浏览器实测静态分块下载：生成 OffworkBuddy-Setup-1.1.2.exe，保存后重新计算大小和 SHA-256，均与原文件一致。
- 桌面首屏、角色切换和 macOS 版本不可下载状态经过浏览器检查。
- 390×844 手机视口验证：修复角色旋转导致的横向溢出；最终 clientWidth=375、scrollWidth=375。手机下载面板完整可见。
- 独立代码审查发现的两项系统识别问题已修正并加入回归测试。审查者验证了所有六个分块和完整安装包摘要。
- Sites 第一版部署终态 succeeded。访问权限保持创建时的仅所有者范围。

限制：未验证真实 ARM 或 32 位硬件安装；不宣称这些平台受支持。分块下载需要 JavaScript、HTTPS 或 localhost 和足够浏览器内存。远程浏览器访问曾超时，因此本地浏览器验收与线上部署验证分开记录。

Windows UA 处理依据：[Chromium User-Agent Reduction](https://www.chromium.org/updates/ua-reduction/)。

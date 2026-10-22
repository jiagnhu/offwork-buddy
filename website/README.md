# 下班搭子独立官网

静态 HTML / CSS / JavaScript，Node.js ≥20，无需安装依赖。目录可以独立移出父项目。桌面应用源码和用户数据不受影响。

## 预览

在本目录执行 `npm run dev`，访问 http://127.0.0.1:4173。

提供真实本地下载（PowerShell）：

```powershell
$env:INSTALLER_PATH = '安装包的完整路径/OffworkBuddy-Setup-1.1.2.exe'
npm run dev
```

启动时校验安装包大小和 SHA-256，匹配后启用下载。不提供安装包路径时，页面明确显示下载尚未上线。`PORT` 可指定端口。

## 构建与部署

`npm run build` 输出 `dist/`。可部署到支持静态文件的主机。

- 设置 `DOWNLOAD_URL` 为真实 HTTPS 安装包地址：构建先校验文件，成功后写入下载配置。
- 或设置 `INSTALLER_PATH`：构建校验后将安装包分成最大 20 MiB 的静态块。浏览器点击下载时按顺序获取、校验各块和完整 SHA-256，最后保存为原始 `.exe`，无需用户解压或拼接。浏览器需要 HTTPS 或 localhost、JavaScript 和足够内存（建议预留 350 MiB）。
- 不设置以上变量：构建的站点显示下载通道准备中。
- `SERVE_DIST=1` 可使用预览脚本查看构建产物；静态块由预览服务直接提供。
- `.openai/hosting.json` 保存独立 Sites 标识，默认仅所有者可访问，公开访问需另行配置。

安装包与构建产物不进入 Git。更新发行版本时，修改 `src/releases.json` 的版本、文件名、字节数、SHA-256，并更新 HTML 里的静态版本说明；构建会校验实际文件与配置一致。

## 检查

```powershell
npm test
npm run build
npm run verify:download -- http://127.0.0.1:4173/downloads/OffworkBuddy-Setup-1.1.2.exe
```

系统识别只在浏览器内进行，无遥测或个人数据上传。Windows x64 可推荐下载；未知架构要求用户确认；ARM64、32 位、macOS、Linux 和移动端不冒充已支持版本。可手动切换为另一台 Windows x64 电脑下载。

官网不使用桌面应用的本机工资数据。画面中的工资、日历和倒计时均为演示。

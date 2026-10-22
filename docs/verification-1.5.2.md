# 下班搭子 1.5.2 · 个人本地版

新增柊亚里沙（Arisa Hiiragi）、白猫 Tororo、黑猫 Hijiki，角色空间共八个选项。每个角色均有实际渲染截图、独立名称、预览、桌面选择和随机点击。

来源与资源：
- Arisa：官方 nizima LIVE 2.7.2 portable 包内 `data/models/01arisa`。单独发布的 arisa_v2.zip 只有 cmo3 编辑工程，因此本次使用官方程序附带的运行版本。1 个 Idle、1 个 unnamed tap、8 个 expression/pose。运行时映射 unnamed group，15 个资源文件与官方原件逐字节一致，无修改、无声音。
- Tororo / Hijiki：官方 tororo_hijiki_ja.zip。每只 3 个 Idle、6 个 Tap/Flick 系列动作，合并非 Idle 组为应用的 TapBody，原始模型、纹理、动作不变。保留原始 ReadMe。
- 资源 SHA256 和官方来源写入 asset-lock.json，构建时检查所有引用与哈希。

按用户明确说明仅供个人非商业本地使用；保留 Arisa 作者与 nizima LIVE 示例模型标识。未发布网站、上传模型或推送远端。

验证：新增角色状态加载和昵称持久化测试先失败再通过；新增协议路径测试先失败再通过（包含原始 Tap@body 文件名）。124 项单元测试通过，TypeScript 检查通过。三个新角色均通过实际 WebGL 渲染并生成 PNG 卡片，人工检查完整构图。

开发版 Electron 验证 4/4 通过（3.7 分钟）：八角色预览与全部原生动作、离线桌面加载及重启选择、随机点击与静态表情变化、八角色独立昵称跨界面与重启保存。Arisa 全部 15 个运行文件与官方源文件逐字节校验一致。

安装版首轮：昵称持久化通过；图片检查在默认 5 秒内超时，随机预览末尾的历史互动计数出现 1（期望 0）。独立诊断同一包的八张图片均 complete=true、naturalWidth=740，未发现资源缺失。预览测试隐藏原本置顶的桌面窗口以隔离真实桌面点击，图片等待改为与模型加载相同的 30 秒；未修改生产代码。首次超时和额外计数的根因未稳定复现，不作为已确认的产品缺陷。

独立只读代码审查通过：检查了清单、协议白名单、Arisa unnamed motion 映射、猫动作合并和昵称保存，无阻塞问题。

个人安装包：release/OffworkBuddy-Personal-Setup-1.5.2.exe，152730156 字节。
SHA256：C1D4CB7A429FB86D3C24106904C49F7809CCFAD27661ECBF98CE90D94590B1BA。

安装版复测 3/3 通过（1.8 分钟），覆盖八角色随机点击（含 Arisa 静态表情参数变化）、图片加载、角色空间切换和八角色独立昵称重启保存。最终 TypeScript 检查通过。

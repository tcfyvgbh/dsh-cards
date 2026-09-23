# dsh-cards

DeepSeek Harness 插件：模型调用 `render_cards` 工具，Web 端把这次调用渲染成只读卡片（布局、文字、指标卡、表格、SVG 图表）。

只依赖 DSH 的三个公开契约：`ctx.tools.register`、keyed slot `tool.call.toolview`、`ctx.systemPrompt.section`。不依赖代码块的渲染方式，DSH 升级代码块样式不会影响它。

## 安装（从源码运行的 DSH）

```sh
git clone <本仓库地址> ~/dsh-cards
cd ~/dsh-cards && pnpm install && pnpm build
cd <deepseek-harness 目录>
pnpm dsh plugin --profile web add link:$HOME/dsh-cards
pnpm dsh web
```

重启 DSH 后硬刷新浏览器，然后新开对话。浏览器控制台出现 `[dsh-cards] client active`，说明浏览器端已经激活。

更新：`cd ~/dsh-cards && git pull && pnpm build`，然后重启 DSH。

## 使用

对模型说"用卡片展示……"，例如"用卡片展示一个服务状态看板"。组件协议见 `docs/specs/2026-09-23-dsh-cards-design.md` 第 3 节。

## 配置

`cordis.patch.yml` 的插入行支持 `config.guidance`（默认 `true`）。设为 `false` 时不再注入提示词段落，但仍然可以渲染卡片。

## 开发

```sh
pnpm test        # 单元测试 + 构建产物测试
pnpm typecheck
pnpm build
```

`tests/e2e/harness.html` 会在真实浏览器中用构建产物渲染一份示例看板，运行前需要先执行 `pnpm build`。URL 末尾加上 `#narrow` 可以模拟手机宽度。

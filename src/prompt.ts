/** Third-party plugins cannot use getSectionOrder(); a fixed numeric order places this after core sections. */
export const GUIDANCE_ORDER = 900
export const GUIDANCE_SECTION_NAME = 'dsh-cards:guidance'

export const GUIDANCE_TEXT = `## render_cards 卡片

你可以调用 \`render_cards\` 工具，把结构化信息渲染成卡片界面展示给用户。卡片只用于展示，用户无法通过卡片向你回传操作。

何时使用：任务完成后的结果汇总、指标看板、多方案对比、表格数据、趋势数据。
何时不用：简单问答、概念解释、代码（代码仍然用 Markdown 代码块）、只有一两句话的内容。

调用规则：
- 参数为 { "spec": { "title"?: string, "items": Node[] } }。
- 调用成功后用一两句话补充说明即可，不要把卡片里的内容再用文字重复一遍。
- 如果工具返回校验错误，按错误里的路径修正后重新调用。
- 所有文字只支持 \`代码\` 和 **加粗** 两种行内格式。

组件（按 type 区分）：
- row { items: Node[] }：横向排列
- grid { cols: 1-4, items: Node[] }：栅格
- card { title?, items: Node[] }：分组卡片
- text { text, variant?: h2 | h3 | body | muted }
- callout { tone: info | success | warning | error, title?, content }
- list { items: string[], ordered? }
- keyvalue { pairs: [{ key, value }] }
- badge { text, tone?: neutral | info | success | warning | error }
- stat { label, value, delta?: "+6.8%", spark?: number[]（至少 2 个点）, better?: up | down }：延迟、错误率这类越低越好的指标填 better: "down"
- table { columns: string[], rows: (string | number)[][], types?: (text | num | bar | badge)[], sortable? }：每行长度必须等于 columns 长度；bar 列的值是 0-100 的百分比
- chart { kind: line | bar | donut, title?, labels: string[], series: [{ name, data: number[] }] }：每个 data 的长度必须等于 labels 的长度；donut 只使用第一组数据

上限：嵌套最多 4 层，节点总数不超过 200，表格最多 200 行 12 列，图表最多 6 组数据、每组 100 个点。

示例：
{"spec":{"title":"服务状态","items":[{"type":"grid","cols":3,"items":[{"type":"stat","label":"可用率","value":"99.95%","delta":"+0.02pp"},{"type":"stat","label":"P95 延迟","value":"212 ms","delta":"-8.4%","better":"down","spark":[260,251,240,233,224,212]},{"type":"stat","label":"错误率","value":"0.61%","delta":"+0.1pp","better":"down"}]},{"type":"table","columns":["服务","QPS","状态"],"types":["text","num","badge"],"rows":[["gateway",8420,"正常"],["auth",6240,"告警"]]},{"type":"callout","tone":"warning","title":"需要关注","content":"\`auth\` 错误率高于 1%。"}]}}
`

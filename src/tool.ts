import { TOOL_NAME } from './constants.ts'
import { isRecord } from './spec/check.ts'
import { formatErrors, parseSpecInput } from './spec/validate.ts'

/** Canonical success value returned to the model. */
export interface CardsToolResult { readonly ok: true; readonly nodes: number }

/** Structural subset of DSH's raw ToolDefinition (packages/core/tools/src/index.ts). */
export interface CardsToolDefinition {
  readonly name: string
  readonly description: string
  readonly parameters: Readonly<Record<string, unknown>>
  readonly output: {
    readonly schema: Readonly<Record<string, unknown>>
    render(args: unknown, value: unknown): readonly { readonly type: 'text'; readonly text: string }[]
  }
  execute(args: unknown): Promise<CardsToolResult>
}

const DESCRIPTION = '把结构化信息渲染成只读卡片界面（看板、指标卡、表格、图表、提示框）。'
  + '参数 spec 的组件协议见系统提示词中的「render_cards 卡片」一节。卡片只用于展示，不会把用户操作传回。'

export function createCardsTool(): CardsToolDefinition {
  return {
    name: TOOL_NAME,
    description: DESCRIPTION,
    parameters: {
      type: 'object',
      properties: {
        spec: { type: 'object', description: '界面描述：{ "title"?: string, "items": Node[] }' },
      },
      required: ['spec'],
    },
    output: {
      schema: {
        type: 'object',
        properties: { ok: { type: 'boolean' }, nodes: { type: 'integer' } },
        required: ['ok', 'nodes'],
        additionalProperties: false,
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args) {
      const result = parseSpecInput(isRecord(args) ? args.spec : undefined)
      if (!result.ok) {
        throw new Error(`render_cards 参数校验失败：\n${formatErrors(result.errors)}\n请修正后重新调用 render_cards。`)
      }
      return { ok: true, nodes: result.nodes }
    },
  }
}

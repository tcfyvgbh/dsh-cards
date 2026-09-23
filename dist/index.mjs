//#region src/constants.ts
/** Cordis plugin name, package name, and style tag marker. */
const PLUGIN_ID = "dsh-cards";
/** Model-facing tool name; also the tool.call.toolview slot key. */
const TOOL_NAME = "render_cards";
//#endregion
//#region src/prompt.ts
const GUIDANCE_SECTION_NAME = "dsh-cards:guidance";
const GUIDANCE_TEXT = `## render_cards 卡片

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
`;
//#endregion
//#region src/spec/types.ts
const LIMITS = {
	depth: 4,
	nodes: 200,
	rows: 200,
	columns: 12,
	series: 6,
	points: 100,
	text: 2e3
};
//#endregion
//#region src/spec/check.ts
function ok(value) {
	return {
		value,
		errors: []
	};
}
function fail(path, message) {
	return { errors: [{
		path,
		message
	}] };
}
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Short human-readable description of a received value, used in error messages. */
function describe(value) {
	if (value === null) return "null";
	if (value === void 0) return "空值";
	if (Array.isArray(value)) return "数组";
	if (typeof value === "string") return JSON.stringify(value.length > 30 ? `${value.slice(0, 30)}...` : value);
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	return "对象";
}
function str(value, path) {
	if (value === void 0) return fail(path, "缺少必填字段");
	if (typeof value !== "string") return fail(path, `应为字符串，收到 ${describe(value)}`);
	if (value.length > LIMITS.text) return fail(path, `字符串长度 ${value.length} 超过上限 ${LIMITS.text}`);
	return ok(value);
}
function num(value, path) {
	if (value === void 0) return fail(path, "缺少必填字段");
	if (typeof value !== "number" || !Number.isFinite(value)) return fail(path, `应为数字，收到 ${describe(value)}`);
	return ok(value);
}
function cell(value, path) {
	if (typeof value === "number") return num(value, path);
	if (typeof value === "string") return str(value, path);
	if (value === void 0) return fail(path, "缺少必填字段");
	return fail(path, `应为字符串或数字，收到 ${describe(value)}`);
}
function bool(value, path) {
	if (typeof value === "boolean") return ok(value);
	return fail(path, `应为 true 或 false，收到 ${describe(value)}`);
}
function oneOf(value, allowed, path) {
	if (value === void 0) return fail(path, "缺少必填字段");
	if (typeof value === "string" && allowed.includes(value)) return ok(value);
	return fail(path, `只允许 ${allowed.join(" | ")}，收到 ${describe(value)}`);
}
function intRange(value, min, max, path) {
	if (value === void 0) return fail(path, "缺少必填字段");
	if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) return fail(path, `应为 ${min} 到 ${max} 之间的整数，收到 ${describe(value)}`);
	return ok(value);
}
/** Skip the check when the field is absent. */
function optional(value, path, check) {
	return value === void 0 ? ok(void 0) : check(value, path);
}
/** Check that a value is an array whose length sits within bounds. */
function list(value, path, bounds) {
	if (value === void 0) return fail(path, "缺少必填字段");
	if (!Array.isArray(value)) return fail(path, `应为数组，收到 ${describe(value)}`);
	if (value.length < bounds.min) return fail(path, `至少需要 ${bounds.min} 个${bounds.noun}`);
	if (value.length > bounds.max) return fail(path, `${bounds.noun}数量 ${value.length} 超过上限 ${bounds.max}`);
	return ok(value);
}
/** Check every element of an already-checked array; errors from all elements are reported. */
function each(checked, path, check) {
	if (checked.value === void 0) return { errors: checked.errors };
	const results = checked.value.map((item, index) => check(item, `${path}[${index}]`));
	const errors = results.flatMap((result) => result.errors);
	return errors.length > 0 ? { errors } : ok(results.map((result) => result.value));
}
/** Combine field checks into one object; absent optional fields are omitted from the result. */
function object(checks) {
	const errors = Object.values(checks).flatMap((check) => check.errors);
	if (errors.length > 0) return { errors };
	const entries = Object.entries(checks).filter(([, check]) => check.value !== void 0).map(([key, check]) => [key, check.value]);
	return ok(Object.fromEntries(entries));
}
//#endregion
//#region src/spec/data-rules.ts
const COLUMN_TYPES = [
	"text",
	"num",
	"bar",
	"badge"
];
const CHART_KINDS = [
	"line",
	"bar",
	"donut"
];
const DIRECTIONS = ["up", "down"];
/** Run cross-field checks only once every field passed on its own. */
function withCrossChecks(base, cross) {
	if (base.value === void 0) return base;
	const errors = cross(base.value);
	return errors.length > 0 ? { errors } : base;
}
function spark(value, path) {
	return each(list(value, path, {
		min: 2,
		max: LIMITS.points,
		noun: "数据点"
	}), path, num);
}
const stat = (v, p) => object({
	type: ok("stat"),
	label: str(v.label, `${p}.label`),
	value: cell(v.value, `${p}.value`),
	delta: optional(v.delta, `${p}.delta`, str),
	spark: optional(v.spark, `${p}.spark`, spark),
	better: optional(v.better, `${p}.better`, (x, q) => oneOf(x, DIRECTIONS, q))
});
function tableRow(value, path) {
	return each(list(value, path, {
		min: 1,
		max: LIMITS.columns,
		noun: "单元格"
	}), path, cell);
}
const table = (v, p) => withCrossChecks(object({
	type: ok("table"),
	columns: each(list(v.columns, `${p}.columns`, {
		min: 1,
		max: LIMITS.columns,
		noun: "列"
	}), `${p}.columns`, str),
	rows: each(list(v.rows, `${p}.rows`, {
		min: 0,
		max: LIMITS.rows,
		noun: "行"
	}), `${p}.rows`, tableRow),
	types: optional(v.types, `${p}.types`, (x, q) => each(list(x, q, {
		min: 1,
		max: LIMITS.columns,
		noun: "列类型"
	}), q, (y, r) => oneOf(y, COLUMN_TYPES, r))),
	sortable: optional(v.sortable, `${p}.sortable`, bool)
}), (node) => [...node.rows.flatMap((cells, index) => cells.length === node.columns.length ? [] : [{
	path: `${p}.rows[${index}]`,
	message: `列数应为 ${node.columns.length}，实际 ${cells.length}`
}]), ...node.types !== void 0 && node.types.length !== node.columns.length ? [{
	path: `${p}.types`,
	message: `长度应为 ${node.columns.length}（与 columns 一致），实际 ${node.types.length}`
}] : []]);
function series(value, path) {
	if (!isRecord(value)) return fail(path, `应为对象，收到 ${describe(value)}`);
	return object({
		name: str(value.name, `${path}.name`),
		data: each(list(value.data, `${path}.data`, {
			min: 1,
			max: LIMITS.points,
			noun: "数据点"
		}), `${path}.data`, num)
	});
}
const chart = (v, p) => withCrossChecks(object({
	type: ok("chart"),
	kind: oneOf(v.kind, CHART_KINDS, `${p}.kind`),
	title: optional(v.title, `${p}.title`, str),
	labels: each(list(v.labels, `${p}.labels`, {
		min: 1,
		max: LIMITS.points,
		noun: "标签"
	}), `${p}.labels`, str),
	series: each(list(v.series, `${p}.series`, {
		min: 1,
		max: LIMITS.series,
		noun: "数据系列"
	}), `${p}.series`, series)
}), (node) => {
	const lengthErrors = node.series.flatMap((entry, index) => entry.data.length === node.labels.length ? [] : [{
		path: `${p}.series[${index}].data`,
		message: `长度应为 ${node.labels.length}（与 labels 一致），实际 ${entry.data.length}`
	}]);
	if (node.kind !== "donut" || lengthErrors.length > 0) return lengthErrors;
	const data = node.series[0]?.data ?? [];
	if (data.some((value) => value < 0)) return [{
		path: `${p}.series[0].data`,
		message: "donut 的数值不能为负"
	}];
	if (data.every((value) => value === 0)) return [{
		path: `${p}.series[0].data`,
		message: "donut 的数值不能全为 0"
	}];
	return [];
});
const DATA_RULES = {
	stat,
	table,
	chart
};
//#endregion
//#region src/spec/validate.ts
const TONES = [
	"info",
	"success",
	"warning",
	"error"
];
const BADGE_TONES = ["neutral", ...TONES];
const VARIANTS = [
	"h2",
	"h3",
	"body",
	"muted"
];
function children(value, path, depth) {
	return each(list(value, path, {
		min: 1,
		max: LIMITS.nodes,
		noun: "元素"
	}), path, (item, itemPath) => node(item, itemPath, depth + 1));
}
function pair(value, path) {
	if (!isRecord(value)) return fail(path, `应为对象，收到 ${describe(value)}`);
	return object({
		key: str(value.key, `${path}.key`),
		value: cell(value.value, `${path}.value`)
	});
}
const RULES = {
	row: (v, p, d) => object({
		type: ok("row"),
		items: children(v.items, `${p}.items`, d)
	}),
	grid: (v, p, d) => object({
		type: ok("grid"),
		cols: intRange(v.cols, 1, 4, `${p}.cols`),
		items: children(v.items, `${p}.items`, d)
	}),
	card: (v, p, d) => object({
		type: ok("card"),
		title: optional(v.title, `${p}.title`, str),
		items: children(v.items, `${p}.items`, d)
	}),
	text: (v, p) => object({
		type: ok("text"),
		text: str(v.text, `${p}.text`),
		variant: optional(v.variant, `${p}.variant`, (x, q) => oneOf(x, VARIANTS, q))
	}),
	callout: (v, p) => object({
		type: ok("callout"),
		tone: oneOf(v.tone, TONES, `${p}.tone`),
		title: optional(v.title, `${p}.title`, str),
		content: str(v.content, `${p}.content`)
	}),
	list: (v, p) => object({
		type: ok("list"),
		items: each(list(v.items, `${p}.items`, {
			min: 1,
			max: LIMITS.rows,
			noun: "条目"
		}), `${p}.items`, str),
		ordered: optional(v.ordered, `${p}.ordered`, bool)
	}),
	keyvalue: (v, p) => object({
		type: ok("keyvalue"),
		pairs: each(list(v.pairs, `${p}.pairs`, {
			min: 1,
			max: LIMITS.rows,
			noun: "键值对"
		}), `${p}.pairs`, pair)
	}),
	badge: (v, p) => object({
		type: ok("badge"),
		text: str(v.text, `${p}.text`),
		tone: optional(v.tone, `${p}.tone`, (x, q) => oneOf(x, BADGE_TONES, q))
	}),
	...DATA_RULES
};
const TYPES = Object.keys(RULES);
function node(value, path, depth) {
	if (!isRecord(value)) return fail(path, `应为对象，收到 ${describe(value)}`);
	if (depth > LIMITS.depth) return fail(path, `嵌套层级超过上限 ${LIMITS.depth}`);
	const type = oneOf(value.type, TYPES, `${path}.type`);
	const rule = type.value === void 0 ? void 0 : RULES[type.value];
	return rule === void 0 ? { errors: type.errors } : rule(value, path, depth);
}
/** Count every node, including nested layout children. */
function countNodes(items) {
	return items.reduce((total, item) => total + 1 + (item.type === "row" || item.type === "grid" || item.type === "card" ? countNodes(item.items) : 0), 0);
}
/** Validate an already-parsed spec object and return a normalized copy. */
function validateSpec(input) {
	if (!isRecord(input)) return {
		ok: false,
		errors: [{
			path: "spec",
			message: `应为对象，收到 ${describe(input)}`
		}]
	};
	const checked = object({
		title: optional(input.title, "title", str),
		items: children(input.items, "items", 0)
	});
	if (checked.value === void 0) return {
		ok: false,
		errors: checked.errors
	};
	const nodes = countNodes(checked.value.items);
	if (nodes > LIMITS.nodes) return {
		ok: false,
		errors: [{
			path: "items",
			message: `节点总数 ${nodes} 超过上限 ${LIMITS.nodes}`
		}]
	};
	return {
		ok: true,
		spec: checked.value,
		nodes
	};
}
/** Accept a spec object or its JSON string form (models sometimes serialize it). */
function parseSpecInput(input) {
	if (typeof input !== "string") return validateSpec(input);
	try {
		return validateSpec(JSON.parse(input));
	} catch (error) {
		return {
			ok: false,
			errors: [{
				path: "spec",
				message: `不是合法的 JSON：${error instanceof Error ? error.message : String(error)}`
			}]
		};
	}
}
/** Render errors one per line as `path: message`, capped at `limit`. */
function formatErrors(errors, limit = 10) {
	const lines = errors.slice(0, limit).map((error) => `${error.path}: ${error.message}`);
	return errors.length > limit ? [...lines, `...另有 ${errors.length - limit} 条错误`].join("\n") : lines.join("\n");
}
//#endregion
//#region src/tool.ts
const DESCRIPTION = "把结构化信息渲染成只读卡片界面（看板、指标卡、表格、图表、提示框）。参数 spec 的组件协议见系统提示词中的「render_cards 卡片」一节。卡片只用于展示，不会把用户操作传回。";
function createCardsTool() {
	return {
		name: TOOL_NAME,
		description: DESCRIPTION,
		parameters: {
			type: "object",
			properties: { spec: {
				type: "object",
				description: "界面描述：{ \"title\"?: string, \"items\": Node[] }"
			} },
			required: ["spec"]
		},
		output: {
			schema: {
				type: "object",
				properties: {
					ok: { type: "boolean" },
					nodes: { type: "integer" }
				},
				required: ["ok", "nodes"],
				additionalProperties: false
			},
			render: (_args, value) => [{
				type: "text",
				text: JSON.stringify(value)
			}]
		},
		async execute(args) {
			const result = parseSpecInput(isRecord(args) ? args.spec : void 0);
			if (!result.ok) throw new Error(`render_cards 参数校验失败：\n${formatErrors(result.errors)}\n请修正后重新调用 render_cards。`);
			return {
				ok: true,
				nodes: result.nodes
			};
		}
	};
}
//#endregion
//#region src/index.ts
const name = PLUGIN_ID;
const inject = ["tools", "systemPrompt"];
function apply(ctx, config = {}) {
	const host = ctx;
	host.tools.register(createCardsTool());
	if (config.guidance !== false) host.systemPrompt.section({
		name: GUIDANCE_SECTION_NAME,
		order: 900,
		text: GUIDANCE_TEXT,
		interpolate: false
	});
}
//#endregion
export { apply, inject, name };

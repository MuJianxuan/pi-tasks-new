# @gotgenes/pi-subagents 快速参考

> 保留 `QUICK_REFERENCE.md` 文件名；当前内容面向已经切换完成后的日常查阅。

## 一眼看懂

当前状态：

- 依赖：`@gotgenes/pi-subagents`
- 启动：`spawnSubagent()`
- 停止：`abortSubagent()`
- 服务发现：`getSubagentsService()`
- 生命周期：`subagents:completed` / `subagents:failed`

## 关键文件

```text
pi-tasks-new/
├── package.json
├── src/
│   ├── index.ts
│   └── subagent-service.ts
├── test/
│   └── subagent-integration.test.ts
└── README.md
```

## 当前导入方式

```typescript
import { abortSubagent, getSubagentsService, spawnSubagent } from "./subagent-service.js";
```

## 最常用调用

### 检查服务

```typescript
const subagents = await getSubagentsService();
if (!subagents) {
  return textResult(
    "Subagent execution is currently unavailable. " +
    "Ensure the @gotgenes/pi-subagents extension is loaded and try again."
  );
}
```

### 启动子代理

```typescript
const agentId = await spawnSubagent(type, prompt, {
  description: subject,
  model,
  maxTurns,
  foreground: false,
});
```

### 停止子代理

```typescript
await abortSubagent(agentId);
```

## 参数映射

| 当前字段 | 含义 |
|----------|------|
| `description` | UI 中展示的简短描述 |
| `model` | 可选模型覆盖 |
| `maxTurns` | 最大轮数 |
| `foreground: false` | 后台运行 |

## 仍然保留的事件监听

```typescript
pi.events.on("subagents:completed", async (data) => { ... });
pi.events.on("subagents:failed", (data) => { ... });
```

这些监听器在当前实现里依然有效，不需要换成 service polling。

## 测试口径

当前测试应该 mock：

```typescript
vi.mock("../src/subagent-service.js", () => ({
  getSubagentsService: vi.fn(...),
  spawnSubagent: vi.fn(...),
  abortSubagent: vi.fn(...),
}));
```

不要再 mock 旧的 request/reply RPC 通道。

## 常见坑

### 忘记 `await`

```typescript
const service = await getSubagentsService();
```

### 继续用旧参数名

```typescript
// 错误
{ isBackground: true }

// 正确
{ foreground: false }
```

### 把 service 调用和生命周期事件混为一谈

- `spawnSubagent()` / `abortSubagent()`：负责控制子代理
- `subagents:completed` / `subagents:failed`：负责状态落盘与级联

## 快速验收

- `src/index.ts` 使用 `./subagent-service.js`
- `src/index.ts` 不再包含旧 RPC helper
- `TaskExecute` 先检查 `getSubagentsService()`
- `TaskStop` 调用 `abortSubagent()`
- `test/subagent-integration.test.ts` mock `subagent-service.js`
- 仓库里不再出现 `@tintinweb/pi-subagents`

## 调试

```bash
export PI_TASKS_DEBUG=1
npm run typecheck
npm test
npm run build
```

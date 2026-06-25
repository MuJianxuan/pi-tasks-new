# 代码变更快速参考

这是一个简化的变更对照表，方便快速查找和替换。

## 文件变更概览

```
pi-rao-tasks/
├── package.json              ✏️ 修改
├── src/
│   ├── index.ts             ✏️ 大量修改
│   └── subagent-service.ts  ✨ 新建
└── MIGRATION_GUIDE.md       ✨ 新建
```

## 关键代码替换模式

### 1. 导入语句

```diff
- import { randomUUID } from "node:crypto";
+ import * as SubagentService from "./subagent-service.js";
```

### 2. RPC 函数 → Service 调用

#### Spawn Agent
```diff
- const agentId = await spawnSubagent(type, prompt, {
-   description: subject,
-   isBackground: true,
-   maxTurns: maxTurns,
-   ...(model ? { model } : {}),
- });

+ const agentId = await SubagentService.spawnSubagent(type, prompt, {
+   description: subject,
+   model: model,
+   maxTurns: maxTurns,
+   foreground: false,
+ });
```

#### Stop Agent
```diff
- await stopSubagent(agentId);

+ await SubagentService.abortSubagent(agentId);
```

#### Get Agent Record
```diff
- // RPC 方式没有直接获取记录的方法
- // 需要通过事件监听

+ const record = await SubagentService.getSubagentRecord(agentId);
+ if (record) {
+   console.log(record.status, record.result);
+ }
```

### 3. 服务可用性检查

```diff
- if (!subagentsAvailable) {
-   return textResult("Subagent execution is currently unavailable. " +
-     "Ensure the @tintinweb/pi-subagents extension is loaded and try again.");
- }

+ const serviceReady = await ensureServiceReady();
+ if (!serviceReady) {
+   return textResult("Subagent execution unavailable. " +
+     "Install with: pi install npm:@gotgenes/pi-subagents");
+ }
```

### 4. 删除的代码块

完全删除以下内容（约 73 行）：

```typescript
// ── Subagent RPC helpers ──

type RpcReply<T = void> = ...
function rpcCall<T>(...) { ... }
function spawnSubagent(...) { ... }
function stopSubagent(...) { ... }

// ── Subagent extension presence & version detection ──
const PROTOCOL_VERSION = 2;
let subagentsAvailable = false;
let pendingWarning: string | undefined;
function checkSubagentsVersion() { ... }
checkSubagentsVersion();
pi.events.on("subagents:ready", () => checkSubagentsVersion());
```

### 5. 添加的代码块

在删除 RPC 代码的位置添加：

```typescript
// ── Subagent Service integration ──

// Initialize service on first use
let serviceInitialized = false;

async function ensureServiceReady(): Promise<boolean> {
  if (serviceInitialized) return SubagentService.isServiceAvailable();
  serviceInitialized = true;
  const service = await SubagentService.getSubagentsService();
  return service !== undefined;
}
```

## 事件监听保持不变

以下事件监听器**不需要修改**，因为 @gotgenes/pi-subagents 使用相同的事件名：

```typescript
// ✅ 保持不变
pi.events.on("subagents:completed", async (data) => { ... });

// ✅ 保持不变  
pi.events.on("subagents:failed", (data) => { ... });
```

## 工具函数参数映射

| RPC 旧参数 | Service 新参数 | 说明 |
|-----------|---------------|------|
| `isBackground: true` | `foreground: false` | 语义相反 |
| `{ model: "x" }` spread | `model: "x"` | 直接传递 |
| `maxTurns` | `maxTurns` | 相同 |
| `description` | `description` | 相同 |
| - | `inheritContext` | 新增：是否继承父上下文 |

## 完整修改位置清单

| 文件 | 行号范围 | 操作 | 描述 |
|------|---------|------|------|
| `package.json` | 28-35 | 添加 | 可选依赖配置 |
| `src/index.ts` | 17 | 删除 | `randomUUID` 导入 |
| `src/index.ts` | 34 | 添加 | Service 导入 |
| `src/index.ts` | 96-168 | 替换 | RPC 代码 → Service 初始化 |
| `src/index.ts` | 222-227 | 修改 | 级联 spawn 调用 |
| `src/index.ts` | 920-926 | 修改 | TaskExecute 可用性检查 |
| `src/index.ts` | 959-974 | 修改 | TaskExecute spawn 调用 |
| `src/index.ts` | 760-850 | 修改 | TaskOutput 获取记录逻辑 |
| `src/index.ts` | 729-758 | 修改 | TaskStop 停止逻辑 |
| `src/index.ts` | 11 | 修改 | 注释中的包名 |
| `src/index.ts` | 896 | 修改 | 工具描述 |

## TypeScript 类型导入

如果需要类型注解，可以导入：

```typescript
import type { 
  SubagentsService, 
  SubagentRecord,
  SpawnOptions 
} from "@gotgenes/pi-subagents/service";
```

## 调试技巧

### 启用调试日志

```bash
export PI_TASKS_DEBUG=1
pi -e ./src/index.ts
```

### 验证 Service 加载

在 `ensureServiceReady()` 后添加：

```typescript
async function ensureServiceReady(): Promise<boolean> {
  if (serviceInitialized) return SubagentService.isServiceAvailable();
  serviceInitialized = true;
  const service = await SubagentService.getSubagentsService();
  
  // 🔍 调试：验证服务加载
  if (service) {
    debug("✅ Subagents service loaded successfully");
  } else {
    debug("❌ Subagents service not available");
  }
  
  return service !== undefined;
}
```

### 检查代理状态

```typescript
const record = await SubagentService.getSubagentRecord(agentId);
if (record) {
  debug(`Agent ${agentId}:`, {
    status: record.status,
    toolUses: record.toolUses,
    result: record.result?.slice(0, 100)
  });
}
```

## 常见陷阱

### ❌ 错误：忘记 await

```typescript
// ❌ 错误
const service = SubagentService.getSubagentsService(); // 返回 Promise！

// ✅ 正确
const service = await SubagentService.getSubagentsService();
```

### ❌ 错误：参数名不匹配

```typescript
// ❌ 错误：isBackground 在新 API 中不存在
await SubagentService.spawnSubagent(type, prompt, {
  isBackground: true  // ❌
});

// ✅ 正确：使用 foreground
await SubagentService.spawnSubagent(type, prompt, {
  foreground: false  // ✅
});
```

### ❌ 错误：忘记保存 latestCtx

```typescript
// ❌ 错误：级联时 latestCtx 可能为 undefined
async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
  // 忘记保存上下文
}

// ✅ 正确：在函数开头保存
async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
  latestCtx = ctx; // ✅ 保存用于级联
}
```

## 迁移验证命令

```bash
# 1. 恢复原始状态（如果需要）
git restore src/index.ts

# 2. 应用所有变更
# （按照 MIGRATION_GUIDE.md 逐步操作）

# 3. 类型检查
npm run typecheck

# 4. 运行测试
npm test

# 5. 构建
npm run build

# 6. 手动测试
pi -e ./src/index.ts
```

## 迁移检查清单

```
迁移前准备：
□ 备份当前代码：git commit -am "backup before migration"
□ 确认 @gotgenes/pi-subagents 可用：pi install npm:@gotgenes/pi-subagents

代码修改：
□ 更新 package.json
□ 创建 src/subagent-service.ts
□ 修改 src/index.ts 导入
□ 删除 RPC 相关代码（96-168 行）
□ 添加 Service 初始化代码
□ 修改 TaskExecute 工具
□ 修改 TaskOutput 工具
□ 修改 TaskStop 工具
□ 修改级联 spawn 调用
□ 更新工具描述和注释

验证测试：
□ TypeScript 编译通过
□ 单元测试通过
□ 手动测试：创建任务
□ 手动测试：执行任务
□ 手动测试：查看输出
□ 手动测试：停止任务
□ 手动测试：自动级联

文档更新：
□ 更新 README.md（提及新依赖）
□ 更新 CHANGELOG.md
□ 创建 GitHub Release（如适用）
```

## 估计工作量

- **纯代码修改时间**：30-60 分钟
- **测试验证时间**：30-45 分钟
- **文档更新时间**：15-30 分钟
- **总计**：约 1.5-2.5 小时

## 需要帮助？

如果在迁移过程中遇到问题：

1. 查看 `MIGRATION_GUIDE.md` 详细说明
2. 检查 `src/subagent-service.ts` 的实现
3. 启用 `PI_TASKS_DEBUG=1` 查看日志
4. 对比本文档的代码模式
5. 提交 GitHub Issue

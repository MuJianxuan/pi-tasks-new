# 迁移指南：从 @tintinweb/pi-subagents 到 @gotgenes/pi-subagents

## 概述

本指南详细说明如何将 `@tintinweb/pi-tasks` 从基于 RPC 事件总线的 `@tintinweb/pi-subagents` 迁移到基于 Service API 的 `@gotgenes/pi-subagents`。

## 优势

- ✅ **In-process 架构**：零进程开销，所有子代理在同一运行时
- ✅ **类型安全**：完整的 TypeScript 接口
- ✅ **功能更强**：内置并发控制、steering、resume
- ✅ **零依赖困扰**：可选依赖，优雅降级
- ✅ **更好的跨扩展协作**：通过 Service API 标准化访问

## 迁移步骤

### Step 1: 已完成 ✅

1. 更新 `package.json` - 添加 `@gotgenes/pi-subagents` 为可选依赖
2. 创建 `src/subagent-service.ts` - Service 适配器层

### Step 2: 修改 `src/index.ts` 的导入部分

**位置**：第 17-34 行

**移除**：
```typescript
import { randomUUID } from "node:crypto";
```

**添加**：
```typescript
import * as SubagentService from "./subagent-service.js";
```

**修改后的导入部分应该是**：
```typescript
import { join, resolve } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { AutoClearManager } from "./auto-clear.js";
import { ProcessTracker } from "./process-tracker.js";
import {
  type CadenceConfig,
  createCadenceState,
  drainReminderForContext,
  evaluateToolResult,
  onTurnStart,
  resetCadenceState,
} from "./reminder-cadence.js";
import { TaskStore } from "./task-store.js";
import { loadTasksConfig } from "./tasks-config.js";
import { openSettingsMenu } from "./ui/settings-menu.js";
import { TaskWidget, type UICtx } from "./ui/task-widget.js";
import * as SubagentService from "./subagent-service.js";
```

### Step 3: 替换 RPC 相关代码

**位置**：第 96-168 行

**删除以下所有代码**：
```typescript
  // ── Subagent RPC helpers ──

  /** RPC reply envelope — matches pi-mono's RpcResponse shape. */
  type RpcReply<T = void> =
    | { success: true; data?: T }
    | { success: false; error: string };

  /** Call a subagents RPC method: emit request, wait for scoped reply, unwrap envelope. */
  function rpcCall<T>(channel: string, params: Record<string, unknown>, timeoutMs: number): Promise<T> {
    const requestId = randomUUID();
    debug(`rpc:send ${channel}`, { requestId });
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        unsub();
        debug(`rpc:timeout ${channel}`, { requestId });
        reject(new Error(`${channel} timeout`));
      }, timeoutMs);
      const unsub = pi.events.on(`${channel}:reply:${requestId}`, (raw: unknown) => {
        unsub(); clearTimeout(timer);
        debug(`rpc:reply ${channel}`, { requestId, raw });
        const reply = raw as RpcReply<T>;
        if (reply.success) resolve(reply.data as T);
        else reject(new Error(reply.error));
      });
      pi.events.emit(channel, { requestId, ...params });
      debug(`rpc:emitted ${channel}`, { requestId });
    });
  }

  /** Spawn a subagent via pi.events RPC (requires @tintinweb/pi-subagents extension). */
  function spawnSubagent(type: string, prompt: string, options?: any): Promise<string> {
    debug("spawn:call", { type, options: { ...options, prompt: undefined } });
    return rpcCall<{ id: string }>("subagents:rpc:spawn", { type, prompt, options }, 30_000)
      .then(d => { debug("spawn:ok", d); return d.id; });
  }

  /** Stop a subagent via pi.events RPC (requires @tintinweb/pi-subagents extension). */
  function stopSubagent(agentId: string): Promise<void> {
    return rpcCall<void>("subagents:rpc:stop", { agentId }, 10_000).catch(() => {});
  }

  // ── Subagent extension presence & version detection ──
  const PROTOCOL_VERSION = 2;
  let subagentsAvailable = false;
  let pendingWarning: string | undefined;

  /** Ping subagents and check protocol version. Works with any handler version. */
  function checkSubagentsVersion() {
    const requestId = randomUUID();
    const timer = setTimeout(() => { unsub(); }, 5_000);
    const unsub = pi.events.on(`subagents:rpc:ping:reply:${requestId}`, (raw: unknown) => {
      unsub(); clearTimeout(timer);
      const remoteVersion = (raw as any)?.data?.version as number | undefined;
      if (remoteVersion === undefined) {
        pendingWarning =
          "@tintinweb/pi-subagents is outdated — please update for task execution support.";
      } else if (remoteVersion > PROTOCOL_VERSION) {
        pendingWarning =
          `@tintinweb/pi-tasks is outdated (protocol v${PROTOCOL_VERSION}, ` +
          `pi-subagents has v${remoteVersion}) — please update for task execution support.`;
      } else if (remoteVersion < PROTOCOL_VERSION) {
        pendingWarning =
          `@tintinweb/pi-subagents is outdated (protocol v${remoteVersion}, ` +
          `pi-tasks has v${PROTOCOL_VERSION}) — please update for task execution support.`;
      } else {
        subagentsAvailable = true;
      }
    });
    pi.events.emit("subagents:rpc:ping", { requestId });
  }

  checkSubagentsVersion();
  pi.events.on("subagents:ready", () => checkSubagentsVersion());
```

**替换为**：
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

### Step 4: 修改生命周期事件监听

**位置**：第 203-269 行

**查找并替换 `subagents:completed` 事件监听器中的 spawn 调用**：

**原代码**（第 222-227 行）：
```typescript
          const agentId = await spawnSubagent(next.metadata.agentType, prompt, {
            description: next.subject,
            isBackground: true,
            maxTurns: cascadeConfig.maxTurns,
            ...(cascadeConfig.model ? { model: cascadeConfig.model } : {}),
          });
```

**替换为**：
```typescript
          const agentId = await SubagentService.spawnSubagent(
            next.metadata.agentType,
            prompt,
            {
              description: next.subject,
              model: cascadeConfig.model,
              maxTurns: cascadeConfig.maxTurns,
              foreground: false,
            }
          );
```

### Step 5: 修改 TaskExecute 工具

**位置**：约第 890-998 行

**找到 `TaskExecute` 的 `execute` 函数**，进行以下修改：

#### 5.1 修改可用性检查（第 920-926 行）

**原代码**：
```typescript
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      if (!subagentsAvailable) {
        return textResult(
          "Subagent execution is currently unavailable. " +
          "Ensure the @tintinweb/pi-subagents extension is loaded and try again."
        );
      }
```

**替换为**：
```typescript
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      latestCtx = ctx; // 保存最新的上下文用于级联
      
      const serviceReady = await ensureServiceReady();
      if (!serviceReady) {
        return textResult(
          "Subagent execution unavailable. " +
          "Install with: pi install npm:@gotgenes/pi-subagents"
        );
      }
```

#### 5.2 修改 spawn 调用（第 959-974 行）

**原代码**：
```typescript
        // Mark in_progress and spawn agent via RPC
        store.update(taskId, { status: "in_progress" });
        const prompt = buildTaskPrompt(task, params.additional_context);
        try {
          const agentId = await spawnSubagent(task.metadata.agentType, prompt, {
            description: task.subject,
            isBackground: true,
            maxTurns: params.max_turns,
            ...(params.model ? { model: params.model } : {}),
          });
          agentTaskMap.set(agentId, taskId);
          store.update(taskId, { owner: agentId, metadata: { ...task.metadata, agentId } });
          widget.setActiveTask(taskId);
          launched.push(`#${taskId} → agent ${agentId}`);
        } catch (err: any) {
          debug(`spawn:error task=#${taskId}`, err);
          store.update(taskId, { status: "pending" });
          results.push(`#${taskId}: spawn failed — ${err.message}`);
        }
```

**替换为**：
```typescript
        // Mark in_progress and spawn agent via Service API
        store.update(taskId, { status: "in_progress" });
        const prompt = buildTaskPrompt(task, params.additional_context);
        try {
          const agentId = await SubagentService.spawnSubagent(
            task.metadata.agentType,
            prompt,
            {
              description: task.subject,
              model: params.model,
              maxTurns: params.max_turns,
              foreground: false,
            }
          );
          agentTaskMap.set(agentId, taskId);
          store.update(taskId, { owner: agentId, metadata: { ...task.metadata, agentId } });
          widget.setActiveTask(taskId);
          launched.push(`#${taskId} → agent ${agentId}`);
        } catch (err: any) {
          debug(`spawn:error task=#${taskId}`, err);
          store.update(taskId, { status: "pending" });
          results.push(`#${taskId}: spawn failed — ${err.message}`);
        }
```

### Step 6: 修改 TaskOutput 工具

**位置**：约第 760-888 行

**找到 `TaskOutput` 的 `execute` 函数**，修改如下：

**原代码核心逻辑**（简化）：
```typescript
      // Check if this is an agent ID (subagent execution)
      let agentResult: string | undefined;
      if (agentTaskMap.has(taskIdOrAgentId)) {
        // ... RPC 等待逻辑
      }
```

**替换为**：
```typescript
      // Check if this is an agent ID (subagent execution)
      let agentResult: string | undefined;
      const actualTaskId = agentTaskMap.get(taskIdOrAgentId) || taskIdOrAgentId;
      
      // Try to get subagent record
      const record = await SubagentService.getSubagentRecord(taskIdOrAgentId);
      if (record) {
        if (params.block && record.status === "running") {
          // Wait for completion
          agentResult = await new Promise<string>((resolve) => {
            const timeout = Math.min(params.timeout || 30000, 600000);
            const timer = setTimeout(() => {
              unsub();
              resolve("(timeout waiting for agent)");
            }, timeout);
            
            const unsub = pi.events.on("subagents:completed", (data: any) => {
              if (data.id === taskIdOrAgentId) {
                clearTimeout(timer);
                unsub();
                resolve(data.result || "(completed with no output)");
              }
            });
          });
        } else {
          agentResult = record.result || `(agent ${record.status})`;
        }
      }
```

### Step 7: 修改 TaskStop 工具

**位置**：约第 729-758 行

**找到 `TaskStop` 的 `execute` 函数**：

**原代码**：
```typescript
      // If it's an agent ID, stop via RPC
      const task = store.get(taskIdOrAgentId);
      if (!task && agentTaskMap.has(taskIdOrAgentId)) {
        try {
          await stopSubagent(taskIdOrAgentId);
          return textResult(`Stopped agent ${taskIdOrAgentId}`);
        } catch (err: any) {
          return textResult(`Failed to stop agent: ${err.message}`);
        }
      }
```

**替换为**：
```typescript
      // If it's an agent ID, stop via Service API
      const task = store.get(taskIdOrAgentId);
      if (!task && agentTaskMap.has(taskIdOrAgentId)) {
        const stopped = await SubagentService.abortSubagent(taskIdOrAgentId);
        if (stopped) {
          return textResult(`Stopped agent ${taskIdOrAgentId}`);
        } else {
          return textResult(`Agent ${taskIdOrAgentId} not found or already stopped`);
        }
      }
```

### Step 8: 更新工具描述

**位置**：第 11 行和第 895-909 行

**修改注释**（第 11 行）：
```typescript
 *   TaskExecute  — Execute tasks as subagents (requires @gotgenes/pi-subagents)
```

**修改 TaskExecute 工具的描述**（第 896 行）：
```typescript
    description: `Execute one or more tasks as subagents.

## When to Use This Tool

- To start execution of tasks that have \`agentType\` set (created via TaskCreate with agentType parameter)
- Tasks must be \`pending\` with all blockedBy dependencies \`completed\`
- Each task runs as an independent background subagent

Requires @gotgenes/pi-subagents extension. Install with: pi install npm:@gotgenes/pi-subagents

## Parameters

- **task_ids**: Array of task IDs to execute
- **additional_context**: Extra context appended to each agent's prompt
- **model**: Model override for agents (e.g., "sonnet", "haiku")
- **max_turns**: Maximum turns per agent`,
```

## 测试清单

完成迁移后，测试以下场景：

### 基本功能
- [ ] TaskCreate - 创建带 agentType 的任务
- [ ] TaskExecute - 执行单个任务
- [ ] TaskExecute - 执行多个任务（并发）
- [ ] TaskOutput - 阻塞等待结果
- [ ] TaskOutput - 非阻塞查询状态
- [ ] TaskStop - 停止运行中的代理

### 高级功能
- [ ] 自动级联 - 完成任务后触发依赖任务
- [ ] 依赖注入 - 前置任务结果注入到后续任务
- [ ] 错误处理 - spawn 失败回退到 pending
- [ ] Widget 更新 - 实时显示代理状态

### 降级场景
- [ ] 未安装 @gotgenes/pi-subagents - 友好错误提示
- [ ] 服务初始化失败 - 优雅降级

## 回滚方案

如果迁移遇到问题，可以快速回滚：

```bash
cd pi-rao-tasks
git restore package.json src/index.ts
rm src/subagent-service.ts
npm install
```

## 常见问题

### Q: 为什么选择 @gotgenes/pi-subagents？
A: 它是 @tintinweb/pi-subagents 的硬分叉改进版，提供了：
- In-process 架构（零进程开销）
- 类型安全的 Service API
- 内置并发控制
- 更强大的功能（steering、resume）

### Q: 旧版本的任务文件兼容吗？
A: 完全兼容。任务存储格式没有变化，只是子代理的执行方式改变了。

### Q: 性能有提升吗？
A: 是的。In-process 架构避免了进程间通信开销，启动速度更快。

### Q: 可以同时支持两种方式吗？
A: 不推荐。虽然技术上可行，但会增加维护复杂度。建议直接迁移到新方式。

## 相关文档

- [@gotgenes/pi-subagents README](https://github.com/gotgenes/pi-packages/tree/main/packages/pi-subagents)
- [Service API 文档](https://github.com/gotgenes/pi-packages/blob/main/packages/pi-subagents/docs/)
- [原 @tintinweb/pi-subagents](https://github.com/tintinweb/pi-subagents)

## 贡献者

如有问题或建议，请提交 issue 到 GitHub 仓库。

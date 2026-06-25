# 当前集成说明：@gotgenes/pi-subagents

> 保留 `MIGRATION_GUIDE.md` 文件名是为了兼容已有链接；当前内容描述的是仓库已经采用的实现，而不是待执行的迁移步骤。

## 概述

`pi-tasks-new` 现在已经把子代理集成统一到 `@gotgenes/pi-subagents` 的 Service API。

当前实现特点：

- `TaskExecute` 通过 `getSubagentsService()` 按需加载服务
- `TaskExecute` 通过 `spawnSubagent()` 启动后台子代理
- `TaskStop` 通过 `abortSubagent()` 停止子代理
- `TaskOutput` 继续依赖 `subagents:completed` / `subagents:failed` 生命周期事件等待结果
- 未安装扩展时优雅降级，只有子代理相关功能不可用

## 历史摘要

这个包曾经使用旧的事件总线 RPC 方案与旧 subagent 扩展通信。当前代码库已经完成切换：

- 旧包名：`@tintinweb/pi-subagents`
- 当前包名：`@gotgenes/pi-subagents`
- 旧通信方式：自定义 request/reply RPC
- 当前通信方式：Service API + 生命周期事件

如果你需要查看历史对照，请看 `CHANGES.txt` 和 `CHANGELOG.md`。

## 当前实现位置

### 关键文件

- `package.json` — 可选依赖声明
- `src/subagent-service.ts` — Service API 适配层
- `src/index.ts` — `TaskExecute` / `TaskStop` / 生命周期事件接线
- `test/subagent-integration.test.ts` — 当前集成测试（mock service 适配层）

### 当前主调用路径

1. `TaskExecute` 调用 `getSubagentsService()` 检查服务是否可用
2. 服务可用时，调用 `spawnSubagent(type, prompt, options)`
3. 返回的 `agentId` 会写入任务元数据，并记录到 `agentTaskMap`
4. 完成和失败状态仍然通过 `pi.events` 生命周期事件更新任务状态
5. `TaskStop` 调用 `abortSubagent(agentId)` 停止运行中的子代理

## 当前接口用法

### 启动子代理

```typescript
const agentId = await spawnSubagent(task.metadata.agentType, prompt, {
  description: task.subject,
  model: params.model,
  maxTurns: params.max_turns,
  foreground: false,
});
```

### 停止子代理

```typescript
await abortSubagent(task.metadata.agentId);
```

### 检查服务可用性

```typescript
const subagents = await getSubagentsService();
if (!subagents) {
  return textResult(
    "Subagent execution is currently unavailable. " +
    "Ensure the @gotgenes/pi-subagents extension is loaded and try again."
  );
}
```

## 参数映射

| 旧概念 | 当前概念 | 说明 |
|--------|----------|------|
| `isBackground: true` | `foreground: false` | 语义相反 |
| request/reply RPC | Service method call | 不再需要自定义握手 |
| 版本协商 | 按需加载服务 | 由 `getSubagentsService()` 负责 |

## 保持不变的部分

以下部分没有因为切换到 Service API 而改变：

- `subagents:completed` 事件监听
- `subagents:failed` 事件监听
- 自动级联逻辑的任务状态推进方式
- `agentTaskMap` 的用途
- 任务文件格式和元数据结构

## 安装与运行

### 安装扩展

```bash
pi install npm:@gotgenes/pi-subagents
```

### 验证建议

```bash
npm run typecheck
npm test
npm run build
```

### 手动验证场景

- 创建带 `agentType` 的任务
- 运行 `TaskExecute`
- 运行 `TaskOutput`
- 运行 `TaskStop`
- 验证自动级联是否仍然生效

## 故障排查

### 1. 提示子代理不可用

先确认是否安装：

```bash
pi install npm:@gotgenes/pi-subagents
```

### 2. 调试日志

```bash
export PI_TASKS_DEBUG=1
pi -e ./src/index.ts
```

### 3. 常见问题

- 忘记 `await getSubagentsService()`
- 继续传 `isBackground` 而不是 `foreground`
- 测试里还在 mock 旧 RPC，而不是 mock `subagent-service.ts`

## FAQ

### 现在还支持旧包名吗？

不支持。当前代码、测试和文档都已经统一到 `@gotgenes/pi-subagents`。

### 为什么生命周期事件还保留？

因为当前实现只把“启动/停止/服务发现”切到了 Service API；任务完成与失败的状态传播仍然通过 `pi.events` 生命周期事件完成。

### 这个文件为什么还叫 `MIGRATION_GUIDE.md`？

为了避免打断已有引用和外部链接，但内容已经更新为当前状态说明。

## 相关文档

- `README.md` — 主入口文档
- `QUICK_REFERENCE.md` — 速查表
- `SUMMARY.md` — 当前集成摘要
- `REVIEW_CHECKLIST.md` — 验收清单
- `CHANGES.txt` — 历史对照
- `CHANGELOG.md` — 历史记录

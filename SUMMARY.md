# 当前集成摘要

## 结论

`pi-tasks-new` 现在已经完成对 `@gotgenes/pi-subagents` 的统一接入。

这次收口后的口径是：

- 代码层面：主调用路径已经切到 Service API
- 测试层面：已改为 mock `subagent-service.ts`
- 文档层面：README 和附属文档都以当前实现为准
- 历史层面：旧方案只保留在 `CHANGES.txt` / `CHANGELOG.md` 作为摘要和记录

## 当前实现概要

### 代码

- `package.json`：声明 `@gotgenes/pi-subagents` 为可选依赖
- `src/subagent-service.ts`：封装 service 访问
- `src/index.ts`：连接 `TaskExecute`、`TaskStop` 与生命周期事件
- `test/subagent-integration.test.ts`：验证当前 service 集成路径

### 运行方式

- `TaskExecute`：`getSubagentsService()` -> `spawnSubagent()`
- `TaskStop`：`abortSubagent()`
- `TaskOutput`：继续监听 `subagents:completed` / `subagents:failed`
- 自动级联：保持原有逻辑，只把启动调用切到 Service API

## 当前设计选择

### 为什么不是纯 polling？

当前实现没有把所有状态查询都改成 service record polling，而是保留了生命周期事件监听。这是刻意选择：

- 启动/停止能力使用 Service API
- 完成/失败传播继续使用事件
- 这样改动面更小，也和现有任务状态推进逻辑更一致

### 为什么保留 `subagent-service.ts`？

这个适配层把几个关键职责集中起来：

- 动态导入 `@gotgenes/pi-subagents`
- 缓存服务实例
- 统一错误提示
- 屏蔽主入口对底层 service 的直接耦合

## 当前文档结构

- `README.md` — 主文档，说明实际运行方式
- `MIGRATION_GUIDE.md` — 当前集成说明，保留少量历史背景
- `QUICK_REFERENCE.md` — 日常速查
- `REVIEW_CHECKLIST.md` — 当前实现验收清单
- `CHANGES.txt` — 历史对照
- `CHANGELOG.md` — 发布历史

## 已确认事项

- `src/` 与 `test/` 中不再直接引用 `@tintinweb/pi-subagents`
- `src/` 与 `test/` 中不再使用旧的 request/reply RPC 调用
- `TaskExecute` 当前错误提示已指向 `@gotgenes/pi-subagents`
- 文档中的主说明已经同步到 Service API 方案

## 仍需本地验证的事项

当前环境没有装依赖，因此以下命令还没有实际跑通：

```bash
npm run typecheck
npm test
npm run build
```

原因不是代码报错，而是当前运行环境缺少本地 `tsc` / `vitest`。

## 推荐验收顺序

1. 安装依赖
2. 运行 `npm run typecheck`
3. 运行 `npm test`
4. 运行 `npm run build`
5. 手动验证 `TaskExecute` / `TaskOutput` / `TaskStop`

## 一句话总结

这个包现在的子代理集成口径可以简化为：

“用 `@gotgenes/pi-subagents` 的 Service API 负责启动与停止，用 `pi.events` 生命周期事件负责完成与失败传播。”

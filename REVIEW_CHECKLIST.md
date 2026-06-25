# 当前实现验收清单

> 这份清单用于复查当前 `@gotgenes/pi-subagents` 集成是否自洽，不再面向“待迁移”的代码库。

## 目标

确认下面三件事同时成立：

1. 代码主路径已经使用 `@gotgenes/pi-subagents`
2. 测试验证的是当前 Service API 路径
3. 文档描述的是当前实现，而不是旧迁移过程

## 代码验收

### 依赖与适配层

- [x] `package.json` 声明了 `@gotgenes/pi-subagents`
- [x] `src/subagent-service.ts` 存在且作为唯一 service 适配层
- [x] 适配层负责动态导入与优雅降级

### 主入口

- [x] `src/index.ts` 从 `./subagent-service.js` 导入
- [x] `TaskExecute` 先检查 `getSubagentsService()`
- [x] `TaskExecute` 通过 `spawnSubagent()` 启动子代理
- [x] `TaskStop` 通过 `abortSubagent()` 停止子代理
- [x] `TaskExecute` 使用 `foreground: false`
- [x] 主入口不再内置旧 RPC helper

### 生命周期与状态

- [x] `subagents:completed` 仍用于完成态落盘
- [x] `subagents:failed` 仍用于失败态回退
- [x] 自动级联仍通过事件驱动推进
- [x] `agentTaskMap` 仍用于 agentId -> taskId 映射

## 测试验收

- [x] `test/subagent-integration.test.ts` mock `../src/subagent-service.js`
- [x] 测试覆盖服务不可用时的降级提示
- [x] 测试覆盖 `spawnSubagent()` 启动路径
- [x] 测试覆盖 `abortSubagent()` 停止路径
- [x] 测试覆盖生命周期事件驱动的完成/失败更新
- [x] 测试覆盖自动级联提示注入

## 文档验收

- [x] `README.md` 说明当前 Service API 实现
- [x] `MIGRATION_GUIDE.md` 已改为当前状态说明
- [x] `QUICK_REFERENCE.md` 只保留当前实现速查信息
- [x] `SUMMARY.md` 总结当前集成状态
- [x] `REVIEW_CHECKLIST.md` 本身不再假设“尚未迁移”

## 仓库残留检查

以下搜索结果应为空：

- [x] `@tintinweb/pi-subagents`
- [x] 旧 request/reply RPC 调用

允许继续存在的事件名：

- [x] `subagents:completed`
- [x] `subagents:failed`

## 手动验证建议

安装依赖后，建议按顺序验证：

```bash
npm run typecheck
npm test
npm run build
```

然后做一次真实流程：

- 创建带 `agentType` 的任务
- 启动 `TaskExecute`
- 查询 `TaskOutput`
- 中止 `TaskStop`
- 验证自动级联

## 结论模板

如果以上项目都通过，可以把当前实现表述为：

“`pi-tasks-new` 已经稳定接入 `@gotgenes/pi-subagents`；主控制面通过 Service API 完成，任务状态传播通过生命周期事件完成。”

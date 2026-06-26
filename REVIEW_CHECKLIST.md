# 当前实现复查清单

## 目标

确认下面几件事同时成立：

1. 代码主路径只保留核心任务管理能力
2. 测试验证的是当前 4 工具实现
3. 文档描述与当前仓库行为一致

## 代码复查

- [ ] `src/index.ts` 只注册 `TaskCreate`、`TaskList`、`TaskGet`、`TaskUpdate`
- [ ] `src/index.ts` 仍注册 `/tasks` 命令
- [ ] `src/task-store.ts` 仍负责 CRUD、依赖、持久化与锁
- [ ] `src/auto-clear.ts` 仍负责 completed task 自动清理
- [ ] `src/reminder-cadence.ts` 仍负责 reminder cadence
- [ ] `src/tasks-config.ts` 不再包含无效配置项

## 测试复查

- [ ] `test/task-store.test.ts` 通过
- [ ] `test/task-widget.test.ts` 通过
- [ ] `test/auto-clear.test.ts` 通过
- [ ] `test/reminder-cadence.test.ts` 通过

## 文档复查

- [ ] `README.md` 只描述当前 4 工具与当前设置项
- [ ] `SUMMARY.md` 与当前实现一致
- [ ] `MIGRATION_GUIDE.md` 不再描述已删除能力
- [ ] `package.json` 不再声明无效可选依赖

## 建议验证命令

```bash
npm run typecheck
npm test
npm run build
```
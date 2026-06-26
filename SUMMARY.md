# 当前实现摘要

## 结论

`pi-tasks-new` 当前聚焦于核心任务管理：

- 4 个工具：`TaskCreate`、`TaskList`、`TaskGet`、`TaskUpdate`
- 持久化任务存储与依赖关系维护
- 常驻 widget、系统 reminder、`/tasks` 菜单
- 可选的 completed task 自动清理

## 当前代码结构

- `src/index.ts` — 主入口，注册 4 个工具和 `/tasks` 命令
- `src/task-store.ts` — CRUD、依赖、持久化、锁
- `src/auto-clear.ts` — completed task 的延迟清理
- `src/reminder-cadence.ts` — reminder cadence 逻辑
- `src/tasks-config.ts` — 配置持久化
- `src/ui/task-widget.ts` — 常驻任务 widget
- `src/ui/settings-menu.ts` — `/tasks` 设置菜单

## 当前文档结构

- `README.md` — 主文档
- `MIGRATION_GUIDE.md` — 当前行为说明
- `REVIEW_CHECKLIST.md` — 当前实现复查清单
- `CHANGES.txt` / `CHANGELOG.md` — 历史记录

## 建议验证

```bash
npm run typecheck
npm test
npm run build
```

## 一句话总结

这个包现在是一个轻量、聚焦的任务管理扩展，核心价值在于任务维护、状态跟踪、依赖管理和会话内可视化。
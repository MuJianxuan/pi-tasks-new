# 当前行为说明

> 保留 `MIGRATION_GUIDE.md` 文件名是为了兼容已有链接。当前内容描述的是仓库现在的行为，而不是待执行的迁移步骤。

## 当前范围

`pi-tasks-new` 当前提供的是核心任务管理能力：

- 创建任务：`TaskCreate`
- 查看任务列表：`TaskList`
- 查看任务详情：`TaskGet`
- 更新任务：`TaskUpdate`
- 通过 `/tasks` 菜单进行人工维护
- 通过 widget 和 reminder 保持任务可见性

## 当前配置项

保存于 `<cwd>/.pi/tasks-config.json`：

- `taskScope`
- `autoClearCompleted`
- `showAll`
- `maxVisible`
- `sortOrder`
- `hiddenAt`

## 当前持久化行为

- `memory`：仅内存
- `session`：按 session 隔离的文件存储
- `project`：项目级共享文件存储

## 当前验证建议

```bash
npm run typecheck
npm test
npm run build
```

## 相关文档

- `README.md` — 主入口文档
- `SUMMARY.md` — 当前实现摘要
- `REVIEW_CHECKLIST.md` — 当前实现复查清单
- `CHANGELOG.md` — 历史记录
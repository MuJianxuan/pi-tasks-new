import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import initExtension from "../src/index.js";

function mockPi() {
  const tools = new Map<string, any>();
  const commands = new Map<string, any>();
  const lifecycleHandlers = new Map<string, ((...args: any[]) => any)[]>();

  const pi = {
    registerTool(def: any) { tools.set(def.name, def); },
    registerCommand(name: string, def: any) { commands.set(name, def); },
    on(event: string, handler: any) {
      if (!lifecycleHandlers.has(event)) lifecycleHandlers.set(event, []);
      lifecycleHandlers.get(event)!.push(handler);
    },
    events: { on() { return () => {}; } },
  };

  return {
    pi,
    tools,
    commands,
    async fireLifecycle(event: string, ...args: any[]) {
      for (const h of lifecycleHandlers.get(event) ?? []) {
        await h(...args);
      }
    },
  };
}

function mockCtx(sessionId = "session-1") {
  return {
    sessionManager: { getSessionId: () => sessionId },
    ui: {
      setWidget: vi.fn(),
      setStatus: vi.fn(),
      notify: vi.fn(),
    },
  };
}

describe("extension entrypoint", () => {
  const prevCwd = process.cwd();
  let workdir: string;

  beforeEach(() => {
    workdir = mkdtempSync(join(tmpdir(), "pi-tasks-test-"));
    process.chdir(workdir);
    delete process.env.PI_TASKS;
  });

  afterEach(() => {
    process.chdir(prevCwd);
    delete process.env.PI_TASKS;
  });

  it("registers only the four core task tools", () => {
    const mock = mockPi();
    initExtension(mock.pi as any);

    expect(Array.from(mock.tools.keys())).toEqual([
      "TaskCreate",
      "TaskList",
      "TaskGet",
      "TaskUpdate",
    ]);
    expect(mock.commands.has("tasks")).toBe(true);
  });

  it("migrates legacy persisted execution tasks on session upgrade", async () => {
    const tasksDir = join(workdir, ".pi", "tasks");
    mkdirSync(tasksDir, { recursive: true });
    const taskPath = join(tasksDir, "tasks-session-1.json");
    writeFileSync(taskPath, JSON.stringify({
      nextId: 3,
      tasks: [
        {
          id: "1",
          subject: "Legacy running task",
          description: "Desc",
          status: "in_progress",
          owner: "agent-12345",
          metadata: { agentId: "agent-12345", note: "legacy" },
          blocks: [],
          blockedBy: [],
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: "2",
          subject: "Legacy failed task",
          description: "Desc",
          status: "pending",
          owner: "agent-67890",
          metadata: { agentId: "agent-67890", note: "legacy-failed" },
          blocks: [],
          blockedBy: [],
          createdAt: 2,
          updatedAt: 2,
        },
      ],
    }, null, 2));

    const mock = mockPi();
    initExtension(mock.pi as any);
    await mock.fireLifecycle("before_agent_start", {}, mockCtx("session-1"));

    const persisted = JSON.parse(readFileSync(taskPath, "utf-8"));
    expect(persisted.tasks).toHaveLength(2);

    for (const task of persisted.tasks) {
      expect(task.status).toBe("pending");
      expect(task.metadata.agentId).toBeUndefined();
      expect(task.metadata.lastError).toContain("Legacy execution state was reset");
    }

    expect(persisted.tasks[0].owner).toBe("agent-12345");
    expect(persisted.tasks[1].owner).toBe("agent-67890");
  });
});

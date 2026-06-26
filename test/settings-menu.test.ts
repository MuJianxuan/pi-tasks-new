import { describe, expect, it, vi } from "vitest";
import type { TasksConfig } from "../src/tasks-config.js";

const saveCalls: TasksConfig[] = [];
const captured: { items?: any[]; onChange?: (id: string, value: string) => void } = {};

vi.mock("../src/tasks-config.js", async () => {
  const actual = await vi.importActual<typeof import("../src/tasks-config.js")>("../src/tasks-config.js");
  return {
    ...actual,
    saveTasksConfig: vi.fn((cfg: TasksConfig) => {
      saveCalls.push(JSON.parse(JSON.stringify(cfg)));
    }),
  };
});

vi.mock("@earendil-works/pi-coding-agent", () => ({
  getSettingsListTheme: () => ({})
}));

vi.mock("@earendil-works/pi-tui", () => {
  class SettingsList {
    constructor(items: any[], _maxVisible: number, _theme: any, onChange: any) {
      captured.items = items;
      captured.onChange = onChange;
    }
    handleInput() {}
  }

  class Container { addChild() {} }
  class Text {}
  class Spacer {}

  return { SettingsList, Container, Text, Spacer };
});

import { openSettingsMenu } from "../src/ui/settings-menu.js";

describe("openSettingsMenu", () => {
  it("renders each setting once and updates showAll correctly", async () => {
    saveCalls.length = 0;
    captured.items = undefined;
    captured.onChange = undefined;

    const ui = {
      async custom<T>(factory: any): Promise<T> {
        factory({}, { fg: (_c: string, text: string) => text, bold: (text: string) => text }, {}, () => undefined);
        return undefined as T;
      },
    };

    const cfg: TasksConfig = { taskScope: "session", showAll: false };
    await openSettingsMenu(ui as any, cfg, async () => {}, 4);

    expect(captured.items?.map(item => item.id)).toEqual([
      "taskScope",
      "showAll",
      "maxVisible",
      "sortOrder",
      "hiddenAt",
      "autoClearCompleted",
    ]);

    captured.onChange?.("showAll", "on");
    expect(cfg.showAll).toBe(true);
    expect(saveCalls.at(-1)?.showAll).toBe(true);
  });
});

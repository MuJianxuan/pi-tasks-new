/**
 * subagent-service.ts — Service adapter for @gotgenes/pi-subagents
 * 
 * Provides a typed interface to spawn and manage subagents using the
 * @gotgenes/pi-subagents Service API. Falls back gracefully when the
 * extension is not installed.
 */

import type { SubagentsService, SubagentRecord } from "@gotgenes/pi-subagents";

const DEBUG = !!process.env.PI_TASKS_DEBUG;
function debug(...args: unknown[]) {
  if (DEBUG) console.error("[pi-tasks:service]", ...args);
}

/** Cached service instance */
let serviceInstance: SubagentsService | undefined | null;

/** Whether we've already attempted to load the service */
let loadAttempted = false;

/**
 * Get the SubagentsService instance.
 * Returns undefined if @gotgenes/pi-subagents is not installed.
 * Caches the result to avoid repeated dynamic imports.
 */
export async function getSubagentsService(): Promise<SubagentsService | undefined> {
  if (loadAttempted) return serviceInstance ?? undefined;
  
  loadAttempted = true;
  
  try {
    debug("Attempting to load @gotgenes/pi-subagents service...");
    const { getSubagentsService } = await import("@gotgenes/pi-subagents");
    serviceInstance = getSubagentsService();
    
    if (serviceInstance) {
      debug("Service loaded successfully");
    } else {
      debug("Service imported but not initialized");
      serviceInstance = null;
    }
  } catch (error: any) {
    debug("Failed to load service:", error.message);
    serviceInstance = null;
  }
  
  return serviceInstance ?? undefined;
}

/**
 * Check if the subagents service is available.
 * This is a lightweight check that doesn't trigger service initialization.
 */
export function isServiceAvailable(): boolean {
  return serviceInstance !== null && serviceInstance !== undefined;
}

/** Options for spawning a subagent */
export interface SpawnSubagentOptions {
  description: string;
  model?: string;
  maxTurns?: number;
  inheritContext?: boolean;
  foreground?: boolean;
}

/**
 * Spawn a subagent using the Service API.
 * Returns the agent ID on success, or throws an error.
 */
export async function spawnSubagent(
  type: string,
  prompt: string,
  options: SpawnSubagentOptions
): Promise<string> {
  const service = await getSubagentsService();
  
  if (!service) {
    throw new Error(
      "Subagent service unavailable. " +
      "Install with: pi install npm:@gotgenes/pi-subagents"
    );
  }
  
  debug(`Spawning agent: type=${type}, description=${options.description}`);
  
  try {
    const agentId = service.spawn(type, prompt, {
      description: options.description,
      model: options.model,
      maxTurns: options.maxTurns,
      inheritContext: options.inheritContext,
      foreground: options.foreground ?? false,
    });
    
    debug(`Agent spawned successfully: id=${agentId}`);
    return agentId;
  } catch (error: any) {
    debug(`Spawn failed:`, error);
    throw new Error(`Failed to spawn agent: ${error.message}`);
  }
}

/**
 * Get the current state of a subagent.
 * Returns undefined if the agent is not found.
 */
export async function getSubagentRecord(agentId: string): Promise<SubagentRecord | undefined> {
  const service = await getSubagentsService();
  if (!service) return undefined;
  
  return service.getRecord(agentId);
}

/**
 * Abort a running or queued subagent.
 * Returns true if the agent was aborted, false if not found.
 */
export async function abortSubagent(agentId: string): Promise<boolean> {
  const service = await getSubagentsService();
  if (!service) return false;
  
  debug(`Aborting agent: id=${agentId}`);
  const aborted = service.abort(agentId);
  debug(`Abort result: ${aborted}`);
  return aborted;
}

/**
 * Send a steering message to a running subagent.
 * Returns true if the message was sent, false if the agent is not running.
 */
export async function steerSubagent(agentId: string, message: string): Promise<boolean> {
  const service = await getSubagentsService();
  if (!service) return false;
  
  debug(`Steering agent: id=${agentId}`);
  try {
    const steered = await service.steer(agentId, message);
    debug(`Steer result: ${steered}`);
    return steered;
  } catch (error: any) {
    debug(`Steer failed:`, error);
    return false;
  }
}

/**
 * Wait for all running and queued subagents to complete.
 */
export async function waitForAllSubagents(): Promise<void> {
  const service = await getSubagentsService();
  if (!service) return;
  
  debug("Waiting for all agents to complete...");
  await service.waitForAll();
  debug("All agents completed");
}

/**
 * Check if any subagents are currently running or queued.
 */
export async function hasRunningSubagents(): Promise<boolean> {
  const service = await getSubagentsService();
  if (!service) return false;
  
  return service.hasRunning();
}

/**
 * List all tracked subagents, most recent first.
 */
export async function listSubagents(): Promise<SubagentRecord[]> {
  const service = await getSubagentsService();
  if (!service) return [];
  
  return service.listAgents();
}

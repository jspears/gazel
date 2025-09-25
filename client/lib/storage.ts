/**
 * LocalStorage abstraction for storing user preferences and recent items
 */

interface WorkspaceData {
  searchHistory: string[];
  recentFiles: string[];
  recentTargets: Array<{name: string; type?: string; timestamp: number}>;
  recentQueries: Array<{query: string; format: string; timestamp: number}>;
}

export interface WorkspaceHistoryEntry {
  path: string;
  name?: string;
  lastUsed: number;
}

interface StorageConfig {
  // Global preferences
  preferences: {
    showHiddenTargets?: boolean;
    theme?: 'light' | 'dark' | 'system';
    defaultTab?: string;
    lastWorkspace?: string;
  };
  // Workspace history
  workspaceHistory: WorkspaceHistoryEntry[];
  // Per-workspace data
  workspaces: {
    [workspacePath: string]: WorkspaceData;
  };
  // Legacy data (for backwards compatibility, will be migrated)
  searchHistory?: string[];
  recentFiles?: string[];
  recentTargets?: Array<{name: string; type?: string; timestamp: number}>;
  recentQueries?: Array<{query: string; format: string; timestamp: number}>;
}

const STORAGE_KEY = 'gazel_config';
const MAX_HISTORY_ITEMS = 10;

class LocalStorageService {
  private config: StorageConfig;
  private currentWorkspace: string | null = null;

  constructor() {
    this.config = this.loadConfig();
    this.migrateOldData();
    // Set current workspace from preferences
    this.currentWorkspace = this.config.preferences.lastWorkspace || null;
  }

  private loadConfig(): StorageConfig {
    if (typeof window === 'undefined' || !window.localStorage) {
      return this.getDefaultConfig();
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...this.getDefaultConfig(), ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Failed to load config from localStorage:', error);
    }

    return this.getDefaultConfig();
  }

  private getDefaultConfig(): StorageConfig {
    return {
      preferences: {},
      workspaceHistory: [],
      workspaces: {}
    };
  }

  private getDefaultWorkspaceData(): WorkspaceData {
    return {
      searchHistory: [],
      recentFiles: [],
      recentTargets: [],
      recentQueries: []
    };
  }

  // Migrate old data to per-workspace structure
  private migrateOldData(): void {
    let needsSave = false;

    // If we have legacy data, migrate it to the current or default workspace
    if ((this.config as any).searchHistory || (this.config as any).recentFiles ||
        (this.config as any).recentTargets || (this.config as any).recentQueries) {

      const defaultWorkspace = this.config.preferences.lastWorkspace || 'default';

      if (!this.config.workspaces) {
        this.config.workspaces = {};
      }

      if (!this.config.workspaces[defaultWorkspace]) {
        this.config.workspaces[defaultWorkspace] = this.getDefaultWorkspaceData();
      }

      // Migrate data
      if ((this.config as any).searchHistory) {
        this.config.workspaces[defaultWorkspace].searchHistory = (this.config as any).searchHistory;
        delete (this.config as any).searchHistory;
      }
      if ((this.config as any).recentFiles) {
        this.config.workspaces[defaultWorkspace].recentFiles = (this.config as any).recentFiles;
        delete (this.config as any).recentFiles;
      }
      if ((this.config as any).recentTargets) {
        this.config.workspaces[defaultWorkspace].recentTargets = (this.config as any).recentTargets;
        delete (this.config as any).recentTargets;
      }
      if ((this.config as any).recentQueries) {
        this.config.workspaces[defaultWorkspace].recentQueries = (this.config as any).recentQueries;
        delete (this.config as any).recentQueries;
      }

      needsSave = true;
    }

    // Ensure workspaces object exists
    if (!this.config.workspaces) {
      this.config.workspaces = {};
      needsSave = true;
    }

    // Ensure workspaceHistory array exists
    if (!this.config.workspaceHistory) {
      this.config.workspaceHistory = [];
      needsSave = true;
    }

    if (needsSave) {
      this.saveConfig();
    }
  }

  // Set the current workspace
  setCurrentWorkspace(workspace: string, workspaceName?: string): void {
    this.currentWorkspace = workspace;
    this.config.preferences.lastWorkspace = workspace;

    // Ensure workspace data exists
    if (!this.config.workspaces[workspace]) {
      this.config.workspaces[workspace] = this.getDefaultWorkspaceData();
    }

    // Add or update workspace history
    this.addWorkspaceToHistory(workspace, workspaceName);

    this.saveConfig();
  }

  // Add workspace to history
  private addWorkspaceToHistory(path: string, name?: string): void {
    if (!this.config.workspaceHistory) {
      this.config.workspaceHistory = [];
    }

    // Remove existing entry if present
    const existingIndex = this.config.workspaceHistory.findIndex(w => w.path === path);
    if (existingIndex !== -1) {
      // Update the existing entry's lastUsed time and name if provided
      const existing = this.config.workspaceHistory[existingIndex];
      existing.lastUsed = Date.now();
      if (name) {
        existing.name = name;
      }
      // Move to front
      this.config.workspaceHistory.splice(existingIndex, 1);
      this.config.workspaceHistory.unshift(existing);
    } else {
      // Add new entry at the beginning
      this.config.workspaceHistory.unshift({
        path,
        name,
        lastUsed: Date.now()
      });

      // Keep only the last 10 workspaces
      const MAX_WORKSPACE_HISTORY = 10;
      if (this.config.workspaceHistory.length > MAX_WORKSPACE_HISTORY) {
        this.config.workspaceHistory = this.config.workspaceHistory.slice(0, MAX_WORKSPACE_HISTORY);
      }
    }
  }

  // Get workspace history
  getWorkspaceHistory(): WorkspaceHistoryEntry[] {
    if (!this.config.workspaceHistory) {
      this.config.workspaceHistory = [];
    }
    return [...this.config.workspaceHistory];
  }

  // Remove workspace from history
  removeWorkspaceFromHistory(path: string): void {
    if (!this.config.workspaceHistory) {
      return;
    }

    this.config.workspaceHistory = this.config.workspaceHistory.filter(w => w.path !== path);

    // Also remove the workspace data if it exists
    if (this.config.workspaces && this.config.workspaces[path]) {
      delete this.config.workspaces[path];
    }

    this.saveConfig();
  }

  // Get workspace-specific data
  private getWorkspaceData(): WorkspaceData {
    if (!this.currentWorkspace) {
      // If no workspace is set, use a default one
      this.currentWorkspace = 'default';
    }

    if (!this.config.workspaces[this.currentWorkspace]) {
      this.config.workspaces[this.currentWorkspace] = this.getDefaultWorkspaceData();
    }

    return this.config.workspaces[this.currentWorkspace];
  }

  private saveConfig(): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save config to localStorage:', error);
    }
  }

  // Search history methods
  addSearchQuery(query: string): void {
    if (!query.trim()) return;

    const data = this.getWorkspaceData();

    // Remove existing occurrence if present
    data.searchHistory = data.searchHistory.filter(q => q !== query);

    // Add to beginning
    data.searchHistory.unshift(query);

    // Limit to max items
    if (data.searchHistory.length > MAX_HISTORY_ITEMS) {
      data.searchHistory = data.searchHistory.slice(0, MAX_HISTORY_ITEMS);
    }

    this.saveConfig();
  }

  getSearchHistory(): string[] {
    const data = this.getWorkspaceData();
    return [...data.searchHistory];
  }

  clearSearchHistory(): void {
    const data = this.getWorkspaceData();
    data.searchHistory = [];
    this.saveConfig();
  }

  // Recent files methods
  addRecentFile(path: string): void {
    if (!path.trim()) return;

    const data = this.getWorkspaceData();

    // Remove existing occurrence if present
    data.recentFiles = data.recentFiles.filter(f => f !== path);

    // Add to beginning
    data.recentFiles.unshift(path);

    // Limit to max items
    if (data.recentFiles.length > MAX_HISTORY_ITEMS) {
      data.recentFiles = data.recentFiles.slice(0, MAX_HISTORY_ITEMS);
    }

    this.saveConfig();
  }

  getRecentFiles(): string[] {
    const data = this.getWorkspaceData();
    return [...data.recentFiles];
  }

  clearRecentFiles(): void {
    const data = this.getWorkspaceData();
    data.recentFiles = [];
    this.saveConfig();
  }

  // Recent targets management
  addRecentTarget(name: string, type?: string): void {
    const data = this.getWorkspaceData();

    // Remove existing entry if present
    data.recentTargets = data.recentTargets.filter(t => t.name !== name);

    // Add new entry at the beginning
    data.recentTargets.unshift({
      name,
      type,
      timestamp: Date.now()
    });

    // Keep only the most recent items
    if (data.recentTargets.length > MAX_HISTORY_ITEMS) {
      data.recentTargets = data.recentTargets.slice(0, MAX_HISTORY_ITEMS);
    }

    this.saveConfig();
  }

  getRecentTargets(): Array<{name: string; type?: string; timestamp: number}> {
    const data = this.getWorkspaceData();
    return [...data.recentTargets];
  }

  clearRecentTargets(): void {
    const data = this.getWorkspaceData();
    data.recentTargets = [];
    this.saveConfig();
  }

  // Recent queries management
  addRecentQuery(query: string, format: string): void {
    const data = this.getWorkspaceData();

    // Remove existing entry if present
    data.recentQueries = data.recentQueries.filter(q => q.query !== query);

    // Add new entry at the beginning
    data.recentQueries.unshift({
      query,
      format,
      timestamp: Date.now()
    });

    // Keep only the most recent items
    if (data.recentQueries.length > MAX_HISTORY_ITEMS) {
      data.recentQueries = data.recentQueries.slice(0, MAX_HISTORY_ITEMS);
    }

    this.saveConfig();
  }

  getRecentQueries(): Array<{query: string; format: string; timestamp: number}> {
    const data = this.getWorkspaceData();
    return [...data.recentQueries];
  }

  clearRecentQueries(): void {
    const data = this.getWorkspaceData();
    data.recentQueries = [];
    this.saveConfig();
  }

  // Preferences methods
  setPreference<K extends keyof StorageConfig['preferences']>(
    key: K,
    value: StorageConfig['preferences'][K]
  ): void {
    this.config.preferences[key] = value;
    this.saveConfig();
  }

  getPreference<K extends keyof StorageConfig['preferences']>(
    key: K
  ): StorageConfig['preferences'][K] {
    return this.config.preferences[key];
  }

  getAllPreferences(): StorageConfig['preferences'] {
    return { ...this.config.preferences };
  }

  // Clear all data for current workspace
  clearCurrentWorkspace(): void {
    if (this.currentWorkspace && this.config.workspaces[this.currentWorkspace]) {
      this.config.workspaces[this.currentWorkspace] = this.getDefaultWorkspaceData();
      this.saveConfig();
    }
  }

  // Clear all data
  clearAll(): void {
    this.config = this.getDefaultConfig();
    this.currentWorkspace = null;
    this.saveConfig();
  }
}

// Export singleton instance
export const storage = new LocalStorageService();

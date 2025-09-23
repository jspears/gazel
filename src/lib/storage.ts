/**
 * LocalStorage abstraction for storing user preferences and recent items
 */

interface StorageConfig {
  searchHistory: string[];
  recentFiles: string[];
  preferences: {
    showHiddenTargets?: boolean;
    theme?: 'light' | 'dark' | 'system';
    defaultTab?: string;
  };
}

const STORAGE_KEY = 'gazel_config';
const MAX_HISTORY_ITEMS = 10;

class LocalStorageService {
  private config: StorageConfig;

  constructor() {
    this.config = this.loadConfig();
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
      searchHistory: [],
      recentFiles: [],
      preferences: {}
    };
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

    // Remove existing occurrence if present
    this.config.searchHistory = this.config.searchHistory.filter(q => q !== query);
    
    // Add to beginning
    this.config.searchHistory.unshift(query);
    
    // Limit to max items
    if (this.config.searchHistory.length > MAX_HISTORY_ITEMS) {
      this.config.searchHistory = this.config.searchHistory.slice(0, MAX_HISTORY_ITEMS);
    }

    this.saveConfig();
  }

  getSearchHistory(): string[] {
    return [...this.config.searchHistory];
  }

  clearSearchHistory(): void {
    this.config.searchHistory = [];
    this.saveConfig();
  }

  // Recent files methods
  addRecentFile(path: string): void {
    if (!path.trim()) return;

    // Remove existing occurrence if present
    this.config.recentFiles = this.config.recentFiles.filter(f => f !== path);
    
    // Add to beginning
    this.config.recentFiles.unshift(path);
    
    // Limit to max items
    if (this.config.recentFiles.length > MAX_HISTORY_ITEMS) {
      this.config.recentFiles = this.config.recentFiles.slice(0, MAX_HISTORY_ITEMS);
    }

    this.saveConfig();
  }

  getRecentFiles(): string[] {
    return [...this.config.recentFiles];
  }

  clearRecentFiles(): void {
    this.config.recentFiles = [];
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

  // Clear all data
  clearAll(): void {
    this.config = this.getDefaultConfig();
    this.saveConfig();
  }
}

// Export singleton instance
export const storage = new LocalStorageService();

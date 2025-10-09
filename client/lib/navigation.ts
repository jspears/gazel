import {writable} from 'svelte/store';

/**
 * Client-side navigation utilities using the browser's History API
 */

export interface AppState {
  tab?: string;
  target?: string;
  graphTarget?: string;
  file?: string;
  query?: string;
  queryType?: string;
  maxDepth?: string;
  searchQuery?: string;
  selectedType?: string;
  showHidden?: string;
  workspace?: string;
}

/**
 * Parse URL search parameters into app state
 */
export function parseUrlParams(): AppState {
  const params = new URLSearchParams(window.location.search);
  const state: AppState = {};
  
  // Parse each parameter
  if (params.has('tab')) state.tab = params.get('tab') || undefined;
  if (params.has('target')) state.target = params.get('target') || undefined;
  if (params.has('graphTarget')) state.graphTarget = params.get('graphTarget') || undefined;
  if (params.has('file')) state.file = params.get('file') || undefined;
  if (params.has('query')) state.query = params.get('query') || undefined;
  if (params.has('queryType')) state.queryType = params.get('queryType') || undefined;
  if (params.has('maxDepth')) state.maxDepth = params.get('maxDepth') || undefined;
  if (params.has('searchQuery')) state.searchQuery = params.get('searchQuery') || undefined;
  if (params.has('selectedType')) state.selectedType = params.get('selectedType') || undefined;
  if (params.has('showHidden')) state.showHidden = params.get('showHidden') || undefined;
  if (params.has('workspace')) state.workspace = params.get('workspace') || undefined;
  
  return state;
}

/**
 * Update URL with new state without reloading the page
 */
export function updateUrl(state: AppState, replace = false) {
  const params = new URLSearchParams();
  Object.entries(state).forEach(([key, value]) => {
    if (value != null ) params.append(key, value);
  });
  
  nav.set(state);

  const url = params.toString() ? `?${params.toString()}` : window.location.pathname;
  
  if (replace) {
    window.history.replaceState(state, '', url);
  } else {
    window.history.pushState(state, '', url);
  }
}

/**
 * Get current state from URL or history state
 */
export function getCurrentState(): AppState {
  // First try to get state from history
  const historyState = window.history.state as AppState;
  if (historyState && typeof historyState === 'object') {
    return historyState;
  }
  
  // Fall back to parsing URL
  return parseUrlParams();
}

/**
 * Navigate to a specific tab with optional parameters
 */
export function navigateToTab(tab: string, additionalState: Partial<AppState> = {}) {
  const currentState = getCurrentState();
  const newState: AppState = {
    ...currentState,
    tab,
    ...additionalState
  };
  
  // // Clear tab-specific parameters when switching tabs
  // switch (tab) {
  //   case 'targets':
  //     delete newState.graphTarget;
  //     delete newState.file;
  //     delete newState.query;
  //     break;
  //   case 'graph':
  //     delete newState.target;
  //     delete newState.file;
  //     delete newState.query;
  //     delete newState.searchQuery;
  //     delete newState.selectedType;
  //     break;
  //   case 'files':
  //     delete newState.target;
  //     delete newState.graphTarget;
  //     delete newState.query;
  //     break;
  //   case 'query':
  //     delete newState.target;
  //     delete newState.graphTarget;
  //     delete newState.file;
  //     break;
  //   case 'workspace':
  //     delete newState.target;
  //     delete newState.graphTarget;
  //     delete newState.file;
  //     delete newState.query;
  //     break;
  //   case 'commands':
  //     delete newState.target;
  //     delete newState.graphTarget;
  //     delete newState.file;
  //     delete newState.query;
  //     break;
  // }
  
  updateUrl(newState);
}

/**
 * Update a specific parameter without changing others
 */
export function updateParam(key: keyof AppState, value: string | undefined) {
  const currentState = getCurrentState();
  const newState = { ...currentState };
  
  if (value === undefined || value === null || value === '') {
    delete newState[key];
  } else {
    newState[key] = value;
  }
  
  updateUrl(newState, true); // Use replace to avoid creating too many history entries
}

/**
 * Initialize navigation and set up event listeners
 */
export function initNavigation(onStateChange: (state: AppState, location: string) => void) {
  // Handle browser back/forward buttons
  window.addEventListener('popstate', (event) => {
    const state = Object.assign({},event.state as AppState, parseUrlParams());
    nav.set(state);
    nav.subscribe((state) => {
      onStateChange(state, document.location.pathname);
    });
    onStateChange(state, document.location.pathname);
  });
  
  // Handle initial load
  const initialState = parseUrlParams();
  if (Object.keys(initialState).length > 0) {
    // Replace the initial state to ensure it's in history
    window.history.replaceState(initialState, '', window.location.search);
  }
  
  return initialState;
}

/**
 * Create a shareable URL for the current state
 */
export function getShareableUrl(): string {
  return window.location.href;
}

/**
 * Copy the current URL to clipboard
 */
export async function copyUrlToClipboard(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(getShareableUrl());
    return true;
  } catch (err) {
    console.error('Failed to copy URL:', err);
    return false;
  }
}
export const nav = writable(getCurrentState());

// App Registry - Central hub for all generation apps
import { AppConfig, AppRegistry } from './types';
import { lumepetConfig } from './lumepet';
import { childArtPortraitConfig } from './child-art-portrait';
import { humanPortraitConfig } from './human-portrait';

// Export all app configs
export { lumepetConfig } from './lumepet';
export { childArtPortraitConfig } from './child-art-portrait';
export { humanPortraitConfig } from './human-portrait';
export * from './types';

// App Registry - all available apps
export const apps: AppRegistry = {
  lumepet: lumepetConfig,
  'child-art-portrait': childArtPortraitConfig,
  'human-portrait': humanPortraitConfig,
};

// Get app by slug
export function getAppBySlug(slug: string): AppConfig | undefined {
  return apps[slug];
}

// Get all apps as array
export function getAllApps(): AppConfig[] {
  return Object.values(apps);
}

// Get all published apps (for hub display)
export function getPublishedApps(): AppConfig[] {
  return Object.values(apps);
}

// Get app by ID
export function getAppById(id: string): AppConfig | undefined {
  return Object.values(apps).find(app => app.id === id);
}

// Default app (for backwards compatibility)
export const defaultApp = lumepetConfig;

// Hub metadata
export const hubConfig = {
  name: "Color",
  tagline: "AI-Powered Art Generation Hub",
  description: "Create stunning AI-generated artwork from your photos. Choose from our collection of creative apps.",
  logo: undefined, // Will add Color logo later
};


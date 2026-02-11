import { readFileSync } from 'fs';
import { join } from 'path';
import { MvpConfigSchema, type MvpConfig } from './schema';

/**
 * Config loader with strict validation
 * スキーマ外キーは起動時エラー
 */
export function loadMvpConfig(): MvpConfig {
  const configPath = join(process.cwd(), 'config', 'mvpConfig.json');
  
  try {
    const fileContent = readFileSync(configPath, 'utf-8');
    const rawConfig = JSON.parse(fileContent);
    
    // Strict validation: スキーマ外キーがあればエラー
    const result = MvpConfigSchema.safeParse(rawConfig);
    
    if (!result.success) {
      const errors = result.error.errors.map(e => 
        `${e.path.join('.')}: ${e.message}`
      ).join('\n');
      throw new Error(
        `Config validation failed (スキーマ外キーまたは型不一致):\n${errors}`
      );
    }
    
    return result.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load config from ${configPath}: ${error.message}`);
    }
    throw error;
  }
}

// Singleton instance (server-side only)
let configInstance: MvpConfig | null = null;

export function getMvpConfig(): MvpConfig {
  if (!configInstance) {
    configInstance = loadMvpConfig();
  }
  return configInstance;
}

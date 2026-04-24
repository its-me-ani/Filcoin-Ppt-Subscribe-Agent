/**
 * Data Module Index
 * Main entry point for the data layer
 */

// Export database service
export { database } from './database';

// Export schema
export { SCHEMA_VERSION, TABLE_NAMES } from './schema';

// Export types
export * from './types';

// Export repositories
export {
    customerRepository,
    inventoryRepository,
    businessInfoRepository,
    invoiceRepository
} from './repositories';

// Export migration utilities
export { runMigration, isMigrationCompleted, clearMigratedLocalStorage } from './migration';

// Export initialization function
import { database } from './database';
import { runMigration } from './migration';

/**
 * Initialize the data layer
 * This should be called once when the app starts
 */
export async function initializeDataLayer(): Promise<void> {
    try {
        if (import.meta.env.DEV) console.log('[Data] Initializing data layer...');

        // Initialize database
        await database.initialize();

        // Run migration from localStorage
        await runMigration();

        if (import.meta.env.DEV) console.log('[Data] Data layer initialized successfully');
    } catch (error) {
        console.error('[Data] Failed to initialize data layer:', error);
        throw error;
    }
}

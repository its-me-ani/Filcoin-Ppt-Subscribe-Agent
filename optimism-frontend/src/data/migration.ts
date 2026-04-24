/**
 * Data Migration
 * No-op stubs — localStorage is the primary store, no migration needed
 */

export async function runMigration() {
    return { success: true, stats: {} };
}

export function isMigrationCompleted() {
    return true;
}

export function clearMigratedLocalStorage() { }

export default { runMigration, isMigrationCompleted, clearMigratedLocalStorage };

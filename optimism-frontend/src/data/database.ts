/**
 * Database Service
 * No-op stub — localStorage is used directly by repositories
 */

class DatabaseService {
    async initialize(): Promise<void> { }
}

export const database = new DatabaseService();
export default database;

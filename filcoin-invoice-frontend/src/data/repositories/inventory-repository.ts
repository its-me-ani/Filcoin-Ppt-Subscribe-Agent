/**
 * Inventory Repository
 * CRUD operations for inventory items using localStorage
 */

import { InventoryItem } from '../types';

const INVENTORY_KEY = 'app_inventory_items';

function getStore<T>(key: string): T[] {
    try {
        return JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
        return [];
    }
}

function setStore<T>(key: string, data: T[]): void {
    localStorage.setItem(key, JSON.stringify(data));
}

export const inventoryRepository = {
    /**
     * Get all inventory items, sorted by name ASC
     */
    async getAll(): Promise<InventoryItem[]> {
        try {
            const items = getStore<InventoryItem>(INVENTORY_KEY);
            return items.sort((a, b) => a.name.localeCompare(b.name));
        } catch (error) {
            console.error('[InventoryRepository] GetAll failed:', error);
            return [];
        }
    },

    /**
     * Get inventory item by ID
     */
    async getById(id: string): Promise<InventoryItem | null> {
        try {
            const items = getStore<InventoryItem>(INVENTORY_KEY);
            return items.find(item => item.id === id) || null;
        } catch (error) {
            console.error('[InventoryRepository] GetById failed:', error);
            return null;
        }
    },

    /**
     * Create a new inventory item
     */
    async create(item: Omit<InventoryItem, 'createdAt' | 'updatedAt'>): Promise<boolean> {
        try {
            const items = getStore<InventoryItem>(INVENTORY_KEY);
            const now = new Date().toISOString();
            const newItem: InventoryItem = {
                ...item,
                createdAt: now,
                updatedAt: now,
            };
            items.push(newItem);
            setStore(INVENTORY_KEY, items);
            return true;
        } catch (error) {
            console.error('[InventoryRepository] Create failed:', error);
            return false;
        }
    },

    /**
     * Update an existing inventory item
     */
    async update(id: string, item: Partial<InventoryItem>): Promise<boolean> {
        try {
            const items = getStore<InventoryItem>(INVENTORY_KEY);
            const index = items.findIndex(i => i.id === id);
            if (index === -1) return false;

            const now = new Date().toISOString();
            items[index] = {
                ...items[index],
                ...item,
                id, // preserve original id
                updatedAt: now,
            };

            setStore(INVENTORY_KEY, items);
            return true;
        } catch (error) {
            console.error('[InventoryRepository] Update failed:', error);
            return false;
        }
    },

    /**
     * Save an inventory item (create or update)
     */
    async save(item: Omit<InventoryItem, 'createdAt' | 'updatedAt'>): Promise<boolean> {
        const existing = await this.getById(item.id);
        if (existing) {
            return this.update(item.id, item);
        }
        return this.create(item);
    },

    /**
     * Delete an inventory item
     */
    async delete(id: string): Promise<boolean> {
        try {
            const items = getStore<InventoryItem>(INVENTORY_KEY);
            const filtered = items.filter(i => i.id !== id);
            setStore(INVENTORY_KEY, filtered);
            return true;
        } catch (error) {
            console.error('[InventoryRepository] Delete failed:', error);
            return false;
        }
    },

    /**
     * Search inventory items by name or description (case-insensitive)
     */
    async search(query: string): Promise<InventoryItem[]> {
        try {
            const items = getStore<InventoryItem>(INVENTORY_KEY);
            const q = query.toLowerCase();
            return items
                .filter(item =>
                    item.name.toLowerCase().includes(q) ||
                    (item.description && item.description.toLowerCase().includes(q))
                )
                .sort((a, b) => a.name.localeCompare(b.name));
        } catch (error) {
            console.error('[InventoryRepository] Search failed:', error);
            return [];
        }
    },

    /**
     * Get total count of inventory items
     */
    async count(): Promise<number> {
        try {
            return getStore<InventoryItem>(INVENTORY_KEY).length;
        } catch (error) {
            console.error('[InventoryRepository] Count failed:', error);
            return 0;
        }
    },

    /**
     * Calculate total stock value (price * stock where isInfiniteStock is false)
     */
    async getTotalStockValue(): Promise<number> {
        try {
            const items = getStore<InventoryItem>(INVENTORY_KEY);
            return items.reduce((total, item) => {
                if (!item.isInfiniteStock) {
                    return total + (item.price || 0) * (item.stock || 0);
                }
                return total;
            }, 0);
        } catch (error) {
            console.error('[InventoryRepository] GetTotalStockValue failed:', error);
            return 0;
        }
    },

    /**
     * Delete all inventory items
     */
    async deleteAll(): Promise<boolean> {
        try {
            setStore(INVENTORY_KEY, []);
            return true;
        } catch (error) {
            console.error('[InventoryRepository] DeleteAll failed:', error);
            return false;
        }
    }
};

export default inventoryRepository;

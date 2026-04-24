/**
 * Customer Repository
 * CRUD operations for customers using localStorage
 */

import { Customer } from '../types';

const CUSTOMERS_KEY = 'app_customers';

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

export const customerRepository = {
    /**
     * Get all customers, sorted by name ASC
     */
    async getAll(): Promise<Customer[]> {
        try {
            const customers = getStore<Customer>(CUSTOMERS_KEY);
            return customers.sort((a, b) => a.name.localeCompare(b.name));
        } catch (error) {
            console.error('[CustomerRepository] GetAll failed:', error);
            return [];
        }
    },

    /**
     * Get customer by ID
     */
    async getById(id: string): Promise<Customer | null> {
        try {
            const customers = getStore<Customer>(CUSTOMERS_KEY);
            return customers.find(c => c.id === id) || null;
        } catch (error) {
            console.error('[CustomerRepository] GetById failed:', error);
            return null;
        }
    },

    /**
     * Create a new customer
     */
    async create(customer: Omit<Customer, 'createdAt' | 'updatedAt'>): Promise<boolean> {
        try {
            const customers = getStore<Customer>(CUSTOMERS_KEY);
            const now = new Date().toISOString();
            const newCustomer: Customer = {
                ...customer,
                createdAt: now,
                updatedAt: now,
            };
            customers.push(newCustomer);
            setStore(CUSTOMERS_KEY, customers);
            return true;
        } catch (error) {
            console.error('[CustomerRepository] Create failed:', error);
            return false;
        }
    },

    /**
     * Update an existing customer
     */
    async update(id: string, customer: Partial<Customer>): Promise<boolean> {
        try {
            const customers = getStore<Customer>(CUSTOMERS_KEY);
            const index = customers.findIndex(c => c.id === id);
            if (index === -1) return false;

            const now = new Date().toISOString();
            customers[index] = {
                ...customers[index],
                ...customer,
                id, // preserve original id
                updatedAt: now,
            };

            setStore(CUSTOMERS_KEY, customers);
            return true;
        } catch (error) {
            console.error('[CustomerRepository] Update failed:', error);
            return false;
        }
    },

    /**
     * Save a customer (create or update)
     */
    async save(customer: Omit<Customer, 'createdAt' | 'updatedAt'>): Promise<boolean> {
        const existing = await this.getById(customer.id);
        if (existing) {
            return this.update(customer.id, customer);
        }
        return this.create(customer);
    },

    /**
     * Delete a customer
     */
    async delete(id: string): Promise<boolean> {
        try {
            const customers = getStore<Customer>(CUSTOMERS_KEY);
            const filtered = customers.filter(c => c.id !== id);
            setStore(CUSTOMERS_KEY, filtered);
            return true;
        } catch (error) {
            console.error('[CustomerRepository] Delete failed:', error);
            return false;
        }
    },

    /**
     * Search customers by name, email, or phone (case-insensitive)
     */
    async search(query: string): Promise<Customer[]> {
        try {
            const customers = getStore<Customer>(CUSTOMERS_KEY);
            const q = query.toLowerCase();
            return customers
                .filter(c =>
                    c.name.toLowerCase().includes(q) ||
                    (c.email && c.email.toLowerCase().includes(q)) ||
                    (c.phone && c.phone.toLowerCase().includes(q))
                )
                .sort((a, b) => a.name.localeCompare(b.name));
        } catch (error) {
            console.error('[CustomerRepository] Search failed:', error);
            return [];
        }
    },

    /**
     * Get total count of customers
     */
    async count(): Promise<number> {
        try {
            return getStore<Customer>(CUSTOMERS_KEY).length;
        } catch (error) {
            console.error('[CustomerRepository] Count failed:', error);
            return 0;
        }
    },

    /**
     * Delete all customers
     */
    async deleteAll(): Promise<boolean> {
        try {
            setStore(CUSTOMERS_KEY, []);
            return true;
        } catch (error) {
            console.error('[CustomerRepository] DeleteAll failed:', error);
            return false;
        }
    }
};

export default customerRepository;

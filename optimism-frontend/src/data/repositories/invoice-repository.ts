/**
 * Invoice Repository
 * CRUD operations for invoices and user templates using localStorage
 */

import { SavedInvoice, UserTemplate } from '../types';

const INVOICES_KEY = 'app_invoices';
const TEMPLATES_KEY = 'app_user_templates';
const MAX_INVOICES = 8;

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

export const invoiceRepository = {
    // ==================== INVOICE METHODS ====================

    /**
     * Get all saved invoices, sorted by modifiedAt DESC
     */
    async getAllInvoices(): Promise<SavedInvoice[]> {
        try {
            const invoices = getStore<SavedInvoice>(INVOICES_KEY);
            return invoices.sort((a, b) =>
                new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
            );
        } catch (error) {
            console.error('[InvoiceRepository] GetAll failed:', error);
            return [];
        }
    },

    /**
     * Get invoice by ID
     */
    async getInvoiceById(id: string): Promise<SavedInvoice | null> {
        try {
            const invoices = getStore<SavedInvoice>(INVOICES_KEY);
            return invoices.find(inv => inv.id === id) || null;
        } catch (error) {
            console.error('[InvoiceRepository] GetById failed:', error);
            return null;
        }
    },

    /**
     * Check if an invoice exists
     */
    async invoiceExists(id: string): Promise<boolean> {
        try {
            const invoices = getStore<SavedInvoice>(INVOICES_KEY);
            return invoices.some(inv => inv.id === id);
        } catch (error) {
            console.error('[InvoiceRepository] InvoiceExists failed:', error);
            return false;
        }
    },

    /**
     * Create a new invoice (enforces 8-invoice limit)
     */
    async createInvoice(invoice: Omit<SavedInvoice, 'createdAt' | 'modifiedAt'>): Promise<boolean> {
        try {
            const invoices = getStore<SavedInvoice>(INVOICES_KEY);

            if (invoices.length >= MAX_INVOICES) {
                throw new Error('Invoice limit reached (max 8). Delete an existing invoice to save a new one.');
            }

            const now = new Date().toISOString();
            const newInvoice: SavedInvoice = {
                ...invoice,
                createdAt: now,
                modifiedAt: now,
            };

            invoices.push(newInvoice);
            setStore(INVOICES_KEY, invoices);
            return true;
        } catch (error) {
            console.error('[InvoiceRepository] Create failed:', error);
            if (error instanceof Error && error.message.includes('Invoice limit reached')) {
                throw error;
            }
            return false;
        }
    },

    /**
     * Update an existing invoice
     */
    async updateInvoice(id: string, invoice: Partial<SavedInvoice>): Promise<boolean> {
        try {
            const invoices = getStore<SavedInvoice>(INVOICES_KEY);
            const index = invoices.findIndex(inv => inv.id === id);
            if (index === -1) return false;

            const now = new Date().toISOString();
            invoices[index] = {
                ...invoices[index],
                ...invoice,
                id, // preserve original id
                modifiedAt: now,
            };

            setStore(INVOICES_KEY, invoices);
            return true;
        } catch (error) {
            console.error('[InvoiceRepository] Update failed:', error);
            return false;
        }
    },

    /**
     * Save an invoice (create or update)
     */
    async saveInvoice(invoice: Omit<SavedInvoice, 'createdAt' | 'modifiedAt'> & { id?: string }): Promise<boolean> {
        const id = invoice.id || Date.now().toString();
        const invoiceWithId = { ...invoice, id };

        const existing = await this.getInvoiceById(id);
        if (existing) {
            return this.updateInvoice(id, invoiceWithId);
        }
        return this.createInvoice(invoiceWithId);
    },

    /**
     * Delete an invoice
     */
    async deleteInvoice(id: string): Promise<boolean> {
        try {
            const invoices = getStore<SavedInvoice>(INVOICES_KEY);
            const filtered = invoices.filter(inv => inv.id !== id);
            setStore(INVOICES_KEY, filtered);
            return true;
        } catch (error) {
            console.error('[InvoiceRepository] Delete failed:', error);
            return false;
        }
    },

    /**
     * Rename an invoice
     */
    async renameInvoice(id: string, newName: string): Promise<boolean> {
        try {
            const invoices = getStore<SavedInvoice>(INVOICES_KEY);
            const index = invoices.findIndex(inv => inv.id === id);
            if (index === -1) return false;

            const now = new Date().toISOString();
            invoices[index] = {
                ...invoices[index],
                name: newName,
                modifiedAt: now,
            };

            setStore(INVOICES_KEY, invoices);
            return true;
        } catch (error) {
            console.error('[InvoiceRepository] Rename failed:', error);
            return false;
        }
    },

    /**
     * Get total count of invoices
     */
    async countInvoices(): Promise<number> {
        try {
            return getStore<SavedInvoice>(INVOICES_KEY).length;
        } catch (error) {
            console.error('[InvoiceRepository] Count failed:', error);
            return 0;
        }
    },

    /**
     * Delete all invoices
     */
    async deleteAllInvoices(): Promise<boolean> {
        try {
            setStore(INVOICES_KEY, []);
            return true;
        } catch (error) {
            console.error('[InvoiceRepository] DeleteAll failed:', error);
            return false;
        }
    },

    // ==================== USER TEMPLATE METHODS ====================

    /**
     * Get all user templates
     */
    async getAllUserTemplates(): Promise<UserTemplate[]> {
        try {
            return getStore<UserTemplate>(TEMPLATES_KEY);
        } catch (error) {
            console.error('[InvoiceRepository] GetAll user templates failed:', error);
            return [];
        }
    },

    /**
     * Get user template by ID
     */
    async getUserTemplateById(id: string): Promise<UserTemplate | null> {
        try {
            const templates = getStore<UserTemplate>(TEMPLATES_KEY);
            return templates.find(t => t.id === id) || null;
        } catch (error) {
            console.error('[InvoiceRepository] GetById user template failed:', error);
            return null;
        }
    },

    /**
     * Create a new user template
     */
    async createUserTemplate(template: UserTemplate): Promise<boolean> {
        try {
            const templates = getStore<UserTemplate>(TEMPLATES_KEY);
            const newTemplate: UserTemplate = {
                ...template,
                importedAt: template.importedAt || new Date().toISOString(),
            };
            templates.push(newTemplate);
            setStore(TEMPLATES_KEY, templates);
            return true;
        } catch (error) {
            console.error('[InvoiceRepository] Create user template failed:', error);
            return false;
        }
    },

    /**
     * Delete a user template
     */
    async deleteUserTemplate(id: string): Promise<boolean> {
        try {
            const templates = getStore<UserTemplate>(TEMPLATES_KEY);
            const filtered = templates.filter(t => t.id !== id);
            setStore(TEMPLATES_KEY, filtered);
            return true;
        } catch (error) {
            console.error('[InvoiceRepository] Delete user template failed:', error);
            return false;
        }
    },

    /**
     * Update user template metadata
     */
    async updateUserTemplateMeta(id: string, updates: { selectedColor?: string }): Promise<boolean> {
        try {
            const templates = getStore<UserTemplate>(TEMPLATES_KEY);
            const index = templates.findIndex(t => t.id === id);
            if (index === -1) return false;

            templates[index] = {
                ...templates[index],
                selectedColor: updates.selectedColor ?? templates[index].selectedColor,
            };

            setStore(TEMPLATES_KEY, templates);
            return true;
        } catch (error) {
            console.error('[InvoiceRepository] Update user template meta failed:', error);
            return false;
        }
    },

    /**
     * Get total count of user templates
     */
    async countUserTemplates(): Promise<number> {
        try {
            return getStore<UserTemplate>(TEMPLATES_KEY).length;
        } catch (error) {
            console.error('[InvoiceRepository] Count user templates failed:', error);
            return 0;
        }
    },

    /**
     * Delete all user templates
     */
    async deleteAllUserTemplates(): Promise<boolean> {
        try {
            setStore(TEMPLATES_KEY, []);
            return true;
        } catch (error) {
            console.error('[InvoiceRepository] DeleteAll user templates failed:', error);
            return false;
        }
    }
};

export default invoiceRepository;

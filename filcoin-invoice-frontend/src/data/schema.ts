/**
 * Database Schema
 * Constants only — no SQL (localStorage backend)
 */

export const SCHEMA_VERSION = 1;

export const TABLE_NAMES = {
    INVOICES: 'invoices',
    USER_TEMPLATES: 'user_templates',
    CUSTOMERS: 'customers',
    INVENTORY_ITEMS: 'inventory_items',
    BUSINESS_ADDRESSES: 'business_addresses',
    SIGNATURES: 'signatures',
    LOGOS: 'logos',
};

export const CREATE_TABLES_SQL = '';

export const MIGRATIONS: any[] = [];

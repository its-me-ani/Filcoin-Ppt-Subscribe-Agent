/**
 * Business Info Repository
 * CRUD operations for business addresses, signatures, and logos using localStorage
 */

import { BusinessAddress, Signature, Logo } from '../types';

const ADDRESSES_KEY = 'app_business_addresses';
const SIGNATURES_KEY = 'app_signatures';
const LOGOS_KEY = 'app_logos';

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

export const businessInfoRepository = {
    // ==================== ADDRESS METHODS ====================

    /**
     * Get all business addresses, sorted by createdAt DESC
     */
    async getAllAddresses(): Promise<BusinessAddress[]> {
        try {
            const addresses = getStore<BusinessAddress>(ADDRESSES_KEY);
            return addresses.sort((a, b) =>
                new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
            );
        } catch (error) {
            console.error('[BusinessInfoRepository] GetAll addresses failed:', error);
            return [];
        }
    },

    /**
     * Get address by ID
     */
    async getAddressById(id: string): Promise<BusinessAddress | null> {
        try {
            const addresses = getStore<BusinessAddress>(ADDRESSES_KEY);
            return addresses.find(a => a.id === id) || null;
        } catch (error) {
            console.error('[BusinessInfoRepository] GetById address failed:', error);
            return null;
        }
    },

    /**
     * Create a new address
     */
    async createAddress(address: Omit<BusinessAddress, 'createdAt'>): Promise<boolean> {
        try {
            const addresses = getStore<BusinessAddress>(ADDRESSES_KEY);
            const now = new Date().toISOString();
            const newAddress: BusinessAddress = {
                ...address,
                createdAt: now,
            };
            addresses.push(newAddress);
            setStore(ADDRESSES_KEY, addresses);
            return true;
        } catch (error) {
            console.error('[BusinessInfoRepository] Create address failed:', error);
            return false;
        }
    },

    /**
     * Update an address
     */
    async updateAddress(id: string, address: Partial<BusinessAddress>): Promise<boolean> {
        try {
            const addresses = getStore<BusinessAddress>(ADDRESSES_KEY);
            const index = addresses.findIndex(a => a.id === id);
            if (index === -1) return false;

            addresses[index] = {
                ...addresses[index],
                ...address,
                id, // preserve original id
            };

            setStore(ADDRESSES_KEY, addresses);
            return true;
        } catch (error) {
            console.error('[BusinessInfoRepository] Update address failed:', error);
            return false;
        }
    },

    /**
     * Save an address (create or update)
     */
    async saveAddress(address: Omit<BusinessAddress, 'createdAt'>): Promise<boolean> {
        const existing = await this.getAddressById(address.id);
        if (existing) {
            return this.updateAddress(address.id, address);
        }
        return this.createAddress(address);
    },

    /**
     * Delete an address
     */
    async deleteAddress(id: string): Promise<boolean> {
        try {
            const addresses = getStore<BusinessAddress>(ADDRESSES_KEY);
            const filtered = addresses.filter(a => a.id !== id);
            setStore(ADDRESSES_KEY, filtered);
            return true;
        } catch (error) {
            console.error('[BusinessInfoRepository] Delete address failed:', error);
            return false;
        }
    },

    /**
     * Get address count
     */
    async getAddressCount(): Promise<number> {
        try {
            return getStore<BusinessAddress>(ADDRESSES_KEY).length;
        } catch (error) {
            console.error('[BusinessInfoRepository] Address count failed:', error);
            return 0;
        }
    },

    // ==================== SIGNATURE METHODS ====================

    /**
     * Get all signatures, sorted by createdAt DESC
     */
    async getAllSignatures(): Promise<Signature[]> {
        try {
            const signatures = getStore<Signature>(SIGNATURES_KEY);
            return signatures.sort((a, b) =>
                new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
            );
        } catch (error) {
            console.error('[BusinessInfoRepository] GetAll signatures failed:', error);
            return [];
        }
    },

    /**
     * Get selected signature
     */
    async getSelectedSignature(): Promise<Signature | null> {
        try {
            const signatures = getStore<Signature>(SIGNATURES_KEY);
            return signatures.find(s => s.isSelected) || null;
        } catch (error) {
            console.error('[BusinessInfoRepository] GetSelected signature failed:', error);
            return null;
        }
    },

    /**
     * Get selected signature ID
     */
    async getSelectedSignatureId(): Promise<string | null> {
        const sig = await this.getSelectedSignature();
        return sig?.id || null;
    },

    /**
     * Create a new signature
     */
    async createSignature(signature: Omit<Signature, 'createdAt'>): Promise<boolean> {
        try {
            const signatures = getStore<Signature>(SIGNATURES_KEY);
            const now = new Date().toISOString();
            const newSignature: Signature = {
                ...signature,
                createdAt: now,
            };
            signatures.push(newSignature);
            setStore(SIGNATURES_KEY, signatures);
            return true;
        } catch (error) {
            console.error('[BusinessInfoRepository] Create signature failed:', error);
            return false;
        }
    },

    /**
     * Select a signature (deselect all, then select the one with given id)
     */
    async selectSignature(id: string | null): Promise<boolean> {
        try {
            const signatures = getStore<Signature>(SIGNATURES_KEY);
            const updated = signatures.map(s => ({
                ...s,
                isSelected: id !== null && s.id === id,
            }));
            setStore(SIGNATURES_KEY, updated);
            return true;
        } catch (error) {
            console.error('[BusinessInfoRepository] Select signature failed:', error);
            return false;
        }
    },

    /**
     * Delete a signature
     */
    async deleteSignature(id: string): Promise<boolean> {
        try {
            const signatures = getStore<Signature>(SIGNATURES_KEY);
            const filtered = signatures.filter(s => s.id !== id);
            setStore(SIGNATURES_KEY, filtered);
            return true;
        } catch (error) {
            console.error('[BusinessInfoRepository] Delete signature failed:', error);
            return false;
        }
    },

    /**
     * Get signature count
     */
    async getSignatureCount(): Promise<number> {
        try {
            return getStore<Signature>(SIGNATURES_KEY).length;
        } catch (error) {
            console.error('[BusinessInfoRepository] Signature count failed:', error);
            return 0;
        }
    },

    // ==================== LOGO METHODS ====================

    /**
     * Get all logos, sorted by createdAt DESC
     */
    async getAllLogos(): Promise<Logo[]> {
        try {
            const logos = getStore<Logo>(LOGOS_KEY);
            return logos.sort((a, b) =>
                new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
            );
        } catch (error) {
            console.error('[BusinessInfoRepository] GetAll logos failed:', error);
            return [];
        }
    },

    /**
     * Get selected logo
     */
    async getSelectedLogo(): Promise<Logo | null> {
        try {
            const logos = getStore<Logo>(LOGOS_KEY);
            return logos.find(l => l.isSelected) || null;
        } catch (error) {
            console.error('[BusinessInfoRepository] GetSelected logo failed:', error);
            return null;
        }
    },

    /**
     * Get selected logo ID
     */
    async getSelectedLogoId(): Promise<string | null> {
        const logo = await this.getSelectedLogo();
        return logo?.id || null;
    },

    /**
     * Create a new logo
     */
    async createLogo(logo: Omit<Logo, 'createdAt'>): Promise<boolean> {
        try {
            const logos = getStore<Logo>(LOGOS_KEY);
            const now = new Date().toISOString();
            const newLogo: Logo = {
                ...logo,
                createdAt: now,
            };
            logos.push(newLogo);
            setStore(LOGOS_KEY, logos);
            return true;
        } catch (error) {
            console.error('[BusinessInfoRepository] Create logo failed:', error);
            return false;
        }
    },

    /**
     * Select a logo (deselect all, then select the one with given id)
     */
    async selectLogo(id: string | null): Promise<boolean> {
        try {
            const logos = getStore<Logo>(LOGOS_KEY);
            const updated = logos.map(l => ({
                ...l,
                isSelected: id !== null && l.id === id,
            }));
            setStore(LOGOS_KEY, updated);
            return true;
        } catch (error) {
            console.error('[BusinessInfoRepository] Select logo failed:', error);
            return false;
        }
    },

    /**
     * Delete a logo
     */
    async deleteLogo(id: string): Promise<boolean> {
        try {
            const logos = getStore<Logo>(LOGOS_KEY);
            const filtered = logos.filter(l => l.id !== id);
            setStore(LOGOS_KEY, filtered);
            return true;
        } catch (error) {
            console.error('[BusinessInfoRepository] Delete logo failed:', error);
            return false;
        }
    },

    /**
     * Get logo count
     */
    async getLogoCount(): Promise<number> {
        try {
            return getStore<Logo>(LOGOS_KEY).length;
        } catch (error) {
            console.error('[BusinessInfoRepository] Logo count failed:', error);
            return 0;
        }
    },

    // ==================== BULK DELETE ====================

    /**
     * Delete all addresses
     */
    async deleteAllAddresses(): Promise<boolean> {
        try {
            setStore(ADDRESSES_KEY, []);
            return true;
        } catch (error) {
            console.error('[BusinessInfoRepository] DeleteAll addresses failed:', error);
            return false;
        }
    },

    /**
     * Delete all signatures
     */
    async deleteAllSignatures(): Promise<boolean> {
        try {
            setStore(SIGNATURES_KEY, []);
            return true;
        } catch (error) {
            console.error('[BusinessInfoRepository] DeleteAll signatures failed:', error);
            return false;
        }
    },

    /**
     * Delete all logos
     */
    async deleteAllLogos(): Promise<boolean> {
        try {
            setStore(LOGOS_KEY, []);
            return true;
        } catch (error) {
            console.error('[BusinessInfoRepository] DeleteAll logos failed:', error);
            return false;
        }
    }
};

export default businessInfoRepository;

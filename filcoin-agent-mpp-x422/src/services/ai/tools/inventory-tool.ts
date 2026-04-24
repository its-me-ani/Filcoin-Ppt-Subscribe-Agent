import { inventoryRepository } from '../../../data';

export interface InventorySearchResult {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  isInfiniteStock: boolean;
}

/** Search inventory. Exported as the tool executor. */
export async function searchInventory(params: { query: string; limit?: number }): Promise<InventorySearchResult[]> {
  const { query = '', limit = 10 } = params;
  const all = await inventoryRepository.getAll();

  // Treat generic "list all" style queries as empty — return everything
  const GENERIC_TERMS = new Set(['all', 'everything', 'list', 'inventory', 'items', 'products', 'services', 'show all', 'list all']);
  const trimmed = query.trim().toLowerCase();
  if (!trimmed || GENERIC_TERMS.has(trimmed)) {
    return all.slice(0, limit).map(toResult);
  }

  // Split query into meaningful tokens (drop stop-words shorter than 2 chars)
  const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length >= 2);

  const scored = all.map(item => {
    const nameLower = item.name.toLowerCase();
    const nameWords = nameLower.split(/\s+/);
    let nameScore = 0;

    // Exact full-name match
    if (nameLower === query.toLowerCase()) nameScore += 100;

    for (const token of tokens) {
      if (nameLower === token) nameScore += 40;
      else if (nameWords.some(w => w === token)) nameScore += 30;  // exact word in name
      else if (nameWords.some(w => w.startsWith(token))) nameScore += 20; // word prefix
      else if (nameLower.includes(token)) nameScore += 10;          // substring
    }

    // Only fall back to description when name has no match at all
    let descScore = 0;
    if (nameScore === 0) {
      const descLower = (item.description || '').toLowerCase();
      for (const token of tokens) {
        if (descLower.split(/\s+/).some(w => w === token)) descScore += 5;
        else if (descLower.includes(token)) descScore += 2;
      }
    }

    return { item, score: nameScore + descScore };
  })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => toResult(item))
    .slice(0, limit);

  return scored;
}

function toResult(item: Awaited<ReturnType<typeof inventoryRepository.getAll>>[number]): InventorySearchResult {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    price: item.price,
    stock: item.stock,
    isInfiniteStock: item.isInfiniteStock,
  };
}

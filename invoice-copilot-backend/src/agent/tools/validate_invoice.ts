import type { InvoiceDraft, ValidationIssue } from '../../types.js';

export async function validateInvoice(invoice: InvoiceDraft): Promise<{
  ok: boolean;
  issues: ValidationIssue[];
  anomalies: ValidationIssue[];
}> {
  const issues: ValidationIssue[] = [];
  const anomalies: ValidationIssue[] = [];

  if (!invoice.issuer?.name) {
    issues.push({ field: 'issuer.name', severity: 'error', message: 'Issuer name missing' });
  }
  if (!invoice.payer?.name) {
    issues.push({ field: 'payer.name', severity: 'error', message: 'Payer name missing' });
  }
  if (!invoice.items?.length) {
    issues.push({ field: 'items', severity: 'error', message: 'At least one line item required' });
  }
  invoice.items?.forEach((it, i) => {
    if (!it.description) issues.push({ field: `items[${i}].description`, severity: 'error', message: 'Description missing' });
    if (it.quantity <= 0) issues.push({ field: `items[${i}].quantity`, severity: 'error', message: 'Quantity must be > 0' });
    if (it.unitPrice < 0) issues.push({ field: `items[${i}].unitPrice`, severity: 'error', message: 'Unit price cannot be negative' });
    if (it.unitPrice === 0) issues.push({ field: `items[${i}].unitPrice`, severity: 'warning', message: 'Zero-value line item', suggestion: 'Confirm this is intentional' });
  });

  // Milestone math check
  if (invoice.milestones?.length) {
    const sum = invoice.milestones.reduce((s, m) => s + m.amount, 0);
    if (invoice.total && Math.abs(sum - invoice.total) > 0.01) {
      issues.push({
        field: 'milestones',
        severity: 'error',
        message: `Milestone sum (${sum.toFixed(2)}) does not equal invoice total (${invoice.total.toFixed(2)})`,
        suggestion: 'Rebalance milestone amounts',
      });
    }
  }

  // Anomaly: unusually high line item
  const avgPrice = (invoice.items ?? []).reduce((s, i) => s + i.unitPrice, 0) / Math.max(1, invoice.items?.length ?? 1);
  invoice.items?.forEach((it, i) => {
    if (avgPrice > 0 && it.unitPrice > avgPrice * 10) {
      anomalies.push({
        field: `items[${i}]`,
        severity: 'warning',
        message: `Line item price (${it.unitPrice}) is unusually high vs. average (${avgPrice.toFixed(2)})`,
        suggestion: 'Verify unit price is correct',
      });
    }
  });

  // Anomaly: due date before issue date
  if (invoice.dueDate && invoice.issuedAt && new Date(invoice.dueDate) < new Date(invoice.issuedAt)) {
    anomalies.push({
      field: 'dueDate',
      severity: 'warning',
      message: 'Due date is before issue date',
      suggestion: 'Move due date to after issue date',
    });
  }

  const errorCount = issues.filter((x) => x.severity === 'error').length;
  return { ok: errorCount === 0, issues, anomalies };
}

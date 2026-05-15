import type { CollectionConfig } from 'payload'

export const Vendors: CollectionConfig = {
  slug: 'vendors',
  admin: { useAsTitle: 'name', defaultColumns: ['vendorNumber', 'name', 'city', 'active'] },
  fields: [
    { name: 'vendorNumber', type: 'text', required: true, unique: true },
    { name: 'name', type: 'text', required: true },
    { name: 'email', type: 'email' },
    { name: 'phone', type: 'text' },
    { name: 'addressLine1', type: 'text' },
    { name: 'addressLine2', type: 'text' },
    { name: 'city', type: 'text' },
    { name: 'province', type: 'text' },
    { name: 'postalCode', type: 'text' },
    { name: 'paymentTerms', type: 'text', defaultValue: 'Net 30' },
    { name: 'active', type: 'checkbox', defaultValue: true },
  ],
}

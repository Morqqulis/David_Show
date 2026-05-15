import type { Payload } from 'payload'

export async function seedVendors(payload: Payload) {
  const data = [
    { vendorNumber: 'V-0001', name: 'Northern Office Supplies Ltd.', email: 'ar@northernoffice.ca', city: 'Aurora', province: 'ON' },
    { vendorNumber: 'V-0002', name: 'BlueRock Construction Inc.', email: 'billing@bluerock.ca', city: 'Newmarket', province: 'ON' },
    { vendorNumber: 'V-0003', name: 'Aurora Hydro', email: 'invoices@aurorahydro.ca', city: 'Aurora', province: 'ON' },
    { vendorNumber: 'V-0004', name: 'CityFleet Vehicles', email: 'ap@cityfleet.ca', city: 'Toronto', province: 'ON' },
    { vendorNumber: 'V-0005', name: 'GreenLeaf Landscaping', email: 'greenleaf@example.ca', city: 'Vaughan', province: 'ON' },
    { vendorNumber: 'V-0006', name: 'TechBridge Solutions', email: 'finance@techbridge.io', city: 'Toronto', province: 'ON' },
    { vendorNumber: 'V-0007', name: 'PaperTrail Print Co.', email: 'billing@papertrail.ca', city: 'Markham', province: 'ON' },
    { vendorNumber: 'V-0008', name: 'Aurora Plumbing & Heating', email: 'aurora.pnh@example.ca', city: 'Aurora', province: 'ON' },
    { vendorNumber: 'V-0009', name: 'Frostline Snow Removal', email: 'ap@frostline.ca', city: 'Richmond Hill', province: 'ON' },
    { vendorNumber: 'V-0010', name: 'Metro Legal Services LLP', email: 'billing@metrolegal.ca', city: 'Toronto', province: 'ON' },
    { vendorNumber: 'V-0011', name: 'BookSource Library Suppliers', email: 'ar@booksource.ca', city: 'Mississauga', province: 'ON' },
    { vendorNumber: 'V-0012', name: 'Apex Safety Equipment', email: 'ap@apexsafety.ca', city: 'Brampton', province: 'ON' },
    { vendorNumber: 'V-0013', name: 'Pinewood IT Services', email: 'billing@pinewoodit.ca', city: 'Aurora', province: 'ON' },
    { vendorNumber: 'V-0014', name: 'CertaCloud Hosting', email: 'finance@certacloud.io', city: 'Toronto', province: 'ON' },
    { vendorNumber: 'V-0015', name: 'Pacific Janitorial', email: 'ar@pacjan.ca', city: 'North York', province: 'ON' },
  ]
  return Promise.all(data.map((v) => payload.create({ collection: 'vendors', data: v })))
}

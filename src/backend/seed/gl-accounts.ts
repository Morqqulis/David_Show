import type { Payload } from 'payload'

/**
 * Demo chart of accounts, in the shape the GL account format describes:
 * `XX-XXXX-XXXX-XXXX` — Fund, Function, Sub-department, Object.
 *
 * The third part is the sub-department, and it is what the department map in
 * Settings → Coding Restrictions matches on. The sub-department numbers here
 * deliberately exercise every case the map has to handle: plain ranges, a
 * department holding ranges that are nowhere near each other (Fire), a single
 * value carved out of somebody else's range (1350, Museum Programs, sitting
 * inside Parks & Rec but run by the Library), and sub-departments nobody has
 * mapped yet (2100 Utilities, 2600 Cemetery) so the "not mapped yet" list on
 * that screen is not empty out of the box.
 */
export async function seedGLAccounts(payload: Payload) {
  const accts = [
    { code: '01-1100-1100-5210', description: 'Public Works — Materials & Supplies' },
    { code: '01-1100-1100-5410', description: 'Public Works — Equipment Maintenance' },
    { code: '01-1100-1100-5610', description: 'Public Works — Snow Removal Services' },
    { code: '01-1200-1200-5110', description: 'IT — Software Licenses' },
    { code: '01-1200-1200-5120', description: 'IT — Cloud Services' },
    { code: '01-1200-1200-5310', description: 'IT — Hardware' },
    { code: '01-1300-1300-5210', description: 'Parks & Rec — Materials' },
    { code: '01-1300-1300-5510', description: 'Parks & Rec — Contracted Services' },
    { code: '01-1300-1350-5520', description: 'Museum Programs — Exhibits' },
    { code: '01-1400-1400-5410', description: 'Library — Books & Media' },
    { code: '01-1400-1400-5210', description: 'Library — Supplies' },
    { code: '01-1500-1500-5210', description: 'Fire — Safety Equipment' },
    { code: '01-1500-1500-5310', description: 'Fire — Vehicle Maintenance' },
    { code: '01-1500-1550-5220', description: 'Fire — Volunteer Program Supplies' },
    { code: '01-1500-4010-5210', description: 'Fire — Station 2 Operations' },
    { code: '01-1900-1900-5110', description: 'Administration — Legal Fees' },
    { code: '01-1900-1900-5210', description: 'Administration — Office Supplies' },
    { code: '01-1600-2600-5210', description: 'Cemetery Operations — Supplies' },
    { code: '02-2100-2100-5710', description: 'Utilities — Hydro' },
    { code: '02-2100-2100-5720', description: 'Utilities — Water' },
    { code: '03-3100-3100-5910', description: 'Capital — Vehicles' },
    { code: '03-3100-3100-5920', description: 'Capital — Equipment' },
    { code: '05-9100-9100-2010', description: 'AP Control Account' },
    { code: '05-9100-9100-1450', description: 'HST Recoverable (PSB)' },
  ]
  return Promise.all(
    accts.map((a) => payload.create({ collection: 'gl-accounts', data: a as never })),
  )
}

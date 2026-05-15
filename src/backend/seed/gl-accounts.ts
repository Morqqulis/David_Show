import type { Payload } from 'payload'

export async function seedGLAccounts(payload: Payload) {
  const accts = [
    { code: '01-1100-PW-5210', description: 'Public Works — Materials & Supplies' },
    { code: '01-1100-PW-5410', description: 'Public Works — Equipment Maintenance' },
    { code: '01-1100-PW-5610', description: 'Public Works — Snow Removal Services' },
    { code: '01-1200-IT-5110', description: 'IT — Software Licenses' },
    { code: '01-1200-IT-5120', description: 'IT — Cloud Services' },
    { code: '01-1200-IT-5310', description: 'IT — Hardware' },
    { code: '01-1300-PR-5210', description: 'Parks & Rec — Materials' },
    { code: '01-1300-PR-5510', description: 'Parks & Rec — Contracted Services' },
    { code: '01-1400-LIB-5410', description: 'Library — Books & Media' },
    { code: '01-1400-LIB-5210', description: 'Library — Supplies' },
    { code: '01-1500-FIRE-5210', description: 'Fire — Safety Equipment' },
    { code: '01-1500-FIRE-5310', description: 'Fire — Vehicle Maintenance' },
    { code: '01-1900-ADM-5110', description: 'Administration — Legal Fees' },
    { code: '01-1900-ADM-5210', description: 'Administration — Office Supplies' },
    { code: '02-2100-UTIL-5710', description: 'Utilities — Hydro' },
    { code: '02-2100-UTIL-5720', description: 'Utilities — Water' },
    { code: '03-3100-CAPEX-5910', description: 'Capital — Vehicles' },
    { code: '03-3100-CAPEX-5920', description: 'Capital — Equipment' },
    { code: '05-9100-CTRL-2010', description: 'AP Control Account' },
    { code: '05-9100-CTRL-1450', description: 'HST Recoverable (PSB)' },
  ]
  return Promise.all(
    accts.map((a) =>
      payload.create({
        collection: 'gl-accounts',
        data: {
          ...a,
          segments: a.code.split('-').map((value) => ({ value })),
        } as never,
      }),
    ),
  )
}

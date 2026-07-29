import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getPayload } from '@/backend/lib/payload'
import { loadGlMappingConfig } from '@/backend/lib/gl-department-routing'
import { departmentSegmentOf } from '@/backend/lib/segments'
import { GlFormatForm, type GlFormatValue } from '@/components/app/settings/gl-format-form'
import {
  DepartmentSegmentMap,
  type SegmentMapRowView,
  type SubDepartmentUsage,
} from '@/components/app/settings/department-segment-map'

export const dynamic = 'force-dynamic'

const DEFAULT_FORMAT: GlFormatValue = {
  mask: 'XX-XXX-XXXX-XXXXX',
  labels: ['Fund', 'Function', 'Sub-department', 'Object'],
  departmentSegment: 3,
  catchAllDepartment: '',
}

type FormatDoc = {
  mask?: string
  segmentLabels?: Array<{ label: string }>
  departmentSegment?: number
  catchAllDepartment?: { id: string | number } | string | number | null
}

type MapDoc = {
  id: string | number
  department?: { id: string | number; name?: string } | string | number | null
  fromValue?: string
  toValue?: string | null
  note?: string | null
}

export default async function CodingRestrictionsPage() {
  const payload = await getPayload()

  let config: Awaited<ReturnType<typeof loadGlMappingConfig>>
  let formatDoc: FormatDoc | undefined
  let mapDocs: MapDoc[] = []
  let departments: Array<{ id: string | number; name: string }> = []
  let glCodes: string[] = []
  try {
    const [loaded, formatRes, mapRes, deptRes, glRes] = await Promise.all([
      loadGlMappingConfig(),
      payload.find({ collection: 'gl-format' as never, limit: 1, depth: 1 }),
      payload.find({ collection: 'department-segment-map' as never, limit: 1000, depth: 1 }),
      payload.find({ collection: 'departments', limit: 200, depth: 0, sort: 'name' }),
      payload.find({ collection: 'gl-accounts', limit: 1000, depth: 0, sort: 'code' }),
    ])
    config = loaded
    formatDoc = formatRes.docs[0] as FormatDoc | undefined
    mapDocs = mapRes.docs as MapDoc[]
    departments = deptRes.docs as Array<{ id: string | number; name: string }>
    glCodes = (glRes.docs as Array<{ code: string }>).map((g) => g.code)
  } catch (err) {
    console.error('[gl-mapping] could not load the coding restriction settings', {
      message: (err as Error).message,
    })
    return (
      <Card>
        <CardHeader>
          <CardTitle>Coding Restrictions</CardTitle>
          <CardDescription>
            These settings could not be loaded right now. Try again in a moment; if it keeps
            happening, contact your administrator.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const catchAllId =
    typeof formatDoc?.catchAllDepartment === 'object' && formatDoc.catchAllDepartment
      ? formatDoc.catchAllDepartment.id
      : (formatDoc?.catchAllDepartment ?? '')

  const format: GlFormatValue = formatDoc?.mask
    ? {
        mask: formatDoc.mask,
        labels: (formatDoc.segmentLabels ?? []).map((s) => s.label),
        departmentSegment: formatDoc.departmentSegment ?? 1,
        catchAllDepartment: catchAllId === '' ? '' : String(catchAllId),
      }
    : DEFAULT_FORMAT

  const rows: SegmentMapRowView[] = mapDocs.map((doc) => {
    const department = typeof doc.department === 'object' ? doc.department : null
    return {
      id: doc.id,
      department: String(department?.id ?? doc.department ?? ''),
      departmentName: department?.name ?? '',
      fromValue: doc.fromValue ?? '',
      toValue: doc.toValue ?? '',
      note: doc.note ?? '',
    }
  })

  // Which sub-departments the chart of accounts actually uses, and how many
  // accounts sit on each. Derived from the GL master every time this page
  // loads — never stored, so it cannot drift.
  const usage: SubDepartmentUsage[] = []
  const misfits: string[] = []
  if (config.mask) {
    const counts = new Map<string, number>()
    for (const code of glCodes) {
      const segment = departmentSegmentOf(code, config.mask)
      if (segment === null) {
        misfits.push(code)
        continue
      }
      counts.set(segment, (counts.get(segment) ?? 0) + 1)
    }
    for (const [value, glCount] of counts) usage.push({ value, glCount })
  }

  const catchAllName =
    departments.find((d) => String(d.id) === format.catchAllDepartment)?.name ?? null

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>GL account format</CardTitle>
          <CardDescription>
            What a GL account code looks like here, and which part of it names the sub-department.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {config.maskError ? (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              The saved format is not usable, so no coding restrictions are being applied:{' '}
              {config.maskError}
            </div>
          ) : null}
          <GlFormatForm value={format} departments={departments} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Who codes which sub-departments</CardTitle>
          <CardDescription>
            A coder can pick a GL account only when its sub-department belongs to their own
            department. Roles with Bypass Coding Restrictions see every account. Coding a line to
            another department&apos;s account brings that department&apos;s reviewer onto the
            invoice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DepartmentSegmentMap
            rows={rows}
            departments={departments}
            usage={usage}
            catchAllDepartmentName={catchAllName}
          />
        </CardContent>
      </Card>

      {misfits.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Accounts that do not match the format</CardTitle>
            <CardDescription>
              These GL accounts cannot be matched to a sub-department, so nobody can code to them
              except roles that bypass coding restrictions. Correct the code or the format above.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 font-mono text-xs">
              {misfits.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

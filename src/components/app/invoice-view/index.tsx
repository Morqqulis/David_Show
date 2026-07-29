'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { softDeleteInvoice } from '@/backend/actions/invoice'
import type { StageId } from '@/backend/lib/stage-ids'
import {
  useApproveInvoice,
  useRejectInvoice,
  useVerifyInvoice,
  useSetConfidential,
  useInvoice,
  queryKeys,
} from '@/hooks/use-ap-queries'

import { InvoiceHeaderBar } from './header-bar'
import { InvoiceWorkflowStepper } from './stepper'
import { InvoicePreviewPane } from './preview-pane'
import { InvoiceActionBar } from './action-bar'
import { HeaderTab } from './tabs/header-tab'
import { FilesTab } from './tabs/files-tab'
import { NotesTab } from './tabs/notes-tab'
import { LogTab } from './tabs/log-tab'
import type { InvoiceViewData } from './types'

type InvoiceTab = 'header' | 'files' | 'notes' | 'log'

export type { InvoiceViewData } from './types'

export function InvoiceView({ data }: { data: InvoiceViewData }) {
  const router = useRouter()
  const qc = useQueryClient()

  // SSR data seeds TanStack as initialData — TanStack won't refetch until
  // staleTime expires (10s) or a mutation invalidates the query. Without
  // initialData, mounting this view duplicated the SSR fetch (3s wasted).
  const { data: live } = useInvoice(data.invoice.id, { enabled: true, initialData: data })
  const inv = (live?.invoice ?? data.invoice) as InvoiceViewData['invoice']
  const comments = (live?.comments ?? data.comments) as InvoiceViewData['comments']
  const audit = (live?.audit ?? data.audit) as InvoiceViewData['audit']
  const docs = ((live?.documents ?? data.documents) as InvoiceViewData['documents']) ?? []

  const [previewCollapsed, setPreviewCollapsed] = useState(false)
  const [activeDocId, setActiveDocId] = useState<string>(docs[0] ? String(docs[0].id) : '')
  const activeDoc = docs.find((d) => String(d.id) === activeDocId) ?? docs[0]
  const initialTab: InvoiceTab =
    data.defaultTab === 'files' || data.defaultTab === 'notes' || data.defaultTab === 'log'
      ? data.defaultTab
      : 'header'
  const [tab, setTab] = useState<InvoiceTab>(initialTab)
  const [isPending, startTransition] = useTransition()

  // Coding lives on a dedicated screen (/coding) because it has a different
  // layout (preview-left/editor-right with more horizontal room) and a fully
  // editable line table. Clicking the Coding tab here navigates rather than
  // swapping content — that keeps the Coding tab feeling like a normal tab
  // but routes the user to the actual editor.
  const handleTabChange = (next: string): void => {
    if (next === 'coding') {
      router.push(`/requests/${inv.id}/coding`)
      return
    }
    if (next === 'header' || next === 'files' || next === 'notes' || next === 'log') {
      setTab(next)
    }
  }

  const approve = useApproveInvoice()
  const reject = useRejectInvoice()
  const verify = useVerifyInvoice()
  const confidential = useSetConfidential()

  const currentStage = (inv.currentStage?.systemId ?? 'to_be_assigned') as StageId

  const onApprove = (options?: { acknowledgedWarning?: boolean }) =>
    approve.mutate({ id: inv.id, currentStage, acknowledgedWarning: options?.acknowledgedWarning })
  const onReject = (target: StageId, reasonId: string | null, otherText: string) =>
    reject.mutate({ id: inv.id, target, reasonId, otherText })
  const onVerify = (v: boolean) => verify.mutate({ id: inv.id, value: v })
  const onToggleConfidential = () => confidential.mutate({ id: inv.id, value: !inv.confidential })

  // The reason used to come from a raw browser prompt box, which looks like a
  // broken page to a finance clerk. The action bar now collects it from the
  // admin-managed Cancel list and hands the choice down here.
  const onSoftDelete = (reasonId: string | null, otherText: string) => {
    startTransition(async () => {
      try {
        await softDeleteInvoice(inv.id, reasonId, otherText)
      } catch (err) {
        console.error('[invoice-view] moving the invoice to Trash failed', { id: inv.id, err })
        toast.error((err as Error).message || 'The invoice could not be moved to Trash.')
        return
      }
      toast.success('Invoice moved to Trash')
      // Sidebar/topbar counts and the /requests list both read from TanStack
      // caches with staleTime: Infinity — drop them so the deleted invoice
      // disappears from counts and the list on navigation.
      await qc.invalidateQueries({ queryKey: queryKeys.queueCounts })
      await qc.invalidateQueries({ queryKey: queryKeys.invoice(inv.id) })
      router.push('/requests')
    })
  }

  const isMutating =
    approve.isPending || reject.isPending || verify.isPending || confidential.isPending || isPending

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden">
      <InvoiceHeaderBar inv={inv} />
      <InvoiceWorkflowStepper currentStage={currentStage} />

      <div
        className={cn(
          'grid flex-1 gap-3 overflow-hidden',
          previewCollapsed ? 'grid-cols-[44px_1fr]' : 'grid-cols-[1.4fr_1fr]',
        )}
      >
        <section className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
          <InvoicePreviewPane
            collapsed={previewCollapsed}
            setCollapsed={setPreviewCollapsed}
            activeDoc={activeDoc}
            invoiceNumber={inv.invoiceNumber}
          />
        </section>

        <section className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
          <Tabs
            value={tab}
            onValueChange={handleTabChange}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <TabsList className="m-2 mb-0 grid w-fit grid-cols-5">
              <TabsTrigger value="header">Header</TabsTrigger>
              <TabsTrigger value="coding">Coding</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="log">Log</TabsTrigger>
            </TabsList>
            <div className="flex-1 overflow-y-auto p-4">
              <TabsContent value="header" className="m-0">
                <HeaderTab inv={inv} />
              </TabsContent>
              <TabsContent value="files" className="m-0">
                <FilesTab
                  invoiceId={inv.id}
                  documents={docs}
                  activeDocId={activeDocId}
                  setActiveDocId={setActiveDocId}
                />
              </TabsContent>
              <TabsContent value="notes" className="m-0">
                <NotesTab invoiceId={inv.id} comments={comments} />
              </TabsContent>
              <TabsContent value="log" className="m-0">
                <LogTab events={audit} />
              </TabsContent>
            </div>
          </Tabs>
        </section>
      </div>

      <InvoiceActionBar
        invoiceId={inv.id}
        currentStage={currentStage}
        verified={!!inv.verified}
        confidential={!!inv.confidential}
        isMutating={isMutating}
        onApprove={onApprove}
        onReject={onReject}
        onVerify={onVerify}
        onToggleConfidential={onToggleConfidential}
        onSoftDelete={onSoftDelete}
      />
    </div>
  )
}

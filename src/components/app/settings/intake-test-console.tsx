'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { FileUp, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { runIntakeCheck, type IntakeTestReport } from '@/backend/actions/intake-test-actions'
import {
  createDefaultReadings,
  ManualReadingForm,
  type TypedReading,
} from './intake-test/manual-reading-form'
import { ReadingSteps } from './intake-test/reading-steps'
import { InvoicePreview } from './intake-test/invoice-preview'
import { SetupSummary } from './intake-test/setup-summary'

export type CheckSetup = {
  readingServiceOn: boolean
  mappingIsConfigured: boolean
  mappingRuleCount: number
  thresholdIsConfigured: boolean
  confidenceThreshold: number
  amountTolerance: number
  duplicateRuleIsConfigured: boolean
  duplicateKeyLabels: string[]
  vendorCount: number
}

// One evolving pill for this whole screen, however often it is run.
const TOAST_ID = 'intake-test-run'

export function IntakeTestConsole({ setup }: { setup: CheckSetup }) {
  const [file, setFile] = useState<File | null>(null)
  const [readings, setReadings] = useState<TypedReading[]>(createDefaultReadings)
  const [report, setReport] = useState<IntakeTestReport | null>(null)
  const [busy, setBusy] = useState<'none' | 'check' | 'create'>('none')
  const [, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function chooseFile(next: File | null) {
    setFile(next)
    // A report describes one particular file. Keeping it on screen beside a
    // different file would be a lie.
    setReport(null)
  }

  function run(commit: boolean) {
    if (!file) {
      toast.error('Choose an invoice file first.', { id: TOAST_ID })
      return
    }

    const form = new FormData()
    form.set('file', file)
    form.set('commit', commit ? '1' : '0')
    if (!setup.readingServiceOn) {
      form.set(
        'manual',
        JSON.stringify(
          readings
            .filter((r) => r.value.trim() !== '')
            .map((r) => ({ source: r.source, value: r.value, confidence: r.confidencePercent / 100 })),
        ),
      )
    }

    setBusy(commit ? 'create' : 'check')
    startTransition(async () => {
      try {
        const result = await runIntakeCheck(form)
        setReport(result)
        toast.success(
          commit
            ? `Invoice created — it is now in To Be Assigned.`
            : 'Check finished. Nothing was added to your queue.',
          { id: TOAST_ID, duration: 2500 },
        )
      } catch (err) {
        console.error('[intake-check] the run failed', {
          commit,
          fileName: file.name,
          bytes: file.size,
          contentType: file.type,
          message: err instanceof Error ? err.message : 'unknown error',
        })
        // After a failed creation the preview no longer describes reality, so
        // it is taken off screen rather than left offering the button again.
        if (commit) setReport(null)
        toast.error(
          err instanceof Error ? err.message : 'The check could not be finished. Nothing was changed.',
          { id: TOAST_ID },
        )
      } finally {
        setBusy('none')
      }
    })
  }

  return (
    <div className="space-y-6">
      <SetupSummary setup={setup} />

      <div className="space-y-2">
        <p className="text-sm font-medium">1. Choose an invoice</p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
          />
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <FileUp className="mr-1.5 h-3.5 w-3.5" />
            {file ? 'Choose a different file' : 'Choose a file'}
          </Button>
          <span className="text-sm text-muted-foreground">
            {file ? `${file.name} — ${formatSize(file.size)}` : 'No file chosen yet'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          A PDF or a photo of an invoice works best. Up to 50 MB.
        </p>
      </div>

      {setup.readingServiceOn ? null : (
        <ManualReadingForm readings={readings} onChange={setReadings} />
      )}

      <div className="flex items-center gap-3">
        <Button onClick={() => run(false)} disabled={busy !== 'none' || !file}>
          {busy === 'check' ? <Spinner className="mr-1.5 h-3.5 w-3.5" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
          Run the check
        </Button>
        <span className="text-xs text-muted-foreground">
          This only shows you what would happen. Nothing is saved.
        </span>
      </div>

      {report ? (
        <div className="space-y-6 border-t pt-6">
          <ReadingSteps report={report} />
          <InvoicePreview
            report={report}
            busy={busy === 'create'}
            disabled={busy !== 'none'}
            onCreate={() => run(true)}
          />
        </div>
      ) : null}
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

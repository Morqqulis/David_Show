import { Button } from '@/components/ui/button'

export function BulkActionsBar({ selectedCount }: { selectedCount: number }) {
  if (selectedCount === 0) return null
  return (
    <div className="flex items-center justify-between rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
      <span>
        <strong>{selectedCount}</strong> selected
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm">
          Bulk Assign
        </Button>
        <Button variant="outline" size="sm">
          Apply Batch #
        </Button>
        <Button variant="outline" size="sm">
          Approve
        </Button>
        <Button variant="outline" size="sm">
          Reassign
        </Button>
        <Button variant="outline" size="sm">
          Export
        </Button>
      </div>
    </div>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Bookmark, Check, ChevronDown, Copy, Pencil, Share2, Star, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { SavedViewRecord } from '@/backend/lib/queries'
import type { SavedViewSpec } from '@/backend/lib/invoice-filters'
import {
  createSavedView,
  deleteSavedView,
  duplicateSavedView,
  publishSavedViewToRoles,
  renameSavedView,
  setDefaultSavedView,
  updateSavedViewSpec,
} from '@/backend/actions/saved-view-actions'
import { SAVED_VIEW_LIMIT } from '@/backend/lib/invoice-filters'
import { PublishViewDialog, ViewNameDialog } from './saved-view-dialogs'

// One evolving toast for this whole surface, so a burst of edits never stacks
// a queue of stale messages.
const VIEWS_TOAST_ID = 'requests-views-save'

type DialogKind = 'save' | 'rename' | 'publish' | null

/**
 * Saved views for the All Requests screen: pick one, save the current
 * arrangement as a new one, or manage the one you are on.
 *
 * Every change shows immediately and is written to the server behind it; if
 * the server refuses, the list snaps back and says so.
 */
export function SavedViewsBar({
  views,
  roles,
  activeView,
  spec,
  isDirty,
  onViewsChange,
  onApply,
}: {
  views: SavedViewRecord[]
  roles: Array<{ id: string | number; name: string }>
  activeView: SavedViewRecord | null
  spec: SavedViewSpec
  isDirty: boolean
  onViewsChange: (next: SavedViewRecord[]) => void
  onApply: (view: SavedViewRecord | null) => void
}) {
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [, startTransition] = useTransition()

  const mine = views.filter((v) => v.editable)
  const shared = views.filter((v) => !v.editable)
  const atLimit = mine.length >= SAVED_VIEW_LIMIT

  /**
   * Apply an optimistic list, run the server action, and roll the list back
   * with an explanation if the server refuses.
   */
  function run(
    optimistic: SavedViewRecord[],
    action: () => Promise<void>,
    success: string,
    failure: string,
    context: Record<string, unknown>,
  ) {
    const previous = views
    onViewsChange(optimistic)
    startTransition(async () => {
      try {
        await action()
        toast.success(success, { id: VIEWS_TOAST_ID, duration: 1500 })
      } catch (err) {
        onViewsChange(previous)
        console.error('[requests/saved-views] action failed', { ...context, err })
        toast.error(err instanceof Error ? err.message : failure, { id: VIEWS_TOAST_ID })
      }
    })
  }

  function saveNew(name: string) {
    const tmpId = `tmp-${Date.now()}`
    const optimistic: SavedViewRecord = {
      ...spec,
      id: tmpId,
      name,
      isDefault: false,
      editable: true,
      publishedToRoles: [],
    }
    const previous = views
    onViewsChange([...views, optimistic])
    startTransition(async () => {
      try {
        const created = await createSavedView(name, spec)
        const saved = { ...optimistic, id: created.id }
        onViewsChange([...previous, saved])
        onApply(saved)
        toast.success('View saved', { id: VIEWS_TOAST_ID, duration: 1500 })
      } catch (err) {
        onViewsChange(previous)
        console.error('[requests/saved-views] save failed', { name, err })
        toast.error(err instanceof Error ? err.message : 'Could not save the view', {
          id: VIEWS_TOAST_ID,
        })
      }
    })
  }

  function duplicate(view: SavedViewRecord) {
    const previous = views
    const tmpId = `tmp-${Date.now()}`
    onViewsChange([...views, { ...view, id: tmpId, name: `${view.name} (copy)`, isDefault: false, editable: true, publishedToRoles: [] }])
    startTransition(async () => {
      try {
        const created = await duplicateSavedView(view.id)
        onViewsChange([
          ...previous,
          { ...view, id: created.id, name: `${view.name} (copy)`, isDefault: false, editable: true, publishedToRoles: [] },
        ])
        toast.success('View duplicated', { id: VIEWS_TOAST_ID, duration: 1500 })
      } catch (err) {
        onViewsChange(previous)
        console.error('[requests/saved-views] duplicate failed', { id: view.id, err })
        toast.error(err instanceof Error ? err.message : 'Could not duplicate the view', {
          id: VIEWS_TOAST_ID,
        })
      }
    })
  }

  const patch = (id: string | number, changes: Partial<SavedViewRecord>) =>
    views.map((v) => (String(v.id) === String(id) ? { ...v, ...changes } : v))

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <Bookmark className="mr-1.5 h-3.5 w-3.5" />
            {activeView ? activeView.name : 'Standard list'}
            {isDirty ? <span className="ml-1 text-muted-foreground">(edited)</span> : null}
            <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[280px]">
          <DropdownMenuLabel>My views</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onApply(null)}>
            <span className="flex-1">Standard list</span>
            {activeView === null ? <Check className="h-3.5 w-3.5" /> : null}
          </DropdownMenuItem>
          {mine.map((view) => (
            <DropdownMenuItem key={String(view.id)} onClick={() => onApply(view)}>
              <span className="flex-1 truncate">{view.name}</span>
              {view.isDefault ? <Star className="h-3.5 w-3.5 fill-current text-amber-500" /> : null}
              {activeView?.id === view.id ? <Check className="h-3.5 w-3.5" /> : null}
            </DropdownMenuItem>
          ))}
          {shared.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Shared with me</DropdownMenuLabel>
              {shared.map((view) => (
                <DropdownMenuItem key={String(view.id)} onClick={() => onApply(view)}>
                  <span className="flex-1 truncate">{view.name}</span>
                  {activeView?.id === view.id ? <Check className="h-3.5 w-3.5" /> : null}
                </DropdownMenuItem>
              ))}
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={atLimit} onClick={() => setDialog('save')}>
            <Bookmark className="mr-2 h-3.5 w-3.5" />
            {atLimit ? `Limit of ${SAVED_VIEW_LIMIT} views reached` : 'Save current arrangement…'}
          </DropdownMenuItem>
          {activeView ? (
            <>
              <DropdownMenuSeparator />
              {activeView.editable ? (
                <>
                  <DropdownMenuItem
                    disabled={!isDirty}
                    onClick={() =>
                      run(
                        patch(activeView.id, spec),
                        () => updateSavedViewSpec(activeView.id, spec),
                        'View updated',
                        'Could not update the view',
                        { id: activeView.id },
                      )
                    }
                  >
                    <Check className="mr-2 h-3.5 w-3.5" />
                    Save changes to this view
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDialog('rename')}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Rename…
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      const makeDefault = !activeView.isDefault
                      run(
                        views.map((v) => ({
                          ...v,
                          isDefault: makeDefault && String(v.id) === String(activeView.id),
                        })),
                        () => setDefaultSavedView(makeDefault ? activeView.id : null),
                        makeDefault ? 'This view now opens first' : 'This view no longer opens first',
                        'Could not change which view opens first',
                        { id: activeView.id },
                      )
                    }}
                  >
                    <Star className="mr-2 h-3.5 w-3.5" />
                    {activeView.isDefault ? 'Stop opening this first' : 'Open this view first'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDialog('publish')}>
                    <Share2 className="mr-2 h-3.5 w-3.5" />
                    Share with a role…
                  </DropdownMenuItem>
                </>
              ) : null}
              <DropdownMenuItem disabled={atLimit} onClick={() => duplicate(activeView)}>
                <Copy className="mr-2 h-3.5 w-3.5" />
                Duplicate
              </DropdownMenuItem>
              {activeView.editable ? (
                <DropdownMenuItem
                  onClick={() => {
                    if (!confirm(`Delete the view “${activeView.name}”?`)) return
                    onApply(null)
                    run(
                      views.filter((v) => String(v.id) !== String(activeView.id)),
                      () => deleteSavedView(activeView.id),
                      'View deleted',
                      'Could not delete the view',
                      { id: activeView.id },
                    )
                  }}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5 text-red-600" />
                  Delete
                </DropdownMenuItem>
              ) : null}
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ViewNameDialog
        open={dialog === 'save'}
        title="Save this arrangement"
        description="Columns, filters and sorting are stored together, along with the stage you are on."
        confirmLabel="Save view"
        initialName=""
        onOpenChange={(open) => setDialog(open ? 'save' : null)}
        onConfirm={(name) => {
          setDialog(null)
          saveNew(name)
        }}
      />
      <ViewNameDialog
        open={dialog === 'rename'}
        title="Rename view"
        description="Only the name changes; the columns and filters stay as they are."
        confirmLabel="Rename"
        initialName={activeView?.name ?? ''}
        onOpenChange={(open) => setDialog(open ? 'rename' : null)}
        onConfirm={(name) => {
          setDialog(null)
          if (!activeView) return
          run(
            patch(activeView.id, { name }),
            () => renameSavedView(activeView.id, name),
            'View renamed',
            'Could not rename the view',
            { id: activeView.id },
          )
        }}
      />
      <PublishViewDialog
        open={dialog === 'publish'}
        viewName={activeView?.name ?? ''}
        roles={roles}
        selectedRoleIds={activeView?.publishedToRoles ?? []}
        onOpenChange={(open) => setDialog(open ? 'publish' : null)}
        onConfirm={(roleIds) => {
          setDialog(null)
          if (!activeView) return
          run(
            patch(activeView.id, { publishedToRoles: roleIds }),
            () => publishSavedViewToRoles(activeView.id, roleIds),
            roleIds.length > 0 ? 'View shared' : 'Sharing turned off',
            'Could not change sharing',
            { id: activeView.id },
          )
        }}
      />
    </div>
  )
}

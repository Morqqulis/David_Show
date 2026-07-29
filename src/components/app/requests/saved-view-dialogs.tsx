'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** Ask for a view name — used both for saving a new view and for renaming one. */
export function ViewNameDialog({
  open,
  title,
  description,
  confirmLabel,
  initialName,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  initialName: string
  onOpenChange: (open: boolean) => void
  onConfirm: (name: string) => void
}) {
  const [name, setName] = useState(initialName)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setName(initialName)
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5 py-1">
          <Label htmlFor="saved-view-name">Name</Label>
          <Input
            id="saved-view-name"
            autoFocus
            value={name}
            placeholder="e.g. Parks invoices over $5,000"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) onConfirm(name.trim())
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!name.trim()} onClick={() => onConfirm(name.trim())}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Share a view with everyone holding a given role. Recipients can open it but
 * not change it, and the view keeps its original owner — nobody inherits a
 * layout they did not build.
 */
export function PublishViewDialog({
  open,
  viewName,
  roles,
  selectedRoleIds,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  viewName: string
  roles: Array<{ id: string | number; name: string }>
  selectedRoleIds: Array<string | number>
  onOpenChange: (open: boolean) => void
  onConfirm: (roleIds: Array<string | number>) => void
}) {
  const [selected, setSelected] = useState<string[]>(selectedRoleIds.map(String))

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setSelected(selectedRoleIds.map(String))
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Share “{viewName}”</DialogTitle>
          <DialogDescription>
            Everyone with a ticked role can open this view. They cannot change it, and it stays
            yours.
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto py-1">
          {roles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No roles have been set up yet.</p>
          ) : (
            roles.map((role) => {
              const id = `publish-role-${role.id}`
              const checked = selected.includes(String(role.id))
              return (
                <Label
                  key={String(role.id)}
                  htmlFor={id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-sm font-normal hover:bg-accent"
                >
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={(next) =>
                      setSelected((current) =>
                        next
                          ? [...current, String(role.id)]
                          : current.filter((r) => r !== String(role.id)),
                      )
                    }
                  />
                  <span className="flex-1 truncate">{role.name}</span>
                </Label>
              )
            })
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(selected)}>Share</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

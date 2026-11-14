import type { EditScope } from '../../domain'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'

interface ScopeDialogProps {
  title: string
  onChoose: (scope: EditScope) => void
  onCancel: () => void
}

/** Asks which events of a repeating series a change applies to. */
export function ScopeDialog({ title, onChoose, onCancel }: ScopeDialogProps) {
  return (
    <Dialog title={title} description="This event repeats. Which events should change?" onClose={onCancel}>
      <div className="mt-4 flex flex-col gap-2">
        <Button variant="primary" data-autofocus onClick={() => onChoose('occurrence')}>
          Only this event
        </Button>
        <Button onClick={() => onChoose('following')}>This and following events</Button>
        <Button onClick={() => onChoose('series')}>All events</Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Dialog>
  )
}

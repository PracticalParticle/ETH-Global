/**
 * Component for displaying router selection
 */

import { RouterSelection } from '../types/transaction'

interface RouterSelectionDisplayProps {
  selection: RouterSelection | null
  isLoading?: boolean
}

export function RouterSelectionDisplay({ 
  selection, 
  isLoading = false 
}: RouterSelectionDisplayProps) {
  if (isLoading) {
    return (
      <div className="glass-panel p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="animate-pulse h-8 w-8 rounded-full bg-zinc-300 dark:bg-zinc-600" />
          <div className="flex-1">
            <div className="h-4 bg-zinc-300 dark:bg-zinc-600 rounded w-3/4 mb-2 animate-pulse" />
            <div className="h-3 bg-zinc-300 dark:bg-zinc-600 rounded w-1/2 animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  if (!selection) {
    return (
      <div className="glass-panel p-4 rounded-xl border border-yellow-500/50">
        <p className="text-yellow-600 dark:text-yellow-400 text-sm">
          Select requirements to see router selection
        </p>
      </div>
    )
  }

  const isEIL = selection.router === 'EIL'
  const routerColor = isEIL 
    ? 'bg-blue-500/20 border-blue-500/50 text-blue-600 dark:text-blue-400'
    : 'bg-purple-500/20 border-purple-500/50 text-purple-600 dark:text-purple-400'

  return (
    <div className={`glass-panel p-4 rounded-xl border ${routerColor}`}>
      <div className="flex items-start gap-3">
        {/* Router Badge */}
        <div className={`flex-shrink-0 px-3 py-1 rounded-full font-bold text-sm ${
          isEIL ? 'bg-blue-500 text-white' : 'bg-purple-500 text-white'
        }`}>
          {selection.router}
        </div>
        
        {/* Router Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium mb-1">
            {selection.reasoning}
          </p>
          
          <div className="flex items-center gap-4 mt-2 text-xs">
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined !text-sm">attach_money</span>
              <span>{selection.estimatedCost}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined !text-sm">schedule</span>
              <span>{selection.estimatedTime}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


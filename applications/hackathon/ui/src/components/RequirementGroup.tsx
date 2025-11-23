/**
 * Reusable component for requirement groups
 */

import { useState, ReactNode } from 'react'

interface RequirementGroupProps {
  title: string
  icon: string
  color: string
  defaultExpanded?: boolean
  children: ReactNode
  activeCount?: number
}

export function RequirementGroup({
  title,
  icon,
  color,
  defaultExpanded = false,
  children,
  activeCount,
}: RequirementGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  return (
    <div className="glass-panel rounded-xl overflow-hidden border border-white/10">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setIsExpanded(!isExpanded)
          }
        }}
        className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-transparent rounded-t-xl"
        aria-expanded={isExpanded}
        aria-controls={`requirement-group-${title.toLowerCase().replace(/\s+/g, '-')}`}
        tabIndex={0}
      >
        <div className="flex items-center gap-2.5">
          <span 
            className="material-symbols-outlined !text-lg"
            style={{ color }}
          >
            {icon}
          </span>
          <h3 className="text-zinc-900 dark:text-white text-sm font-semibold">
            {title}
          </h3>
          {activeCount !== undefined && activeCount > 0 && (
            <span className="px-1.5 py-0.5 text-xs font-medium bg-primary/20 text-primary rounded-full">
              {activeCount}
            </span>
          )}
        </div>
        <span 
          className={`material-symbols-outlined !text-lg transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
        >
          expand_more
        </span>
      </button>

      {/* Content */}
      {isExpanded && (
        <div 
          id={`requirement-group-${title.toLowerCase().replace(/\s+/g, '-')}`}
          className="px-3 pb-3 space-y-2 border-t border-white/10"
          role="region"
          aria-labelledby={`requirement-group-header-${title.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {children}
        </div>
      )}
    </div>
  )
}


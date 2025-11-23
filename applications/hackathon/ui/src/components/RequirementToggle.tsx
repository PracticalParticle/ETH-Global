/**
 * Enhanced toggle component for requirements
 */

interface RequirementToggleProps {
  label: string
  description: string
  icon: string
  enabled: boolean
  onChange: (enabled: boolean) => void
  tooltip?: string
}

export function RequirementToggle({
  label,
  description,
  icon,
  enabled,
  onChange,
  tooltip,
}: RequirementToggleProps) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-white/5 transition-colors group">
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <span 
          className={`material-symbols-outlined !text-lg shrink-0 ${
            enabled 
              ? 'text-primary' 
              : 'text-zinc-400 dark:text-gray-500'
          }`}
        >
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-zinc-900 dark:text-white text-sm font-medium">
              {label}
            </span>
            {enabled && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-primary/20 text-primary rounded" aria-hidden="true">
                ON
              </span>
            )}
          </div>
          <p className="text-zinc-500 dark:text-gray-400 text-xs mt-0.5 line-clamp-1">
            {description}
          </p>
        </div>
      </div>
      
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onChange(!enabled)
          }
        }}
        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-transparent shrink-0 ${
          enabled ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-600'
        }`}
        aria-label={`Toggle ${label}. ${description}`}
        aria-pressed={enabled}
        title={tooltip}
        tabIndex={0}
      >
        <span
          className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-sm ${
            enabled ? 'translate-x-7' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}


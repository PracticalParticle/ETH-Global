/**
 * Preset template selector component
 */

import { MessageRequirements, SecurityLevel } from '../types/transaction'

export type PresetType = 'cost-optimized' | 'speed-optimized' | 'security-focused' | 'balanced' | 'custom'

interface Preset {
  id: PresetType
  label: string
  icon: string
  requirements: MessageRequirements
}

const PRESETS: Preset[] = [
  {
    id: 'cost-optimized',
    label: 'Cost Optimized',
    icon: 'savings',
    requirements: {
      requiresFastFinality: false,
      requiresGuaranteedDelivery: false,
      isCostSensitive: true,
      isMultiChain: false,
      maxDelay: BigInt(604800), // 7 days
      amount: 0n,
      requiresNativeSecurity: false,
      requiresDisputeResolution: false,
      securityLevel: SecurityLevel.LOW,
    },
  },
  {
    id: 'speed-optimized',
    label: 'Speed Optimized',
    icon: 'bolt',
    requirements: {
      requiresFastFinality: true,
      requiresGuaranteedDelivery: true,
      isCostSensitive: false,
      isMultiChain: false,
      maxDelay: BigInt(3600), // 1 hour
      amount: 0n,
      requiresNativeSecurity: false,
      requiresDisputeResolution: false,
      securityLevel: SecurityLevel.MEDIUM,
    },
  },
  {
    id: 'security-focused',
    label: 'Security Focused',
    icon: 'shield',
    requirements: {
      requiresFastFinality: false,
      requiresGuaranteedDelivery: false, // Removed - native security takes precedence, and guaranteed delivery forces LayerZero
      isCostSensitive: false,
      isMultiChain: false,
      maxDelay: BigInt(604800), // 7 days - required for native bridge
      amount: 0n,
      requiresNativeSecurity: true,
      requiresDisputeResolution: true,
      securityLevel: SecurityLevel.CRITICAL,
    },
  },
  {
    id: 'balanced',
    label: 'Balanced',
    icon: 'tune',
    requirements: {
      requiresFastFinality: false,
      requiresGuaranteedDelivery: false,
      isCostSensitive: false,
      isMultiChain: false,
      maxDelay: BigInt(604800), // 7 days - allows EIL selection if cost-sensitive is enabled later
      amount: 0n,
      requiresNativeSecurity: false,
      requiresDisputeResolution: false,
      securityLevel: SecurityLevel.MEDIUM,
    },
  },
]

interface PresetSelectorProps {
  selectedPreset: PresetType
  onSelectPreset: (preset: Preset) => void
  currentRequirements: MessageRequirements
}

export function PresetSelector({
  selectedPreset,
  onSelectPreset,
  currentRequirements,
}: PresetSelectorProps) {
  // Check if current requirements match any preset
  const getMatchingPreset = (): PresetType => {
    for (const preset of PRESETS) {
      const matches = Object.keys(preset.requirements).every((key) => {
        const k = key as keyof MessageRequirements
        return preset.requirements[k] === currentRequirements[k]
      })
      if (matches) return preset.id
    }
    return 'custom'
  }

  const activePreset = selectedPreset === 'custom' ? getMatchingPreset() : selectedPreset

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {PRESETS.map((preset) => {
          const isActive = activePreset === preset.id
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectPreset(preset)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelectPreset(preset)
                }
              }}
              className={`flex flex-col items-center gap-1.5 p-2.5 rounded-lg border-2 transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-transparent ${
                isActive
                  ? 'border-primary bg-primary/10'
                  : 'border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10'
              }`}
              aria-pressed={isActive}
              aria-label={`Select ${preset.label} preset`}
              tabIndex={0}
            >
              <span 
                className={`material-symbols-outlined !text-xl ${
                  isActive 
                    ? 'text-primary' 
                    : 'text-zinc-500 dark:text-gray-400'
                }`}
              >
                {preset.icon}
              </span>
              <span 
                className={`text-xs font-medium ${
                  isActive
                    ? 'text-primary'
                    : 'text-zinc-600 dark:text-gray-400'
                }`}
              >
                {preset.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export { PRESETS }
export type { Preset }


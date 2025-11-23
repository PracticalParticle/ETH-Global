/**
 * Professional requirements selector with grouped sections and presets
 */

import { useState, useEffect, useMemo } from 'react'
import { MessageRequirements, SecurityLevel } from '../types/transaction'
import { RequirementGroup } from './RequirementGroup'
import { RequirementToggle } from './RequirementToggle'
import { PresetSelector, PresetType, PRESETS } from './PresetSelector'

interface MessageRequirementsSelectorProps {
  requirements: MessageRequirements
  onChange: (requirements: MessageRequirements) => void
}

// Helper function to find matching preset
function findMatchingPreset(req: MessageRequirements): PresetType {
  const matchingPreset = PRESETS.find(p => {
    return Object.keys(p.requirements).every((key) => {
      const k = key as keyof MessageRequirements
      return p.requirements[k] === req[k]
    })
  })
  return matchingPreset?.id || 'custom'
}

export function MessageRequirementsSelector({
  requirements,
  onChange,
}: MessageRequirementsSelectorProps) {
  // Initialize with correct preset based on initial requirements
  const [localReq, setLocalReq] = useState<MessageRequirements>(requirements)
  const [selectedPreset, setSelectedPreset] = useState<PresetType>(() => findMatchingPreset(requirements))

  // Sync local state when requirements prop changes (e.g., from preset selection)
  useEffect(() => {
    // Always sync localReq and selectedPreset when requirements prop changes
    // This ensures the modal shows the correct preset when opened
    setLocalReq(requirements)
    const matchingPreset = findMatchingPreset(requirements)
    setSelectedPreset(matchingPreset)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requirements]) // Only depend on requirements prop, not localReq to avoid loops

  // Only call onChange when user makes changes (not when syncing from prop)
  // This is handled by updateRequirement and handlePresetSelect functions

  const updateRequirement = <K extends keyof MessageRequirements>(
    key: K,
    value: MessageRequirements[K]
  ) => {
    const newReq = { ...localReq, [key]: value }
    setLocalReq(newReq)
    setSelectedPreset('custom')
    onChange(newReq) // Notify parent of change
  }

  const handlePresetSelect = (preset: typeof PRESETS[0]) => {
    setLocalReq(preset.requirements)
    setSelectedPreset(preset.id)
    onChange(preset.requirements) // Notify parent of change
  }

  const handleReset = () => {
    const balanced = PRESETS.find(p => p.id === 'balanced')
    if (balanced) {
      handlePresetSelect(balanced)
    }
  }

  // Summary of selected requirements
  const activeRequirements = useMemo(() => {
    const active: string[] = []
    if (localReq.isCostSensitive) active.push('Cost Sensitive')
    if (localReq.requiresFastFinality) active.push('Fast Finality')
    if (localReq.requiresGuaranteedDelivery) active.push('Guaranteed Delivery')
    if (localReq.isMultiChain) active.push('Multi-Chain')
    if (localReq.requiresNativeSecurity) active.push('Native Security')
    if (localReq.requiresDisputeResolution) active.push('Dispute Resolution')
    return active
  }, [localReq])

  // Validation: Check for conflicting requirements
  const validationWarnings = useMemo(() => {
    const warnings: string[] = []
    
    // Cost sensitive + Fast finality conflict
    if (localReq.isCostSensitive && localReq.requiresFastFinality) {
      warnings.push('Cost optimization may conflict with fast finality requirements')
    }
    
    // Native security + Fast finality (may have delay)
    if (localReq.requiresNativeSecurity && localReq.requiresFastFinality && localReq.maxDelay < BigInt(604800)) {
      warnings.push('Native security typically requires longer delays (7+ days)')
    }
    
    // Multi-chain without fast finality
    if (localReq.isMultiChain && !localReq.requiresFastFinality) {
      warnings.push('Multi-chain operations typically benefit from fast finality')
    }
    
    return warnings
  }, [localReq])

  return (
    <div className="space-y-3">
      {/* Header with Reset */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-zinc-900 dark:text-white text-sm font-semibold">
            Message Requirements
          </label>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="px-2 py-1 text-xs font-medium text-zinc-500 dark:text-gray-400 hover:text-zinc-700 dark:hover:text-gray-300 hover:bg-white/5 rounded transition-colors"
          title="Reset to balanced preset"
        >
          Reset
        </button>
      </div>

      {/* Preset Selector */}
      <PresetSelector
        selectedPreset={selectedPreset}
        onSelectPreset={handlePresetSelect}
        currentRequirements={localReq}
      />

      {/* Compact Summary */}
      {activeRequirements.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {activeRequirements.map((req) => (
            <span
              key={req}
              className="px-2 py-0.5 text-xs font-medium bg-primary/20 text-primary rounded-full"
            >
              {req}
            </span>
          ))}
        </div>
      )}

      {/* Compact Validation Warnings */}
      {validationWarnings.length > 0 && (
        <div className="px-2 py-1.5 rounded border border-yellow-500/30 bg-yellow-500/5">
          <div className="flex items-start gap-1.5">
            <span className="material-symbols-outlined !text-xs text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5">
              warning
            </span>
            <div className="flex-1 min-w-0">
              <ul className="space-y-0.5">
                {validationWarnings.map((warning, idx) => (
                  <li key={idx} className="text-xs text-yellow-700 dark:text-yellow-300">
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Grouped Requirements - Single Column */}
      <div className="space-y-3">
        {/* Performance Group */}
        <RequirementGroup
          title="Performance"
          icon="speed"
          color="#3b82f6"
          defaultExpanded={false}
          activeCount={
            (localReq.requiresFastFinality ? 1 : 0) +
            (localReq.requiresGuaranteedDelivery ? 1 : 0) +
            (localReq.isMultiChain ? 1 : 0)
          }
        >
          <RequirementToggle
            label="Fast Finality"
            description="Requires fast finality (prefers LayerZero)"
            icon="bolt"
            enabled={localReq.requiresFastFinality}
            onChange={(enabled) => updateRequirement('requiresFastFinality', enabled)}
            tooltip="Enable for time-sensitive operations that need quick confirmation"
          />
          <RequirementToggle
            label="Guaranteed Delivery"
            description="Requires guaranteed delivery (LayerZero executor)"
            icon="verified"
            enabled={localReq.requiresGuaranteedDelivery}
            onChange={(enabled) => updateRequirement('requiresGuaranteedDelivery', enabled)}
            tooltip="Ensures message delivery with executor fallback"
          />
          <RequirementToggle
            label="Multi-Chain"
            description="Operation spans multiple chains"
            icon="account_tree"
            enabled={localReq.isMultiChain}
            onChange={(enabled) => updateRequirement('isMultiChain', enabled)}
            tooltip="Enable for operations that need to reach multiple chains"
          />
        </RequirementGroup>

        {/* Cost Group */}
        <RequirementGroup
          title="Cost Optimization"
          icon="savings"
          color="#10b981"
          defaultExpanded={false}
          activeCount={localReq.isCostSensitive ? 1 : 0}
        >
          <RequirementToggle
            label="Cost Sensitive"
            description="Prefers EIL native bridge for lower costs"
            icon="payments"
            enabled={localReq.isCostSensitive}
            onChange={(enabled) => updateRequirement('isCostSensitive', enabled)}
            tooltip="Optimize for lower transaction costs, may have longer delays"
          />
        </RequirementGroup>

        {/* Security Group */}
        <RequirementGroup
          title="Security"
          icon="shield"
          color="#ef4444"
          defaultExpanded={false}
          activeCount={
            (localReq.requiresNativeSecurity ? 1 : 0) +
            (localReq.requiresDisputeResolution ? 1 : 0) +
            (localReq.securityLevel > SecurityLevel.LOW ? 1 : 0)
          }
        >
          <RequirementToggle
            label="Native Security"
            description="Requires native bridge security (EIL)"
            icon="security"
            enabled={localReq.requiresNativeSecurity}
            onChange={(enabled) => updateRequirement('requiresNativeSecurity', enabled)}
            tooltip="Use native bridge security mechanisms for enhanced protection"
          />
          <RequirementToggle
            label="Dispute Resolution"
            description="Requires dispute resolution (EIL)"
            icon="gavel"
            enabled={localReq.requiresDisputeResolution}
            onChange={(enabled) => updateRequirement('requiresDisputeResolution', enabled)}
            tooltip="Enable dispute resolution mechanisms for conflict handling"
          />
          
          {/* Security Level */}
          <div className="p-2.5 rounded-lg hover:bg-white/5 transition-colors">
            <label className="flex items-center gap-2 mb-1.5">
              <span className="material-symbols-outlined !text-lg text-zinc-400 dark:text-gray-500">
                lock
              </span>
              <span className="text-zinc-900 dark:text-white text-sm font-medium">
                Security Level
              </span>
            </label>
            <select
              value={localReq.securityLevel}
              onChange={(e) => {
                updateRequirement('securityLevel', Number(e.target.value) as SecurityLevel)
              }}
              className="glass-input w-full text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              aria-label="Security level selection"
            >
              <option value={SecurityLevel.LOW}>Low - Standard security</option>
              <option value={SecurityLevel.MEDIUM}>Medium - Enhanced security</option>
              <option value={SecurityLevel.HIGH}>High - Maximum security</option>
              <option value={SecurityLevel.CRITICAL}>Critical - Highest security with native mechanisms</option>
            </select>
          </div>
        </RequirementGroup>

        {/* Timing Group */}
        <RequirementGroup
          title="Timing"
          icon="schedule"
          color="#f59e0b"
          defaultExpanded={false}
          activeCount={localReq.maxDelay !== BigInt(86400) ? 1 : 0}
        >
          <div className="p-2.5 rounded-lg hover:bg-white/5 transition-colors">
            <label className="flex items-center gap-2 mb-1.5">
              <span className="material-symbols-outlined !text-lg text-zinc-400 dark:text-gray-500">
                timer
              </span>
              <span className="text-zinc-900 dark:text-white text-sm font-medium">
                Maximum Delay
              </span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={localReq.maxDelay.toString()}
                onChange={(e) => updateRequirement('maxDelay', BigInt(e.target.value || '0'))}
                className="glass-input flex-1 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="604800"
                min="0"
                step="1"
                aria-label="Maximum delay in seconds"
              />
              <select
                value={localReq.maxDelay.toString()}
                onChange={(e) => updateRequirement('maxDelay', BigInt(e.target.value))}
                className="glass-input w-28 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                aria-label="Quick select maximum delay"
              >
                <option value="3600">1 hour</option>
                <option value="86400">1 day</option>
                <option value="604800">7 days</option>
                <option value="2592000">30 days</option>
                <option value={localReq.maxDelay.toString()}>Custom</option>
              </select>
            </div>
          </div>
        </RequirementGroup>
      </div>
    </div>
  )
}

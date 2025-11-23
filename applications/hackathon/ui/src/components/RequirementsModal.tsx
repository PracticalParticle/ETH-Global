/**
 * Modal component for configuring message requirements
 */

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MessageRequirements } from '../types/transaction'
import { MessageRequirementsSelector } from './MessageRequirementsSelector'

interface RequirementsModalProps {
  isOpen: boolean
  onClose: () => void
  requirements: MessageRequirements
  onChange: (requirements: MessageRequirements) => void
}

export function RequirementsModal({
  isOpen,
  onClose,
  requirements,
  onChange,
}: RequirementsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Focus trapping - keep focus within modal
  useEffect(() => {
    if (!isOpen || !modalRef.current) return

    const modal = modalRef.current
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    modal.addEventListener('keydown', handleTab)
    return () => modal.removeEventListener('keydown', handleTab)
  }, [isOpen])

  // Focus management
  useEffect(() => {
    if (isOpen) {
      // Store previous focus
      previousFocusRef.current = document.activeElement as HTMLElement
      
      // Focus modal after a brief delay to allow animation
      const timer = setTimeout(() => {
        modalRef.current?.focus()
      }, 100)

      return () => clearTimeout(timer)
    } else {
      // Restore previous focus
      if (previousFocusRef.current) {
        previousFocusRef.current.focus()
      }
    }
  }, [isOpen])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden glass-card rounded-xl shadow-2xl focus:outline-none"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="requirements-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/20 dark:border-white/10">
          <h2
            id="requirements-modal-title"
            className="text-zinc-900 dark:text-white text-lg font-bold"
          >
            Message Requirements
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
            aria-label="Close requirements modal"
          >
            <span className="material-symbols-outlined !text-xl text-zinc-600 dark:text-gray-400">
              close
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-4">
          <MessageRequirementsSelector
            requirements={requirements}
            onChange={onChange}
          />
        </div>
      </div>
    </div>,
    document.body
  )
}


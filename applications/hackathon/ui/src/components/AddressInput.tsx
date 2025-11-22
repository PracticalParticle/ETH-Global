import { useState, useEffect } from 'react'
import { usePublicClient } from 'wagmi'
import { isAddress, isHex } from 'viem'

interface AddressInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export function AddressInput({
  value,
  onChange,
  placeholder = 'Enter address, ENS name...',
  disabled,
}: AddressInputProps) {
  const [ensName, setEnsName] = useState<string | null>(null)
  const [isResolving, setIsResolving] = useState(false)
  const publicClient = usePublicClient()

  // Resolve ENS name to address
  useEffect(() => {
    async function resolveENS() {
      if (!value || !publicClient) {
        setEnsName(null)
        return
      }

      // If it's already a valid address, try to get reverse ENS
      if (isAddress(value)) {
        setIsResolving(true)
        try {
          const name = await publicClient.getEnsName({ address: value as `0x${string}` })
          setEnsName(name)
        } catch (error) {
          setEnsName(null)
        } finally {
          setIsResolving(false)
        }
        return
      }

      // If it looks like an ENS name (contains .eth or .)
      if (value.includes('.') && !isHex(value)) {
        setIsResolving(true)
        try {
          const address = await publicClient.getEnsAddress({ name: value })
          if (address) {
            setEnsName(value)
            // Optionally update the value to the resolved address
            // onChange(address)
          } else {
            setEnsName(null)
          }
        } catch (error) {
          setEnsName(null)
        } finally {
          setIsResolving(false)
        }
      } else {
        setEnsName(null)
      }
    }

    // Debounce ENS resolution
    const timeoutId = setTimeout(resolveENS, 500)
    return () => clearTimeout(timeoutId)
  }, [value, publicClient])

  const isValid = value ? (isAddress(value) || (ensName !== null && value.includes('.'))) : true

  return (
    <label className="relative flex w-full flex-1 items-stretch">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-zinc-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border ${
          isValid
            ? 'border-gray-300 dark:border-zinc-700'
            : 'border-red-500 dark:border-red-500'
        } bg-background-light dark:bg-zinc-900/50 focus:border-primary h-14 placeholder:text-zinc-500 dark:placeholder:text-gray-500 p-4 text-base font-normal leading-normal disabled:opacity-50 disabled:cursor-not-allowed`}
      />
      {isResolving && (
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          <div className="text-zinc-500 dark:text-gray-400 flex items-center justify-center">
            <span className="material-symbols-outlined animate-spin">sync</span>
          </div>
        </div>
      )}
      {ensName && value && isAddress(value) && (
        <div className="absolute -top-6 left-0 text-xs text-zinc-500 dark:text-gray-400">
          {ensName}
        </div>
      )}
    </label>
  )
}


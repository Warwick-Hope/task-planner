'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface RoleCategory {
  name: string
  colour: string
}

const COLOURS = [
  '#3B82F6',
  '#10B981',
  '#8B5CF6',
  '#F59E0B',
  '#EF4444',
  '#EC4899',
  '#14B8A6',
  '#6B7280',
]

const STEPS = ['Your name', 'Areas of focus', 'Mission']

export default function OnboardingWizard() {
  const router = useRouter()

  const [step, setStep] = useState(0)
  const [displayName, setDisplayName] = useState('')
  const [roles, setRoles] = useState<RoleCategory[]>([])
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleColour, setNewRoleColour] = useState(COLOURS[0])
  const [mission, setMission] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function addRole() {
    const name = newRoleName.trim()
    if (!name) return
    setRoles((prev) => [...prev, { name, colour: newRoleColour }])
    setNewRoleName('')
    setNewRoleColour(COLOURS[roles.length % COLOURS.length])
  }

  function removeRole(index: number) {
    setRoles((prev) => prev.filter((_, i) => i !== index))
  }

  function canAdvance() {
    if (step === 0) return displayName.trim().length > 0
    if (step === 1) return roles.length > 0
    return true
  }

  async function handleFinish(skipMission = false) {
    setError(null)
    setSubmitting(true)

    const res = await fetch('/api/onboarding/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName,
        roleCategories: roles,
        mission: skipMission ? undefined : mission,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Something went wrong')
      setSubmitting(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                  i < step
                    ? 'bg-blue-600 text-white'
                    : i === step
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-400'
                }`}
              >
                {i < step ? '✓' : i + 1}
              </div>
              <span
                className={`text-xs hidden sm:block ${i === step ? 'text-gray-900 font-medium' : 'text-gray-400'}`}
              >
                {label}
              </span>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-gray-200 ml-2" />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {/* Step 0 — Display name */}
          {step === 0 && (
            <div>
              <h1 className="text-xl font-semibold text-gray-900 mb-1">What should we call you?</h1>
              <p className="text-sm text-gray-500 mb-6">This is your display name within the app.</p>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
                Display name
              </label>
              <input
                id="displayName"
                type="text"
                autoFocus
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && canAdvance() && setStep(1)}
                placeholder="e.g. Warwick"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Step 1 — Role categories */}
          {step === 1 && (
            <div>
              <h1 className="text-xl font-semibold text-gray-900 mb-1">
                What are your main areas of focus?
              </h1>
              <p className="text-sm text-gray-500 mb-6">
                Add the top-level roles or domains that tasks will belong to. You can add more later.
              </p>

              {/* Existing roles */}
              {roles.length > 0 && (
                <ul className="space-y-2 mb-4">
                  {roles.map((role, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2"
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: role.colour }}
                      />
                      <span className="text-sm text-gray-900 flex-1">{role.name}</span>
                      <button
                        onClick={() => removeRole(i)}
                        className="text-gray-300 hover:text-red-500 transition-colors text-xs"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Add new role */}
              <div className="space-y-3 rounded-lg border border-dashed border-gray-300 p-3">
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addRole()}
                  placeholder="e.g. Work, Personal, Health"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 shrink-0">Colour:</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {COLOURS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setNewRoleColour(c)}
                        className={`w-5 h-5 rounded-full transition-transform ${
                          newRoleColour === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <button
                    onClick={addRole}
                    disabled={!newRoleName.trim()}
                    className="ml-auto text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — Mission */}
          {step === 2 && (
            <div>
              <h1 className="text-xl font-semibold text-gray-900 mb-1">
                What&apos;s your mission?
              </h1>
              <p className="text-sm text-gray-500 mb-6">
                Optional. A statement of purpose that guides your planning. You can add or change
                this later.
              </p>
              <textarea
                rows={4}
                value={mission}
                onChange={(e) => setMission(e.target.value)}
                placeholder="e.g. Build systems that give people time back."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>
          )}

          {error && (
            <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => setStep((s) => s - 1)}
              className={`text-sm text-gray-500 hover:text-gray-800 transition-colors ${step === 0 ? 'invisible' : ''}`}
            >
              Back
            </button>

            <div className="flex gap-3">
              {step === 2 && (
                <button
                  onClick={() => handleFinish(true)}
                  disabled={submitting}
                  className="text-sm text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                >
                  Skip
                </button>
              )}
              <button
                onClick={() => {
                  if (step < 2) setStep((s) => s + 1)
                  else handleFinish(false)
                }}
                disabled={!canAdvance() || submitting}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {step < 2 ? 'Next' : submitting ? 'Saving…' : 'Finish'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

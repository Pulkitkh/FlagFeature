import { useState } from 'react'
import { Button, Dropdown, Field, Input, Modal, Switch, Textarea } from './ui'

const DEFAULT_VALUE_BY_TYPE = { boolean: true, string: '', number: 0 }

const TYPE_OPTIONS = [
  { value: 'boolean', label: 'Boolean — on / off' },
  { value: 'string', label: 'String — named variant' },
  { value: 'number', label: 'Number — numeric value' },
]

const KEY_PATTERN = /^[a-z0-9][a-z0-9-_]*$/

export default function FlagForm({ initialFlag, onSubmit, onCancel, submitting, error }) {
  const isEdit = Boolean(initialFlag)

  const [key, setKey] = useState(initialFlag?.key || '')
  const [type, setType] = useState(initialFlag?.type || 'boolean')
  const [defaultValue, setDefaultValue] = useState(
    initialFlag ? initialFlag.default_value : DEFAULT_VALUE_BY_TYPE.boolean
  )
  const [enabled, setEnabled] = useState(initialFlag?.enabled ?? true)
  const [description, setDescription] = useState(initialFlag?.description || '')
  const [ownerTeam, setOwnerTeam] = useState(initialFlag?.owner_team || '')
  const [keyError, setKeyError] = useState(null)

  function handleTypeChange(nextType) {
    setType(nextType)
    setDefaultValue(DEFAULT_VALUE_BY_TYPE[nextType])
  }

  function handleSubmit(event) {
    event.preventDefault()

    if (!isEdit && !KEY_PATTERN.test(key.trim())) {
      setKeyError('Use lowercase letters, numbers, hyphens and underscores.')
      return
    }
    setKeyError(null)

    const common = {
      type,
      default_value: coerceValue(type, defaultValue),
      enabled,
      description: description.trim(),
      owner_team: ownerTeam.trim(),
    }
    onSubmit(isEdit ? common : { key: key.trim(), ...common })
  }

  return (
    <Modal
      open
      onClose={onCancel}
      title={isEdit ? `Edit ${initialFlag.key}` : 'Create a feature flag'}
      description={
        isEdit
          ? 'Changes are versioned automatically and appear in the audit log.'
          : 'Flags start global. Use the detail page to target users, roll out gradually, or override per environment.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="flag-form" loading={submitting}>
            {isEdit ? 'Save changes' : 'Create flag'}
          </Button>
        </>
      }
    >
      <form id="flag-form" onSubmit={handleSubmit} className="space-y-5">
        {!isEdit && (
          <Field
            label="Flag key"
            error={keyError}
            hint="The identifier your application passes to the evaluation API."
          >
            {(id) => (
              <Input
                id={id}
                required
                autoFocus
                mono
                value={key}
                onChange={(event) => setKey(event.target.value)}
                placeholder="new-checkout-flow"
              />
            )}
          </Field>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Type">
            {(id) => (
              <Dropdown id={id} value={type} onChange={handleTypeChange} options={TYPE_OPTIONS} />
            )}
          </Field>

          <Field
            label="Default value"
            hint="Served when no rule matches."
          >
            {(id) =>
              type === 'boolean' ? (
                <Dropdown
                  id={id}
                  value={String(defaultValue)}
                  onChange={(value) => setDefaultValue(value === 'true')}
                  mono
                  options={[
                    { value: 'true', label: 'true' },
                    { value: 'false', label: 'false' },
                  ]}
                />
              ) : (
                <Input
                  id={id}
                  mono
                  required
                  type={type === 'number' ? 'number' : 'text'}
                  step={type === 'number' ? 'any' : undefined}
                  value={defaultValue}
                  onChange={(event) => setDefaultValue(event.target.value)}
                  placeholder={type === 'number' ? '0' : 'control'}
                />
              )
            }
          </Field>
        </div>

        <Field label="Owner team" hint="Who to ask before this flag changes.">
          {(id) => (
            <Input
              id={id}
              value={ownerTeam}
              onChange={(event) => setOwnerTeam(event.target.value)}
              placeholder="growth"
            />
          )}
        </Field>

        <Field label="Description">
          {(id) => (
            <Textarea
              id={id}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="What does this flag control, and when can it be removed?"
            />
          )}
        </Field>

        <div className="rounded-lg border border-border bg-surfaceMuted p-4">
          <Switch
            checked={enabled}
            onChange={setEnabled}
            label="Enabled globally"
            description="Turning this off is a kill switch — the flag resolves off everywhere, whatever the rules say."
          />
        </div>

        {error && (
          <p className="rounded-lg border border-bad/25 bg-badSoft px-3 py-2.5 text-sm text-bad">
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}

function coerceValue(type, value) {
  if (type === 'number') return Number(value)
  if (type === 'boolean') return Boolean(value)
  return String(value)
}

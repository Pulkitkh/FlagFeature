import { useState } from 'react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import { Field, Input, Select, Textarea, Switch } from './ui/Input'

const DEFAULT_VALUE_BY_TYPE = {
  boolean: true,
  string: '',
  number: 0,
}

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

  function handleTypeChange(nextType) {
    setType(nextType)
    setDefaultValue(DEFAULT_VALUE_BY_TYPE[nextType])
  }

  function handleSubmit(e) {
    e.preventDefault()
    const payload = isEdit
      ? {
          type,
          default_value: coerceValue(type, defaultValue),
          enabled,
          description,
          owner_team: ownerTeam,
        }
      : {
          key,
          type,
          default_value: coerceValue(type, defaultValue),
          enabled,
          description,
          owner_team: ownerTeam,
        }
    onSubmit(payload)
  }

  return (
    <Modal
      open
      onClose={onCancel}
      title={isEdit ? `Edit ${initialFlag.key}` : 'Create flag'}
      description={
        isEdit
          ? 'Changes are versioned automatically.'
          : 'Flags start global; use the detail page to override per environment.'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isEdit && (
          <Field label="Key">
            <Input
              required
              autoFocus
              mono
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="new-checkout-flow"
            />
          </Field>
        )}

        <Field label="Type">
          <Select value={type} onChange={(e) => handleTypeChange(e.target.value)}>
            <option value="boolean">Boolean</option>
            <option value="string">String</option>
            <option value="number">Number</option>
          </Select>
        </Field>

        <Field label="Default value">
          {type === 'boolean' ? (
            <Select
              value={String(defaultValue)}
              onChange={(e) => setDefaultValue(e.target.value === 'true')}
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </Select>
          ) : (
            <Input
              mono
              type={type === 'number' ? 'number' : 'text'}
              value={defaultValue}
              onChange={(e) => setDefaultValue(e.target.value)}
            />
          )}
        </Field>

        <Field label="Owner team">
          <Input
            value={ownerTeam}
            onChange={(e) => setOwnerTeam(e.target.value)}
            placeholder="growth"
          />
        </Field>

        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </Field>

        <Switch checked={enabled} onChange={setEnabled} label="Enabled globally" />

        {error && <p className="text-sm text-bad">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {isEdit ? 'Save changes' : 'Create flag'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function coerceValue(type, value) {
  if (type === 'number') return Number(value)
  if (type === 'boolean') return Boolean(value)
  return value
}

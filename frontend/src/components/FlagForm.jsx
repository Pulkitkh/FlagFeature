import { useState } from 'react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import Dropdown from './ui/Dropdown'
import { Field, Input, Textarea, Switch } from './ui/Input'
import { useT } from '../context/LanguageContext'

const DEFAULT_VALUE_BY_TYPE = {
  boolean: true,
  string: '',
  number: 0,
}

export default function FlagForm({ initialFlag, onSubmit, onCancel, submitting, error }) {
  const isEdit = Boolean(initialFlag)
  const t = useT()

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
      title={isEdit ? t('editFlagTitle', { key: initialFlag.key }) : t('createFlag')}
      description={isEdit ? t('editFlagHint') : t('createFlagHint')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isEdit && (
          <Field label={t('fieldKey')}>
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

        <Field label={t('fieldType')}>
          <Dropdown
            value={type}
            onChange={handleTypeChange}
            options={[
              { value: 'boolean', label: t('typeBoolean') },
              { value: 'string', label: t('typeString') },
              { value: 'number', label: t('typeNumber') },
            ]}
          />
        </Field>

        <Field label={t('defaultValue')}>
          {type === 'boolean' ? (
            <Dropdown
              value={String(defaultValue)}
              onChange={(v) => setDefaultValue(v === 'true')}
              mono
              // `true`/`false` are the literal API values, not prose — they stay
              // in English in every locale so the form matches what's stored.
              options={[
                { value: 'true', label: 'true' },
                { value: 'false', label: 'false' },
              ]}
            />
          ) : (
            <Input
              mono
              type={type === 'number' ? 'number' : 'text'}
              value={defaultValue}
              onChange={(e) => setDefaultValue(e.target.value)}
            />
          )}
        </Field>

        <Field label={t('ownerTeam')}>
          <Input
            value={ownerTeam}
            onChange={(e) => setOwnerTeam(e.target.value)}
            placeholder="growth"
          />
        </Field>

        <Field label={t('fieldDescription')}>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </Field>

        <Switch checked={enabled} onChange={setEnabled} label={t('enabledGlobally')} />

        {error && (
          <p className="rounded-lg border border-bad/25 bg-badSoft px-3 py-2.5 text-sm text-bad">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t('cancel')}
          </Button>
          <Button type="submit" loading={submitting}>
            {isEdit ? t('saveChanges') : t('createFlag')}
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

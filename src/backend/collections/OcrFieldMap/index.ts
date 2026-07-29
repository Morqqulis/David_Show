import type { CollectionConfig } from 'payload'
import { PREBUILT_INVOICE_SOURCE_FIELDS } from '../../lib/intake-field-mapping'

/**
 * One row per mapping: an app field, the reading it draws from, and a switch.
 *
 * A mapping table rather than a list of on/off switches, because the field
 * schema is configured per client — without being told where a value belongs,
 * the extraction has nowhere to put it.
 *
 * `sourceField` is constrained to the prebuilt model's own field names. Aiming
 * the extraction at a client-specific field the model has never seen would
 * need a trained custom model, which is out of scope.
 */
export const OcrFieldMap: CollectionConfig = {
  slug: 'ocr-field-map',
  labels: { singular: 'Reading Rule', plural: 'Reading Rules' },
  admin: {
    useAsTitle: 'appField',
    defaultColumns: ['appField', 'sourceField', 'enabled'],
    description: 'Which reading from a scanned invoice fills which field in this app.',
  },
  defaultSort: 'order',
  fields: [
    {
      name: 'appField',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'Key of the field in this app that the value lands in.' },
    },
    {
      name: 'sourceField',
      type: 'select',
      required: true,
      options: PREBUILT_INVOICE_SOURCE_FIELDS.map((f) => ({ label: f.label, value: f.name })),
    },
    { name: 'enabled', type: 'checkbox', defaultValue: true },
    { name: 'order', type: 'number', defaultValue: 0 },
  ],
}

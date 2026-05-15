import type { CollectionConfig } from 'payload'

export const Apps: CollectionConfig = {
   slug: 'apps',
   fields: [
      {
         name: 'name',
         type: 'text',
      },
      {
         name: 'description',
         type: 'text',
      },

   ],
}
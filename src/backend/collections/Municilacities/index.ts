import type { CollectionConfig } from 'payload'

export const Municilacities: CollectionConfig = {
   slug: 'municilacities',
   fields: [
      {
         name: 'title',
         type: 'text',
      },
      {
         name: 'description',
         type: 'text',
      },
      {
         name: 'primaryColor',
         type: 'text',
      },
      {
         name: 'secondaryColor',
         type: 'text',
      }
   ],
}
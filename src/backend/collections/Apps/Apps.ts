import { CollectionConfig } from 'payload'

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
      {
         name: 'image',
         type: 'upload',
         relationTo: 'media',
      },
   ],
}
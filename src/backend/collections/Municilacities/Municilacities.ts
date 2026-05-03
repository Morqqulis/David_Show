import { CollectionConfig } from 'payload'

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
         name: 'image',
         type: 'upload',
         relationTo: 'media',
      },
      {
         name: 'color',
         type: 'text',
      },
   ],
}
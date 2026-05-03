import { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
   slug: 'users',
   fields: [
      {
         name: 'name',
         type: 'text',
      },
      {
         name: 'email',
         type: 'email',
      },
   ],
}
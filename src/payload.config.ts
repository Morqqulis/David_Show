import { vercelPostgresAdapter } from '@payloadcms/db-vercel-postgres'

import { lexicalEditor } from '@payloadcms/richtext-lexical'

import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'
import { Apps } from './backend/collections/Apps/Apps'
import { Municilacities } from './backend/collections/Municilacities/Municilacities'
import { Users } from './backend/collections/Users/Users'




const filename = fileURLToPath( import.meta.url )
const dirname = path.dirname( filename )

export default buildConfig( {

   cookiePrefix: 'David',
   admin: {
      user: Users.slug,
      suppressHydrationWarning: true,
      autoRefresh: true,
      toast: {
         duration: 3000,
         position: 'top-center',
         expand: true,
         limit: 5,
      },
      importMap: {
         baseDir: path.resolve( dirname ),
      },
   },
   collections: [ Users, Municilacities, Apps ],

   editor: lexicalEditor( {} ),
   secret: process.env.PAYLOAD_SECRET || '',
   typescript: {
      outputFile: path.resolve( dirname, 'payload-types.ts' ),
   },
   // Vercel Postgres adapter
   db: vercelPostgresAdapter( {
      pool: {
         connectionString: process.env.POSTGRES_URL || '',
      },
   } ),



   sharp,

} )

import { vercelPostgresAdapter } from '@payloadcms/db-vercel-postgres'

import { lexicalEditor } from '@payloadcms/richtext-lexical'

import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { uploadthingStorage } from '@payloadcms/storage-uploadthing'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'
import { collections } from './backend/collections'
import { Users } from './backend/collections/Users'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
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
			baseDir: path.resolve(dirname),
		},
	},
	collections: collections,

	editor: lexicalEditor({}),
	secret: process.env.PAYLOAD_SECRET || '',
	typescript: {
		outputFile: path.resolve(dirname, 'payload-types.ts'),
	},
	// Vercel Postgres adapter
	db: vercelPostgresAdapter({
		pool: {
			connectionString: process.env.DATABASE_URL || '',
		},
	}),

	plugins: [
		formBuilderPlugin({}),

		uploadthingStorage({
			collections: {
				documents: true,
			},
			options: {
				token: process.env.UPLOADTHING_TOKEN,
				acl: 'public-read',
			},
		}),
	],
	sharp,
})

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
				// Serve file bytes straight from the UploadThing CDN instead of
				// proxying them through Payload's `/api/documents/file/<name>`
				// static handler.
				//
				// Why: that handler HEADs UploadThing's signed URL and trusts
				// `content-length` to build the response. UploadThing does not
				// send that header, so the handler computed a file size of 0
				// and emitted `Content-Length: 0` — every download came back
				// 200 OK with an empty body, and pdf.js reported "Failed to
				// load PDF document". Range requests fared worse: a size of 0
				// makes every range unsatisfiable, so Chrome's PDF viewer got
				// a 416 before any response header could be corrected.
				//
				// With this flag the plugin's afterRead hook rewrites `url` to
				// the CDN address on every read, which also repairs rows
				// written before this fix without a data migration.
				//
				// Trade-off: file bytes sit outside Payload access control.
				// That is already true today — the objects are uploaded with
				// `acl: 'public-read'` and Documents.read is public. Revisit
				// together with the auth work: private ACL + a signed-URL
				// redirect route is the shape that keeps both properties.
				documents: { disablePayloadAccessControl: true },
			},
			options: {
				token: process.env.UPLOADTHING_TOKEN,
				acl: 'public-read',
			},
		}),
	],
	sharp,
})

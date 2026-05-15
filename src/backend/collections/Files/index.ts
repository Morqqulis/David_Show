import type { CollectionConfig } from 'payload'

export const Files: CollectionConfig = {
	slug: 'files',
	upload: true,
	fields: [
		{
			name: 'name',
			type: 'text',
		},
	],
}

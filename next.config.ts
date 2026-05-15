import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
	/* config options here */
	reactCompiler: true,
	reactStrictMode: false,
}

export default withPayload(nextConfig)

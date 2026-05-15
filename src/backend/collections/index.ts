import type { CollectionConfig } from 'payload'
import { Apps } from './Apps'
import { Municilacities } from './Municilacities'
import { Users } from './Users'
import { Files } from './Files'

//----------------------------------------------

export const collections: CollectionConfig[] = [
   Users,
   Municilacities,
   Apps,
   Files,
]
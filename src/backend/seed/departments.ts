import type { Payload } from 'payload'

export async function seedDepartments(payload: Payload) {
  const data = [
    { name: 'Public Works', code: 'PW' },
    { name: 'Information Technology', code: 'IT' },
    { name: 'Parks & Recreation', code: 'PR' },
    { name: 'Library', code: 'LIB' },
    { name: 'Fire', code: 'FIRE' },
    { name: 'Finance / AP', code: 'AP' },
    { name: 'Administration', code: 'ADM' },
  ]
  return Promise.all(data.map((d) => payload.create({ collection: 'departments', data: d })))
}

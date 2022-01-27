import { promises as fs } from 'fs'

export async function exists(filename: string): Promise<boolean> {
  try {
    await fs.access(filename)
    return true
  } catch {
    return false
  }
}

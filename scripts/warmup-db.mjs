// Wakes up Neon's serverless compute before prisma migrate deploy runs.
// Neon suspends after inactivity; the first query can take ~10s+, which
// exceeds Prisma's advisory lock timeout. This runs a simple query first
// so the DB is awake when the migration requests the advisory lock.
import { PrismaClient } from '@prisma/client'

let attempts = 0
while (attempts < 5) {
  const prisma = new PrismaClient()
  try {
    await prisma.$queryRaw`SELECT 1`
    await prisma.$disconnect()
    console.log('DB warmed up.')
    process.exit(0)
  } catch (err) {
    await prisma.$disconnect().catch(() => {})
    attempts++
    console.log(`Warmup attempt ${attempts} failed: ${err.message}`)
    if (attempts >= 5) { console.error('DB warmup failed after 5 attempts'); process.exit(1) }
    await new Promise(r => setTimeout(r, 3000))
  }
}

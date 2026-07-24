import 'dotenv/config';

const direct = process.env.DIRECT_URL ?? '';
const database = process.env.DATABASE_URL ?? '';

function getPort(url) {
  const match = url.match(/:(\d+)(?:\/|\?|$)/);
  return match ? match[1] : 'none';
}

console.log('DIRECT_URL set:', Boolean(direct));
console.log('DIRECT_URL port:', getPort(direct));
console.log('DATABASE_URL port:', getPort(database));
console.log('same value:', direct === database);
console.log('DIRECT has pgbouncer:', direct.includes('pgbouncer'));

import dotenv from 'dotenv';
import path from 'path';

const initialDatabaseUrl = process.env.DATABASE_URL;

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const resolvedDatabaseUrl =
  initialDatabaseUrl ||
  process.env.DATABASE_URL ||
  'postgresql://zerofeed:zerofeed_secret@localhost:5432/zerofeed?schema=public';

process.env.DATABASE_URL = resolvedDatabaseUrl;

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: resolvedDatabaseUrl,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev_jwt_access_secret_key_change_in_production_123',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_jwt_refresh_secret_key_change_in_production_456',
    accessExpiresIn: '15m',
    refreshExpiresIn: '30d',
    refreshExpiresInDays: 30,
  },
  google: {
    clientId:
      process.env.GOOGLE_CLIENT_ID ||
      '109814022869-6bvlc37qt7g1vrfek19uui96ljunb5ug.apps.googleusercontent.com',
  },
};

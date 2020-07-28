import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

export async function readSecret() {
  const secret = process.env.SECRET;
  if (!secret) {
    throw new Error('No SECRET environment variable defined');
  }

  const useInsecureSecret =
    process.env.USE_INSECURE_SECRET?.trim().toLowerCase() ?? '';

  if (/projects\/.*\/secrets\/.*/.test(secret)) {
    const client = new SecretManagerServiceClient();
    const [version] = await client.accessSecretVersion({
      name: process.env.SECRET,
    });
    const value = version.payload?.data;
    if (!Buffer.isBuffer(value)) {
      throw new Error(
        'Expected Buffer data type to be stored in the secret manager'
      );
    }
    // buffer is safer way to store secrets, but strings
    // is the way secrets arrive to the app anyway
    return value.toString();
  } else if (['1', 'true', 'yes'].includes(useInsecureSecret)) {
    return secret;
  } else {
    throw new Error('Invalid secret setup');
  }
}

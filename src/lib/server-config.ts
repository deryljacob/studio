/**
 * @fileOverview Server-side configuration loader.
 *
 * This file is responsible for loading, decoding, and parsing the Firebase
 * service account credentials from environment variables. It's designed to
 * be the single source of truth for server-only configurations. It will not
 * throw an error if the variable is missing during build time, but will result
 * in a null value that can be checked at runtime.
 */

interface ServerConfig {
  firebaseServiceAccount: {
    type: string;
    project_id: string;
    private_key_id: string;
    private_key: string;
    client_email: string;
    client_id: string;
    auth_uri: string;
    token_uri: string;
    auth_provider_x509_cert_url: string;
    client_x509_cert_url: string;
    universe_domain: string;
  } | null;
}

function loadServerConfig(): ServerConfig {
  const serviceAccountBase64 = process.env.PRIVATE_FIREBASE_SERVICE_ACCOUNT_BASE64;

  if (!serviceAccountBase64) {
    // During build time, this might be undefined. We'll return null and check later.
    return { firebaseServiceAccount: null };
  }

  try {
    const decodedServiceAccount = Buffer.from(serviceAccountBase64, 'base64').toString('utf8');
    const serviceAccountJson = JSON.parse(decodedServiceAccount);
    
    return {
      firebaseServiceAccount: serviceAccountJson,
    };
  } catch (error) {
    console.error("Failed to parse Firebase service account JSON from Base64.", error);
    // Return null if parsing fails to avoid build-time crashes.
    return { firebaseServiceAccount: null };
  }
}

export const serverConfig = loadServerConfig();

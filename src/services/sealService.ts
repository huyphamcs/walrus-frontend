import { SealClient, SessionKey, DemType } from "@mysten/seal";
import type { SuiClient } from "@mysten/sui/client";
import type { Signer } from "@mysten/sui/cryptography";

// Package ID for the deployed Move contracts
export const PACKAGE_ID =
  "0xf34cf94924a884d7f27d500c26fdbeef46ae6ddcc11e4ba41b158540290c7bce";

// Seal testnet key servers configuration
// TODO: Replace with actual Seal testnet key server object IDs
// These are placeholder values - need to get from Seal documentation
const SEAL_KEY_SERVERS = [
  { objectId: "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75", weight: 1 },
  { objectId: "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8", weight: 1 },
  // { objectId: "0xKEY_SERVER_3_REPLACE_ME", weight: 1 },
];

const THRESHOLD = 2; // 2-out-of-2 key servers required
const SESSION_TTL_MIN = 30; // 30 minute session lifetime (max allowed)

/**
 * Initialize SealClient with testnet configuration
 */
export function initializeSealClient(suiClient: SuiClient): SealClient {
  return new SealClient({
    suiClient,
    serverConfigs: SEAL_KEY_SERVERS,
    verifyKeyServers: true,
    timeout: 30000, // 30 second timeout
  });
}

/**
 * Create a new session key for a user
 * Note: signMessage is a function from the wallet that signs arbitrary data
 */
export async function createSessionKey(
  address: string,
  signMessage: (input: { message: Uint8Array }) => Promise<{ signature: string }>,
  suiClient: SuiClient
): Promise<SessionKey> {
  // Create a minimal signer wrapper that implements the Signer interface
  // We only need signData for SessionKey creation
  const signer = {
    async getPublicKey() {
      // This method is required by Signer interface but may not be called
      throw new Error("getPublicKey not implemented");
    },
    async signData(data: Uint8Array) {
      const result = await signMessage({ message: data });
      // Convert base64 signature to Uint8Array
      const signatureBytes = new Uint8Array(
        atob(result.signature)
          .split("")
          .map((c) => c.charCodeAt(0))
      );
      return signatureBytes;
    },
  } as unknown as Signer;

  const sessionKey = await SessionKey.create({
    address,
    packageId: PACKAGE_ID,
    // mvrName is optional - omit it for now as we're using custom seal_approve functions
    ttlMin: SESSION_TTL_MIN,
    signer,
    suiClient,
  });

  // Save to localStorage
  saveSessionKey(address, sessionKey);

  return sessionKey;
}

/**
 * Save session key to localStorage
 */
export function saveSessionKey(address: string, sessionKey: SessionKey): void {
  const exported = sessionKey.export();
  const key = `seal-session-${address}`;
  localStorage.setItem(key, JSON.stringify(exported));
}

/**
 * Load session key from localStorage
 * Note: We cannot reload session keys because they require the signer
 * For now, just return null and force re-creation
 */
export function loadSessionKey(
  address: string,
  _suiClient: SuiClient,
  _signMessage: (input: { message: Uint8Array }) => Promise<{ signature: string }>
): SessionKey | null {
  // Session keys with wallet signers cannot be reliably reconstructed
  // because the signer interface is not serializable
  // Users will need to create a new session each time they reload the page
  const key = `seal-session-${address}`;
  const stored = localStorage.getItem(key);

  if (!stored) {
    return null;
  }

  // For now, we cannot reconstruct the session key
  // TODO: Implement session key reconstruction if Seal SDK supports it
  return null;
}

/**
 * Get existing session key or create a new one
 */
export async function getOrCreateSessionKey(
  address: string,
  signMessage: (input: { message: Uint8Array }) => Promise<{ signature: string }>,
  suiClient: SuiClient
): Promise<SessionKey> {
  // Try to load existing session (currently always returns null)
  const existingSession = loadSessionKey(address, suiClient, signMessage);
  if (existingSession) {
    return existingSession;
  }

  // Create new session
  return createSessionKey(address, signMessage, suiClient);
}

/**
 * Check if session key is valid (exists and not expired)
 */
export function isSessionValid(address: string): boolean {
  const key = `seal-session-${address}`;
  const stored = localStorage.getItem(key);

  if (!stored) {
    return false;
  }

  try {
    const exported = JSON.parse(stored);
    // Basic validation - full validation requires reconstruction with signer
    return exported && exported.ttlMin;
  } catch {
    return false;
  }
}

/**
 * Clear session key from localStorage
 */
export function clearSessionKey(address: string): void {
  const key = `seal-session-${address}`;
  localStorage.removeItem(key);
}

/**
 * Encrypt data for a specific allowlist
 * Returns encrypted bytes and symmetric key (store key securely as backup)
 */
export async function encryptData(
  data: Uint8Array,
  allowlistId: string,
  _sessionKey: SessionKey,
  sealClient: SealClient
): Promise<{ encryptedObject: Uint8Array; symmetricKey: Uint8Array }> {
  try {
    const result = await sealClient.encrypt({
      // kemType is optional - defaults to BonehFranklinBLS12381DemCCA
      demType: DemType.AesGcm256, // AES-256-GCM symmetric encryption
      threshold: THRESHOLD,
      packageId: PACKAGE_ID,
      id: allowlistId, // Use allowlist object ID as encryption identity
      data,
      aad: new TextEncoder().encode("walrus-marketplace"), // Additional authenticated data
    });

    return {
      encryptedObject: result.encryptedObject,
      symmetricKey: result.key,
    };
  } catch (error) {
    console.error("Encryption failed:", error);
    throw new Error(`Failed to encrypt data: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Decrypt data with access validation
 * Requires valid session key and seal_approve transaction proof
 */
export async function decryptData(
  encryptedData: Uint8Array,
  sessionKey: SessionKey,
  txBytes: Uint8Array,
  sealClient: SealClient
): Promise<Uint8Array> {
  try {
    const decryptedData = await sealClient.decrypt({
      data: encryptedData,
      sessionKey,
      txBytes,
      checkShareConsistency: true, // Verify all key shares are consistent
      checkLEEncoding: false, // Legacy encoding check
    });

    return decryptedData;
  } catch (error) {
    console.error("Decryption failed:", error);

    // Provide user-friendly error messages
    if (error instanceof Error) {
      if (error.message.includes("ENoAccess")) {
        throw new Error("Access denied: You are not in the allowlist");
      } else if (error.message.includes("threshold")) {
        throw new Error(
          "Key server error: Not enough servers responded (threshold not met)"
        );
      } else if (error.message.includes("expired")) {
        throw new Error("Session expired: Please create a new session key");
      }
    }

    throw new Error(`Failed to decrypt data: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Fetch decryption keys from Seal key servers
 * Must be called before decrypt()
 */
export async function fetchDecryptionKeys(
  allowlistIds: string[],
  txBytes: Uint8Array,
  sessionKey: SessionKey,
  sealClient: SealClient
): Promise<void> {
  try {
    await sealClient.fetchKeys({
      ids: allowlistIds,
      txBytes,
      sessionKey,
      threshold: THRESHOLD,
    });
  } catch (error) {
    console.error("Failed to fetch decryption keys:", error);
    throw new Error(`Failed to fetch keys: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

import { Transaction } from "@mysten/sui/transactions";
import type { SuiClient } from "@mysten/sui/client";
import { PACKAGE_ID } from "./sealService";

/**
 * Helper to convert hex string to byte array
 */
function hexToBytes(hex: string): number[] {
  // Remove 0x prefix if present
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;

  // Ensure even length
  const paddedHex = cleanHex.length % 2 === 0 ? cleanHex : "0" + cleanHex;

  const bytes: number[] = [];
  for (let i = 0; i < paddedHex.length; i += 2) {
    bytes.push(parseInt(paddedHex.slice(i, i + 2), 16));
  }

  return bytes;
}

/**
 * Create a new allowlist
 * Returns a transaction that creates an allowlist and transfers the Cap to the sender
 */
export function createAllowlistTransaction(name: string): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${PACKAGE_ID}::allowlist::create_allowlist_entry`,
    arguments: [tx.pure.string(name)],
  });

  return tx;
}

/**
 * Add a user to an allowlist
 * Requires the Cap object for authorization
 */
export function addUserToAllowlistTransaction(
  allowlistId: string,
  capId: string,
  userAddress: string
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${PACKAGE_ID}::allowlist::add`,
    arguments: [
      tx.object(allowlistId),
      tx.object(capId),
      tx.pure.address(userAddress),
    ],
  });

  return tx;
}

/**
 * Remove a user from an allowlist
 * Requires the Cap object for authorization
 */
export function removeUserFromAllowlistTransaction(
  allowlistId: string,
  capId: string,
  userAddress: string
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${PACKAGE_ID}::allowlist::remove`,
    arguments: [
      tx.object(allowlistId),
      tx.object(capId),
      tx.pure.address(userAddress),
    ],
  });

  return tx;
}

/**
 * Publish a blob to an allowlist
 * Associates a blob ID with an allowlist for access control
 * Requires the Cap object for authorization
 */
export function publishBlobToAllowlistTransaction(
  allowlistId: string,
  capId: string,
  blobId: string
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${PACKAGE_ID}::allowlist::publish`,
    arguments: [
      tx.object(allowlistId),
      tx.object(capId),
      tx.pure.string(blobId),
    ],
  });

  return tx;
}

/**
 * Build seal_approve transaction for access validation
 * This transaction proves the user has access to decrypt the blob
 * IMPORTANT: This transaction should be built but NOT executed
 * The transaction bytes are used by Seal key servers to validate access
 */
export async function buildSealApproveTransaction(
  allowlistId: string,
  blobId: string,
  suiClient: SuiClient
): Promise<Uint8Array> {
  const tx = new Transaction();

  // Convert blob ID to byte array for the Move contract
  const blobIdBytes = hexToBytes(blobId);

  tx.moveCall({
    target: `${PACKAGE_ID}::allowlist::seal_approve`,
    arguments: [
      tx.pure.vector("u8", blobIdBytes),
      tx.object(allowlistId),
    ],
  });

  // Build transaction bytes WITHOUT executing
  const txBytes = await tx.build({ client: suiClient });

  return txBytes;
}

/**
 * Query objects owned by an address
 * Useful for finding user's owned Caps and Allowlists
 */
export async function queryUserObjects(
  address: string,
  suiClient: SuiClient,
  objectType: "allowlist" | "cap"
): Promise<any[]> {
  try {
    const structType =
      objectType === "allowlist"
        ? `${PACKAGE_ID}::allowlist::Allowlist`
        : `${PACKAGE_ID}::allowlist::Cap`;

    const objects = await suiClient.getOwnedObjects({
      owner: address,
      filter: {
        StructType: structType,
      },
      options: {
        showContent: true,
        showType: true,
      },
    });

    return objects.data || [];
  } catch (error) {
    console.error(`Failed to query ${objectType} objects:`, error);
    return [];
  }
}

/**
 * Get allowlist details including members
 */
export async function getAllowlistDetails(
  allowlistId: string,
  suiClient: SuiClient
): Promise<{
  id: string;
  name: string;
  list: string[];
} | null> {
  try {
    const object = await suiClient.getObject({
      id: allowlistId,
      options: {
        showContent: true,
      },
    });

    if (object.data && object.data.content && "fields" in object.data.content) {
      const fields = object.data.content.fields as any;
      return {
        id: fields.id?.id || allowlistId,
        name: fields.name || "Unknown",
        list: fields.list || [],
      };
    }

    return null;
  } catch (error) {
    console.error("Failed to get allowlist details:", error);
    return null;
  }
}

/**
 * Get namespace bytes for an allowlist
 * The namespace is the allowlist object ID as bytes
 */
export function getAllowlistNamespace(allowlistId: string): number[] {
  return hexToBytes(allowlistId);
}

/**
 * Verify that a blob ID has the correct namespace prefix
 * For Seal encryption to work, the blob ID must start with the allowlist namespace
 */
export function verifyBlobNamespace(
  blobId: string,
  allowlistId: string
): boolean {
  const blobBytes = hexToBytes(blobId);
  const namespaceBytes = getAllowlistNamespace(allowlistId);

  // Check if blob ID starts with allowlist namespace
  if (blobBytes.length < namespaceBytes.length) {
    return false;
  }

  for (let i = 0; i < namespaceBytes.length; i++) {
    if (blobBytes[i] !== namespaceBytes[i]) {
      return false;
    }
  }

  return true;
}

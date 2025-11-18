import type { SuiClient } from "@mysten/sui/client";
import { WalrusClient } from "@mysten/walrus";
import { getFullnodeUrl } from "@mysten/sui/client";
import walrusWasmUrl from '@mysten/walrus-wasm/web/walrus_wasm_bg.wasm?url';

// Walrus configuration
const AGGREGATOR_URL = "https://aggregator.walrus-testnet.walrus.space";
const PUBLISHER_URL = "https://publisher.walrus-testnet.walrus.space";

// Number of epochs for which the blob should be stored
const EPOCHS = 5;


/**
 * Upload a file to Walrus using HTTP publisher
 * @param file - The file to upload
 * @returns The blob ID of the uploaded file
 */
export async function uploadToWalrus(file: File): Promise<string> {
  try {
    // Convert file to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();

    // Use HTTP publisher endpoint directly - correct endpoint is /v1/blobs
    const response = await fetch(`${PUBLISHER_URL}/v1/blobs?epochs=${EPOCHS}`, {
      method: "PUT",
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: arrayBuffer,
    });

    if (!response.ok) {
      let errorText = await response.text();
      console.error("Upload failed with status:", response.status, errorText);
      throw new Error(`Upload failed (${response.status}): ${errorText || 'No error message'}`);
    }

    const result = await response.json();
    console.log("Upload response:", result);

    // Extract blob ID from response
    if (result.newlyCreated?.blobObject?.blobId) {
      return result.newlyCreated.blobObject.blobId;
    } else if (result.alreadyCertified?.blobId) {
      return result.alreadyCertified.blobId;
    } else if (result.blobId) {
      // Sometimes the response is simpler
      return result.blobId;
    } else {
      console.error("Unexpected response format:", result);
      throw new Error("Unexpected response format from Walrus");
    }
  } catch (error) {
    console.error("Error uploading to Walrus:", error);
    throw new Error(
      `Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Download a file from Walrus using HTTP aggregator
 * This works for files uploaded via the HTTP publisher endpoint (uploadToWalrus)
 * @param blobId - The blob ID to download
 * @returns The file data as a Blob
 */
export async function downloadFromWalrus(blobId: string): Promise<Blob> {
  try {
    // Use HTTP aggregator endpoint to fetch the blob - correct endpoint is /v1/blobs/<blob-id>
    const response = await fetch(`${AGGREGATOR_URL}/v1/blobs/${blobId}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Download failed with status:", response.status, errorText);
      throw new Error(`Download failed (${response.status}): ${errorText || 'No error message'}`);
    }

    return await response.blob();
  } catch (error) {
    console.error("Error downloading from Walrus:", error);
    throw new Error(
      `Failed to download file: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Download a file from Walrus using the Walrus SDK
 * This works for files uploaded via the transaction-based flow (uploadToWalrusWithAccount)
 * Uses readBlob to directly read raw blob data (not quilts)
 * @param blobId - The blob ID to download
 * @param suiClient - SuiClient instance with Walrus extension
 * @returns The file data as a Blob
 */
export async function downloadFromWalrusWithAccount(
  blobId: string,
  suiClient: SuiClient & {
    walrus?: WalrusClient;
    walrusWithRelay?: WalrusClient;
    walrusWithoutRelay?: WalrusClient;
  }
): Promise<Blob> {
  try {
    // Initialize Walrus client if not already initialized
    let walrusClient = suiClient.walrus;

    if (!walrusClient) {
      walrusClient = new WalrusClient({
        network: 'testnet',
        suiRpcUrl: getFullnodeUrl('testnet'),
        wasmUrl: walrusWasmUrl
      });
    }

    console.log("Downloading blob from Walrus using SDK:", blobId);

    // Use the Walrus SDK to read the raw blob - this properly decodes the data
    const fileData = await walrusClient.readBlob({ blobId });

    console.log("Successfully downloaded and decoded blob from Walrus");
    console.log("Blob size:", fileData.length, "bytes");

    // Convert to Blob - create a new Uint8Array to ensure type compatibility
    return new Blob([new Uint8Array(fileData)]);
  } catch (error) {
    console.error("Error downloading from Walrus with account:", error);
    throw new Error(
      `Failed to download file with account: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Get the HTTP URL for a blob on Walrus
 * @param blobId - The blob ID
 * @returns The HTTP URL to access the blob
 */
export function getWalrusUrl(blobId: string): string {
  return `${AGGREGATOR_URL}/v1/blobs/${blobId}`;
}

/**
 * Upload a file to Walrus with user's account owning the blob from the start
 * Uses the Walrus Blob Flow API to write raw blob data (not quilts)
 * Step 1: Create blob upload flow with raw file data
 * Step 2: Encode blob (WASM)
 * Step 3: Create blob registration transaction with user as owner
 * Step 4: Sign and execute transaction
 * Step 5: Upload blob data to storage nodes with transaction digest
 * Step 6: Certify the blob with another transaction
 * @param file - The file to upload
 * @param signAndExecuteTransaction - Function to sign and execute transactions from the wallet
 * @param suiClient - SuiClient instance
 * @param userAddress - The user's Sui address (will be the owner of the blob)
 * @returns The blob ID of the uploaded file
 */
export async function uploadToWalrusWithAccount(
  file: File,
  signAndExecuteTransaction: (input: any) => Promise<any>,
  _suiClient: SuiClient & {
    walrus?: WalrusClient;
    walrusWithRelay?: WalrusClient;
    walrusWithoutRelay?: WalrusClient;
  },
  userAddress: string
): Promise<string> {
  try {
    // Normalize user address (ensure it has 0x prefix)
    const normalizedAddress = userAddress.startsWith('0x') ? userAddress : `0x${userAddress}`;

    // Initialize Walrus client
    const walrusClient = new WalrusClient({
      network: 'testnet',
      suiRpcUrl: getFullnodeUrl('testnet'),
      wasmUrl: walrusWasmUrl
    });

    // Convert file to raw bytes
    const fileData = new Uint8Array(await file.arrayBuffer());

    // Step 1: Create blob upload flow (writes raw blob, not quilt)
    console.log("Step 1: Creating blob upload flow...");
    const flow = walrusClient.writeBlobFlow({
      blob: fileData
    });

    // Step 2: Encode the blob (WASM step - prepares blob for storage)
    console.log("Step 2: Encoding blob...");
    await flow.encode();

    // Step 3: Create registration transaction (blob will be owned by user)
    console.log("Step 3: Creating registration transaction...");
    const tx = flow.register({
      epochs: EPOCHS,
      owner: normalizedAddress,
      deletable: true,
    });

    // Step 4: Sign and execute the transaction
    console.log("Step 4: Signing and executing registration transaction...");
    const txResult = await signAndExecuteTransaction({
      transaction: tx,
    });

    console.log("Transaction executed:", txResult);

    if (!txResult.digest) {
      throw new Error("No transaction digest returned");
    }

    // Step 5: Upload the blob data to storage nodes using transaction digest
    console.log("Step 5: Uploading blob data to storage nodes...");
    await flow.upload({ digest: txResult.digest });

    // Step 6: Certify the blob
    console.log("Step 6: Certifying blob...");
    const certifyTransaction = flow.certify();
    await signAndExecuteTransaction({transaction: certifyTransaction});

    // Get the blob ID from the flow
    const blobResult = await flow.getBlob();
    if (!blobResult.blobId) {
      throw new Error("Failed to get blob ID from upload");
    }

    const blobId = blobResult.blobId;
    console.log("Blob uploaded successfully with ID:", blobId);
    console.log("Blob is owned by:", normalizedAddress);

    return blobId;
  } catch (error) {
    console.error("Error uploading to Walrus with account:", error);
    throw new Error(
      `Failed to upload file with account: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Format file size to human-readable format
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

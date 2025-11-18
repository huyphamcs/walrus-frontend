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
 * Download a file from Walrus
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
 * Get the HTTP URL for a blob on Walrus
 * @param blobId - The blob ID
 * @returns The HTTP URL to access the blob
 */
export function getWalrusUrl(blobId: string): string {
  return `${AGGREGATOR_URL}/v1/blobs/${blobId}`;
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

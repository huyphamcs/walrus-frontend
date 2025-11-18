import { useState } from "react";
import { Card, Flex, Text, TextField, Button, SegmentedControl, Callout } from "@radix-ui/themes";
import { DownloadIcon, InfoCircledIcon } from "@radix-ui/react-icons";
import { useSuiClient } from "@mysten/dapp-kit";
import { downloadFromWalrus, downloadFromWalrusWithAccount } from "../services/walrus";

type DownloadMode = "http" | "sdk";

export function BlobDownload() {
  const suiClient = useSuiClient();
  const [blobId, setBlobId] = useState("");
  const [downloadMode, setDownloadMode] = useState<DownloadMode>("http");
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleDownload = async () => {
    if (!blobId.trim()) {
      setError("Please enter a blob ID");
      return;
    }

    setIsDownloading(true);
    setError(null);
    setSuccess(null);

    try {
      let blob: Blob;

      if (downloadMode === "http") {
        // HTTP download for files uploaded via publisher
        blob = await downloadFromWalrus(blobId.trim());
      } else {
        // SDK download for files uploaded via transaction
        blob = await downloadFromWalrusWithAccount(blobId.trim(), suiClient);
      }

      // Generate filename from blob ID
      const filename = `walrus_${blobId.trim().slice(0, 8)}.bin`;

      // Trigger download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setSuccess(`File downloaded successfully as ${filename}`);
    } catch (err) {
      console.error("Download error:", err);
      setError(err instanceof Error ? err.message : "Failed to download file");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isDownloading) {
      handleDownload();
    }
  };

  return (
    <Card>
      <Flex direction="column" gap="4">
        <Flex direction="column" gap="2">
          <Text size="4" weight="bold">
            Download File by Blob ID
          </Text>
          <Text size="2" color="gray">
            Enter a Walrus blob ID to download the file from the network
          </Text>
        </Flex>

        <Callout.Root color="blue" size="1">
          <Callout.Icon>
            <InfoCircledIcon />
          </Callout.Icon>
          <Callout.Text size="1">
            Select the correct download method based on how the file was uploaded:
            <br />
            • <strong>HTTP</strong>: For files uploaded via Testnet (Free) mode
            <br />
            • <strong>SDK</strong>: For files uploaded via Signed Account mode
          </Callout.Text>
        </Callout.Root>

        {/* Download Method Selector */}
        <Flex direction="column" gap="2">
          <Text size="2" weight="medium">
            Download Method
          </Text>
          <SegmentedControl.Root value={downloadMode} onValueChange={(value) => setDownloadMode(value as DownloadMode)}>
            <SegmentedControl.Item value="http">HTTP (Publisher)</SegmentedControl.Item>
            <SegmentedControl.Item value="sdk">SDK (Transaction)</SegmentedControl.Item>
          </SegmentedControl.Root>
        </Flex>

        {/* Blob ID Input */}
        <Flex direction="column" gap="2">
          <Text size="2" weight="medium">
            Blob ID
          </Text>
          <TextField.Root
            placeholder="Enter blob ID (e.g., tTp2nPBqo2U1Bt8hH0I7fbzTtPqhKgMB9u82jMmwmD0)"
            value={blobId}
            onChange={(e) => {
              setBlobId(e.target.value);
              setError(null);
              setSuccess(null);
            }}
            onKeyPress={handleKeyPress}
            disabled={isDownloading}
            size="3"
          />
        </Flex>

        {/* Download Button */}
        <Button
          size="3"
          onClick={handleDownload}
          disabled={isDownloading || !blobId.trim()}
          style={{ cursor: isDownloading || !blobId.trim() ? "not-allowed" : "pointer" }}
        >
          <DownloadIcon width="16" height="16" />
          {isDownloading ? "Downloading..." : "Download File"}
        </Button>

        {/* Error Message */}
        {error && (
          <Callout.Root color="red" size="2">
            <Callout.Icon>
              <InfoCircledIcon />
            </Callout.Icon>
            <Callout.Text>{error}</Callout.Text>
          </Callout.Root>
        )}

        {/* Success Message */}
        {success && (
          <Callout.Root color="green" size="2">
            <Callout.Icon>
              <InfoCircledIcon />
            </Callout.Icon>
            <Callout.Text>{success}</Callout.Text>
          </Callout.Root>
        )}

        {/* Example Blob IDs */}
        <Flex direction="column" gap="2" mt="2">
          <Text size="2" weight="medium" color="gray">
            Need help?
          </Text>
          <Text size="1" color="gray">
            Make sure the blob ID is complete and correct. You can find blob IDs in your "Uploaded Files" list
            or from Walrus explorer.
          </Text>
        </Flex>
      </Flex>
    </Card>
  );
}

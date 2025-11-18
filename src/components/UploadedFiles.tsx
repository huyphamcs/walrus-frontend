import { useState } from "react";
import {
  Card,
  Flex,
  Text,
  Table,
  Badge,
  IconButton,
  Tooltip,
} from "@radix-ui/themes";
import {
  DownloadIcon,
  CopyIcon,
  TrashIcon,
  CheckIcon,
} from "@radix-ui/react-icons";
import { downloadFromWalrus, downloadFromWalrusWithAccount, formatFileSize, getWalrusUrl } from "../services/walrus";
import { useSuiClient } from "@mysten/dapp-kit";

export interface UploadedFile {
  blobId: string;
  fileName: string;
  fileSize: number;
  uploadedAt: Date;
  uploadMethod?: "http" | "transaction"; // Track which upload method was used
}

interface UploadedFilesProps {
  files: UploadedFile[];
  onRemove: (blobId: string) => void;
}

export function UploadedFiles({ files, onRemove }: UploadedFilesProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const suiClient = useSuiClient();

  const handleDownload = async (file: UploadedFile) => {
    setDownloadingId(file.blobId);
    try {
      // Use the appropriate download method based on how the file was uploaded
      const blob = file.uploadMethod === "transaction"
        ? await downloadFromWalrusWithAccount(file.blobId, suiClient)
        : await downloadFromWalrus(file.blobId);

      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      alert("Failed to download file");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCopyBlobId = async (blobId: string) => {
    try {
      await navigator.clipboard.writeText(blobId);
      setCopiedId(blobId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Error copying to clipboard:", error);
    }
  };

  const handleCopyUrl = async (blobId: string) => {
    try {
      const url = getWalrusUrl(blobId);
      await navigator.clipboard.writeText(url);
      setCopiedId(blobId + "_url");
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Error copying to clipboard:", error);
    }
  };

  if (files.length === 0) {
    return (
      <Card>
        <Flex direction="column" align="center" gap="2" py="6">
          <Text size="3" color="gray">
            No files uploaded yet
          </Text>
          <Text size="2" color="gray">
            Upload a file to get started
          </Text>
        </Flex>
      </Card>
    );
  }

  return (
    <Card>
      <Flex direction="column" gap="3">
        <Flex justify="between" align="center">
          <Text size="4" weight="bold">
            Uploaded Files
          </Text>
          <Badge color="blue">{files.length} file{files.length !== 1 ? "s" : ""}</Badge>
        </Flex>

        <Table.Root variant="surface">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>File Name</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Size</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Blob ID</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Uploaded</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {files.map((file) => (
              <Table.Row key={file.blobId}>
                <Table.Cell>
                  <Text size="2" weight="medium">
                    {file.fileName}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2" color="gray">
                    {formatFileSize(file.fileSize)}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Flex align="center" gap="2">
                    <Text
                      size="2"
                      style={{
                        fontFamily: "monospace",
                        maxWidth: "150px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {file.blobId}
                    </Text>
                    <Tooltip content={copiedId === file.blobId ? "Copied!" : "Copy Blob ID"}>
                      <IconButton
                        size="1"
                        variant="ghost"
                        onClick={() => handleCopyBlobId(file.blobId)}
                      >
                        {copiedId === file.blobId ? (
                          <CheckIcon width="12" height="12" />
                        ) : (
                          <CopyIcon width="12" height="12" />
                        )}
                      </IconButton>
                    </Tooltip>
                  </Flex>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2" color="gray">
                    {new Date(file.uploadedAt).toLocaleString()}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Flex gap="2">
                    <Tooltip content="Download file">
                      <IconButton
                        size="2"
                        variant="soft"
                        onClick={() => handleDownload(file)}
                        disabled={downloadingId === file.blobId}
                      >
                        <DownloadIcon width="14" height="14" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip content={copiedId === file.blobId + "_url" ? "Copied!" : "Copy Walrus URL"}>
                      <IconButton
                        size="2"
                        variant="soft"
                        onClick={() => handleCopyUrl(file.blobId)}
                      >
                        {copiedId === file.blobId + "_url" ? (
                          <CheckIcon width="14" height="14" />
                        ) : (
                          <CopyIcon width="14" height="14" />
                        )}
                      </IconButton>
                    </Tooltip>
                    <Tooltip content="Remove from list">
                      <IconButton
                        size="2"
                        variant="soft"
                        color="red"
                        onClick={() => onRemove(file.blobId)}
                      >
                        <TrashIcon width="14" height="14" />
                      </IconButton>
                    </Tooltip>
                  </Flex>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Flex>
    </Card>
  );
}

import { useState, useRef } from "react";
import { Card, Flex, Text, Progress, SegmentedControl, Callout } from "@radix-ui/themes";
import { UploadIcon, InfoCircledIcon } from "@radix-ui/react-icons";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { uploadToWalrus, uploadToWalrusWithAccount } from "../services/walrus";

interface FileUploadProps {
  onUploadSuccess: (blobId: string, fileName: string, fileSize: number, uploadMethod: "http" | "transaction") => void;
}

type UploadMode = "testnet" | "account";

export function FileUpload({ onUploadSuccess }: FileUploadProps) {
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();
  
  const [uploadMode, setUploadMode] = useState<UploadMode>("testnet");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFileUpload(files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      let blobId: string;

      if (uploadMode === "testnet") {
        // Use HTTP testnet endpoint
        blobId = await uploadToWalrus(file);
      } else {
        // Use account-based upload with transaction signing
        if (!currentAccount?.address) {
          throw new Error("No account connected");
        }

        blobId = await uploadToWalrusWithAccount(
          file,
          signAndExecuteTransaction,
          suiClient,
          currentAccount.address
        );
      }

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Success callback - pass the upload method used
      onUploadSuccess(blobId, file.name, file.size, uploadMode === "testnet" ? "http" : "transaction");

      // Reset state after a short delay
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload file");
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card>
      <Flex direction="column" gap="4">
        {/* Upload Mode Selector */}
        <Flex direction="column" gap="2">
          <Text size="2" weight="medium">
            Upload Method
          </Text>
          <SegmentedControl.Root value={uploadMode} onValueChange={(value) => currentAccount && setUploadMode(value as UploadMode)}>
            <SegmentedControl.Item value="testnet">Testnet (Free)</SegmentedControl.Item>
            <SegmentedControl.Item value="account">Signed Account</SegmentedControl.Item>
          </SegmentedControl.Root>
          {uploadMode === "account" && currentAccount && (
            <Callout.Root color="blue" size="1">
              <Callout.Icon>
                <InfoCircledIcon />
              </Callout.Icon>
              <Callout.Text size="1">
                Upload will be signed by your wallet. You'll be prompted to approve the transaction.
              </Callout.Text>
            </Callout.Root>
          )}
        </Flex>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${isDragging ? "var(--accent-9)" : "var(--gray-7)"}`,
            borderRadius: "var(--radius-3)",
            padding: "3rem",
            textAlign: "center",
            cursor: "pointer",
            backgroundColor: isDragging ? "var(--accent-a2)" : "transparent",
            transition: "all 0.2s ease",
          }}
          onClick={handleButtonClick}
        >
          <Flex direction="column" align="center" gap="3">
            <UploadIcon width="32" height="32" />
            <Text size="3" weight="medium">
              Drag and drop your file here
            </Text>
            <Text size="2" color="gray">
              or click to browse
            </Text>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              style={{ display: "none" }}
              disabled={isUploading}
            />
          </Flex>
        </div>

        {isUploading && (
          <Flex direction="column" gap="2">
            <Text size="2" color="gray">
              Uploading to Walrus...
            </Text>
            <Progress value={uploadProgress} />
          </Flex>
        )}

        {error && (
          <Text size="2" color="red">
            {error}
          </Text>
        )}
      </Flex>
    </Card>
  );
}

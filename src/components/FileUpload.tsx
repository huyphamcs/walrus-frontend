import { useState, useRef } from "react";
import { Button, Card, Flex, Text, Progress } from "@radix-ui/themes";
import { UploadIcon } from "@radix-ui/react-icons";
import { uploadToWalrus } from "../services/walrus";

interface FileUploadProps {
  onUploadSuccess: (blobId: string, fileName: string, fileSize: number) => void;
}

export function FileUpload({ onUploadSuccess }: FileUploadProps) {
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

      const blobId = await uploadToWalrus(file);

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Success callback
      onUploadSuccess(blobId, file.name, file.size);

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

import { useState, useEffect } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { Box, Container, Flex, Heading, Text, Callout } from "@radix-ui/themes";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { FileUpload } from "./components/FileUpload";
import { UploadedFiles, UploadedFile } from "./components/UploadedFiles";
import { AccountButton } from "./components/AccountButton";

function App() {
  const currentAccount = useCurrentAccount();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  // Load files from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("walrus-uploaded-files");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Convert uploadedAt back to Date objects
        const files = parsed.map((file: any) => ({
          ...file,
          uploadedAt: new Date(file.uploadedAt),
        }));
        setUploadedFiles(files);
      } catch (error) {
        console.error("Error loading files from localStorage:", error);
      }
    }
  }, []);

  // Save files to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("walrus-uploaded-files", JSON.stringify(uploadedFiles));
  }, [uploadedFiles]);

  const handleUploadSuccess = (blobId: string, fileName: string, fileSize: number, uploadMethod: "http" | "transaction") => {
    const newFile: UploadedFile = {
      blobId,
      fileName,
      fileSize,
      uploadedAt: new Date(),
      uploadMethod,
    };
    setUploadedFiles((prev) => [newFile, ...prev]);
  };

  const handleRemoveFile = (blobId: string) => {
    setUploadedFiles((prev) => prev.filter((file) => file.blobId !== blobId));
  };

  return (
    <>
      <Flex
        position="sticky"
        px="4"
        py="2"
        justify="between"
        style={{
          borderBottom: "1px solid var(--gray-a2)",
        }}
      >
        <Box>
          <Heading>Walrus File Storage</Heading>
        </Box>

        <Box>
          <AccountButton />
        </Box>
      </Flex>
      <Container>
        <Container
          mt="5"
          pt="2"
          px="4"
          style={{ background: "var(--gray-a2)", minHeight: 500 }}
        >
          <Flex direction="column" gap="5">
            <Box>
              <Heading size="6" mb="2">
                Upload Files to Walrus
              </Heading>
              <Text color="gray" size="2">
                Upload any type of file to the Walrus decentralized storage network.
                Your files will be stored for 5 epochs and can be downloaded with unchanged data.
              </Text>
            </Box>

            {!currentAccount && (
              <Callout.Root color="blue">
                <Callout.Icon>
                  <InfoCircledIcon />
                </Callout.Icon>
                <Callout.Text>
                  Connect your wallet to start uploading files to Walrus.
                </Callout.Text>
              </Callout.Root>
            )}

            {currentAccount && (
              <>
                <FileUpload onUploadSuccess={handleUploadSuccess} />
                <UploadedFiles files={uploadedFiles} onRemove={handleRemoveFile} />
              </>
            )}
          </Flex>
        </Container>
      </Container>
    </>
  );
}

export default App;

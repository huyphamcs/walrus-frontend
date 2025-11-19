import { useState, useEffect, useRef } from "react";
import {
  Box,
  Container,
  Flex,
  Heading,
  Text,
  Button,
  TextField,
  Card,
  Separator,
  Select,
  Callout,
} from "@radix-ui/themes";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
  useSignPersonalMessage,
} from "@mysten/dapp-kit";
import type { SessionKey } from "@mysten/seal";
import {
  initializeSealClient,
  getOrCreateSessionKey,
  clearSessionKey,
  isSessionValid,
  encryptData,
  decryptData,
  fetchDecryptionKeys,
} from "../services/sealService";
import {
  createAllowlistTransaction,
  addUserToAllowlistTransaction,
  removeUserFromAllowlistTransaction,
  publishBlobToAllowlistTransaction,
  buildSealApproveTransaction,
  getAllowlistDetails,
} from "../services/contractService";
import {
  uploadToWalrusWithAccount,
  downloadFromWalrusWithAccount,
} from "../services/walrus";

// Type definitions
interface AllowlistInfo {
  id: string;
  name: string;
  capId: string;
}

interface UploadedContent {
  blobId: string;
  fileName: string;
  allowlistId: string;
  uploadedAt: number;
}

export function DataMarketplace() {
  // Wallet and blockchain hooks
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction } =
    useSignAndExecuteTransaction();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const suiClient = useSuiClient();

  // Session state
  const [sessionKey, setSessionKey] = useState<SessionKey | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string>("");

  // Creator state
  const [allowlistName, setAllowlistName] = useState("");
  const [myAllowlists, setMyAllowlists] = useState<AllowlistInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedAllowlistId, setSelectedAllowlistId] = useState("");
  const [uploadedContents, setUploadedContents] = useState<UploadedContent[]>(
    []
  );

  // Manager state
  const [manageAllowlistId, setManageAllowlistId] = useState("");
  const [manageCapId, setManageCapId] = useState("");
  const [addressToAdd, setAddressToAdd] = useState("");
  const [allowlistMembers, setAllowlistMembers] = useState<string[]>([]);

  // Consumer state
  const [consumerBlobId, setConsumerBlobId] = useState("");
  const [consumerAllowlistId, setConsumerAllowlistId] = useState("");
  const [downloadedData, setDownloadedData] = useState<Blob | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Seal client
  const sealClient = initializeSealClient(suiClient);

  // Load uploaded contents from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("marketplace-uploads");
    if (stored) {
      try {
        setUploadedContents(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to load uploaded contents:", e);
      }
    }
  }, []);

  // Save uploaded contents to localStorage
  useEffect(() => {
    localStorage.setItem("marketplace-uploads", JSON.stringify(uploadedContents));
  }, [uploadedContents]);

  // Check session validity on account change
  useEffect(() => {
    if (account?.address) {
      const valid = isSessionValid(account.address);
      setSessionStatus(
        valid ? "Session active" : "No session - create one to proceed"
      );
    } else {
      setSessionStatus("Please connect wallet");
      setSessionKey(null);
    }
  }, [account]);

  // Session Management Functions
  const handleCreateSession = async () => {
    if (!account?.address) {
      setError("Please connect wallet first");
      return;
    }

    setLoading(true);
    setError("");
    setStatus("Creating session key...");

    try {
      // Create a wrapper for signPersonalMessage that matches the expected signature
      const signMessageWrapper = async (input: { message: Uint8Array }) => {
        const result = await signPersonalMessage({ message: input.message });
        return { signature: result.signature };
      };

      const session = await getOrCreateSessionKey(
        account.address,
        signMessageWrapper,
        suiClient
      );

      setSessionKey(session);
      setSessionStatus("Session created successfully");
      setStatus("Session key created and saved to localStorage");
    } catch (err) {
      console.error("Session creation error:", err);
      setError(`Failed to create session: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClearSession = () => {
    if (account?.address) {
      clearSessionKey(account.address);
      setSessionKey(null);
      setSessionStatus("Session cleared");
      setStatus("Session key removed from localStorage");
    }
  };

  // Creator Functions
  const handleCreateAllowlist = async () => {
    if (!account?.address) {
      setError("Please connect wallet");
      return;
    }

    if (!allowlistName.trim()) {
      setError("Please enter an allowlist name");
      return;
    }

    setLoading(true);
    setError("");
    setStatus("Creating allowlist...");

    try {
      const tx = createAllowlistTransaction(allowlistName);

      const result = await signAndExecuteTransaction({
        transaction: tx,
      });

      // Wait for transaction and get full effects
      const txResult = result as any;
      console.log("Transaction result:", txResult);

      // Use the digest to query the full transaction details
      const txDetails = await suiClient.waitForTransaction({
        digest: txResult.digest,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      console.log("Transaction details:", txDetails);

      // Extract created objects from objectChanges
      const createdObjects = txDetails.objectChanges?.filter(
        (change: any) => change.type === "created"
      );

      if (createdObjects && createdObjects.length > 0) {
        let capId = "";
        let allowlistId = "";

        for (const obj of createdObjects) {
          console.log("Created object:", obj);

          // Type guard: check if this is a created object (not published package)
          if (obj.type === "created" && "objectType" in obj && "objectId" in obj) {
            if (obj.objectType?.includes("::allowlist::Cap")) {
              capId = obj.objectId;
            } else if (obj.objectType?.includes("::allowlist::Allowlist")) {
              allowlistId = obj.objectId;
            }
          }
        }

        if (allowlistId && capId) {
          const newAllowlist: AllowlistInfo = {
            id: allowlistId,
            name: allowlistName,
            capId: capId,
          };

          setMyAllowlists([...myAllowlists, newAllowlist]);
          setStatus(
            `Allowlist created!\nAllowlist ID: ${allowlistId}\nCap ID: ${capId}`
          );
          setAllowlistName("");
        } else {
          setError("Could not find Allowlist and Cap in transaction result");
        }
      } else {
        setError("Transaction succeeded but no objects were created");
      }
    } catch (err) {
      console.error("Allowlist creation error:", err);
      setError(`Failed to create allowlist: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEncryptAndUpload = async () => {
    if (!account?.address) {
      setError("Please connect wallet");
      return;
    }

    if (!sessionKey) {
      setError("Please create a session key first");
      return;
    }

    if (!selectedFile) {
      setError("Please select a file");
      return;
    }

    if (!selectedAllowlistId) {
      setError("Please select an allowlist");
      return;
    }

    setLoading(true);
    setError("");
    setStatus("Step 1/5: Reading file...");

    try {
      // Step 1: Read file
      const fileBytes = new Uint8Array(await selectedFile.arrayBuffer());
      setStatus(`Step 2/5: Encrypting ${selectedFile.name} (${fileBytes.length} bytes)...`);

      // Step 2: Encrypt with Seal
      const { encryptedObject } = await encryptData(
        fileBytes,
        selectedAllowlistId,
        sessionKey,
        sealClient
      );

      setStatus(`Step 3/5: Uploading encrypted data to Walrus (${encryptedObject.length} bytes)...`);

      // Step 3: Upload to Walrus
      // Convert Uint8Array to File for upload
      // Create a new Uint8Array to ensure proper type
      const encryptedBytes = new Uint8Array(encryptedObject);
      const encryptedFile = new File(
        [encryptedBytes],
        `encrypted-${selectedFile.name}`,
        { type: "application/octet-stream" }
      );

      const blobId = await uploadToWalrusWithAccount(
        encryptedFile,
        signAndExecuteTransaction,
        suiClient,
        account.address
      );

      setStatus(`Step 4/5: Publishing blob to allowlist...`);

      // Step 4: Publish to allowlist
      const allowlist = myAllowlists.find((a) => a.id === selectedAllowlistId);
      if (!allowlist) {
        throw new Error("Selected allowlist not found");
      }

      const publishTx = publishBlobToAllowlistTransaction(
        selectedAllowlistId,
        allowlist.capId,
        blobId
      );

      await signAndExecuteTransaction({
        transaction: publishTx,
      });

      setStatus(`Step 5/5: Finalizing...`);

      // Save upload info
      const newUpload: UploadedContent = {
        blobId,
        fileName: selectedFile.name,
        allowlistId: selectedAllowlistId,
        uploadedAt: Date.now(),
      };

      setUploadedContents([...uploadedContents, newUpload]);

      setStatus(
        `✅ Success! Encrypted and uploaded ${selectedFile.name}\nBlob ID: ${blobId}\nAllowlist: ${selectedAllowlistId}`
      );

      // Reset form
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError(`Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  // Manager Functions
  const handleLoadAllowlist = async () => {
    if (!manageAllowlistId) {
      setError("Please enter allowlist ID");
      return;
    }

    setLoading(true);
    setError("");
    setStatus("Loading allowlist details...");

    try {
      const details = await getAllowlistDetails(manageAllowlistId, suiClient);

      if (details) {
        setAllowlistMembers(details.list);
        setStatus(`Loaded allowlist: ${details.name} (${details.list.length} members)`);
      } else {
        setError("Allowlist not found or unable to load");
      }
    } catch (err) {
      console.error("Load allowlist error:", err);
      setError(`Failed to load allowlist: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!manageAllowlistId || !manageCapId || !addressToAdd) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError("");
    setStatus("Adding user to allowlist...");

    try {
      const tx = addUserToAllowlistTransaction(
        manageAllowlistId,
        manageCapId,
        addressToAdd
      );

      await signAndExecuteTransaction({
        transaction: tx,
      });

      setStatus(`✅ User ${addressToAdd} added to allowlist`);
      setAddressToAdd("");

      // Reload allowlist
      await handleLoadAllowlist();
    } catch (err) {
      console.error("Add user error:", err);
      setError(`Failed to add user: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUser = async () => {
    if (!manageAllowlistId || !manageCapId || !addressToAdd) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError("");
    setStatus("Removing user from allowlist...");

    try {
      const tx = removeUserFromAllowlistTransaction(
        manageAllowlistId,
        manageCapId,
        addressToAdd
      );

      await signAndExecuteTransaction({
        transaction: tx,
      });

      setStatus(`✅ User ${addressToAdd} removed from allowlist`);
      setAddressToAdd("");

      // Reload allowlist
      await handleLoadAllowlist();
    } catch (err) {
      console.error("Remove user error:", err);
      setError(`Failed to remove user: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  // Consumer Functions
  const handleDownloadAndDecrypt = async () => {
    if (!account?.address) {
      setError("Please connect wallet");
      return;
    }

    if (!sessionKey) {
      setError("Please create a session key first");
      return;
    }

    if (!consumerBlobId || !consumerAllowlistId) {
      setError("Please enter both blob ID and allowlist ID");
      return;
    }

    setLoading(true);
    setError("");
    setStatus("Step 1/5: Building access proof...");

    try {
      // Step 1: Build seal_approve transaction (proves access)
      const txBytes = await buildSealApproveTransaction(
        consumerAllowlistId,
        consumerBlobId,
        suiClient
      );

      setStatus("Step 2/5: Fetching decryption keys from Seal servers...");

      // Step 2: Fetch decryption keys
      await fetchDecryptionKeys(
        [consumerAllowlistId],
        txBytes,
        sessionKey,
        sealClient
      );

      setStatus("Step 3/5: Downloading encrypted blob from Walrus...");

      // Step 3: Download encrypted blob
      const encryptedBlob = await downloadFromWalrusWithAccount(
        consumerBlobId,
        suiClient
      );

      const encryptedBytes = new Uint8Array(await encryptedBlob.arrayBuffer());

      setStatus(`Step 4/5: Decrypting data (${encryptedBytes.length} bytes)...`);

      // Step 4: Decrypt
      const decryptedData = await decryptData(
        encryptedBytes,
        sessionKey,
        txBytes,
        sealClient
      );

      setStatus("Step 5/5: Creating download...");

      // Step 5: Create blob for download
      // Convert Uint8Array to regular array for Blob constructor
      const blob = new Blob([new Uint8Array(decryptedData)]);
      setDownloadedData(blob);

      setStatus(
        `✅ Success! Decrypted ${decryptedData.length} bytes\nClick "Save File" to download`
      );
    } catch (err) {
      console.error("Download/decrypt error:", err);
      setError(`Download failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDecryptedFile = () => {
    if (!downloadedData) return;

    const url = URL.createObjectURL(downloadedData);
    const a = document.createElement("a");
    a.href = url;
    a.download = `decrypted-${consumerBlobId.slice(0, 8)}.bin`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setStatus("File downloaded!");
  };

  // Render
  return (
    <Container size="4" py="5">
      <Heading size="8" mb="2">
        Data Marketplace
      </Heading>
      <Text color="gray" size="3" mb="5">
        Decentralized data marketplace with Seal encryption, Walrus storage, and
        Move smart contracts
      </Text>

      {/* Connection Status */}
      <Card mb="5">
        <Flex direction="column" gap="3">
          <Heading size="4">Connection Status</Heading>
          <Text size="2">
            <strong>Wallet:</strong>{" "}
            {account?.address ? account.address : "Not connected"}
          </Text>
          <Text size="2">
            <strong>Session:</strong> {sessionStatus}
          </Text>
        </Flex>
      </Card>

      {/* Session Management Panel */}
      <Card mb="5">
        <Flex direction="column" gap="3">
          <Heading size="5">1. Session Management</Heading>
          <Text size="2" color="gray">
            Create a Seal session key to enable encryption/decryption (30 min
            lifetime)
          </Text>
          <Flex gap="2">
            <Button onClick={handleCreateSession} disabled={loading || !account}>
              {sessionKey ? "Refresh Session" : "Create Session Key"}
            </Button>
            <Button
              onClick={handleClearSession}
              variant="outline"
              color="red"
              disabled={!sessionKey}
            >
              Clear Session
            </Button>
          </Flex>
        </Flex>
      </Card>

      {/* Content Creator Panel */}
      <Card mb="5">
        <Flex direction="column" gap="3">
          <Heading size="5">2. Content Creator</Heading>
          <Text size="2" color="gray">
            Create allowlists and upload encrypted content
          </Text>

          <Separator size="4" />

          <Heading size="3">Create New Allowlist</Heading>
          <Flex gap="2">
            <TextField.Root
              placeholder="Allowlist name (e.g., Premium Content)"
              value={allowlistName}
              onChange={(e) => setAllowlistName(e.target.value)}
              style={{ flex: 1 }}
            />
            <Button onClick={handleCreateAllowlist} disabled={loading}>
              Create
            </Button>
          </Flex>

          {myAllowlists.length > 0 && (
            <>
              <Text size="2" weight="bold" mt="2">
                My Allowlists ({myAllowlists.length})
              </Text>
              <Box>
                {myAllowlists.map((al) => (
                  <Text key={al.id} size="1" style={{ display: "block" }}>
                    • {al.name} - ID: {al.id.slice(0, 20)}...
                  </Text>
                ))}
              </Box>
            </>
          )}

          <Separator size="4" />

          <Heading size="3">Upload Encrypted File</Heading>
          <input
            ref={fileInputRef}
            type="file"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
          />
          {selectedFile && (
            <Text size="2">
              Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)}{" "}
              KB)
            </Text>
          )}

          <Select.Root
            value={selectedAllowlistId}
            onValueChange={setSelectedAllowlistId}
          >
            <Select.Trigger placeholder="Select allowlist" />
            <Select.Content>
              {myAllowlists.map((al) => (
                <Select.Item key={al.id} value={al.id}>
                  {al.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>

          <Button
            onClick={handleEncryptAndUpload}
            disabled={loading || !selectedFile || !selectedAllowlistId}
          >
            Encrypt & Upload to Walrus
          </Button>

          {uploadedContents.length > 0 && (
            <>
              <Text size="2" weight="bold" mt="2">
                Uploaded Content ({uploadedContents.length})
              </Text>
              <Box>
                {uploadedContents.map((content) => (
                  <Text key={content.blobId} size="1" style={{ display: "block" }}>
                    • {content.fileName} - Blob: {content.blobId.slice(0, 20)}...
                  </Text>
                ))}
              </Box>
            </>
          )}
        </Flex>
      </Card>

      {/* Allowlist Manager Panel */}
      <Card mb="5">
        <Flex direction="column" gap="3">
          <Heading size="5">3. Allowlist Manager</Heading>
          <Text size="2" color="gray">
            Add or remove users from your allowlists
          </Text>

          <Flex gap="2">
            <TextField.Root
              placeholder="Allowlist ID"
              value={manageAllowlistId}
              onChange={(e) => setManageAllowlistId(e.target.value)}
              style={{ flex: 1 }}
            />
            <TextField.Root
              placeholder="Cap ID"
              value={manageCapId}
              onChange={(e) => setManageCapId(e.target.value)}
              style={{ flex: 1 }}
            />
            <Button onClick={handleLoadAllowlist} disabled={loading}>
              Load
            </Button>
          </Flex>

          {allowlistMembers.length > 0 && (
            <Box>
              <Text size="2" weight="bold">
                Members ({allowlistMembers.length}):
              </Text>
              {allowlistMembers.map((addr, idx) => (
                <Text key={idx} size="1" style={{ display: "block" }}>
                  • {addr}
                </Text>
              ))}
            </Box>
          )}

          <Separator size="4" />

          <Flex gap="2">
            <TextField.Root
              placeholder="User address to add/remove"
              value={addressToAdd}
              onChange={(e) => setAddressToAdd(e.target.value)}
              style={{ flex: 1 }}
            />
            <Button onClick={handleAddUser} disabled={loading}>
              Add User
            </Button>
            <Button onClick={handleRemoveUser} variant="outline" disabled={loading}>
              Remove User
            </Button>
          </Flex>
        </Flex>
      </Card>

      {/* Content Consumer Panel */}
      <Card mb="5">
        <Flex direction="column" gap="3">
          <Heading size="5">4. Content Consumer</Heading>
          <Text size="2" color="gray">
            Download and decrypt content you have access to
          </Text>

          <Flex gap="2">
            <TextField.Root
              placeholder="Blob ID"
              value={consumerBlobId}
              onChange={(e) => setConsumerBlobId(e.target.value)}
              style={{ flex: 1 }}
            />
            <TextField.Root
              placeholder="Allowlist ID"
              value={consumerAllowlistId}
              onChange={(e) => setConsumerAllowlistId(e.target.value)}
              style={{ flex: 1 }}
            />
          </Flex>

          <Button
            onClick={handleDownloadAndDecrypt}
            disabled={loading || !consumerBlobId || !consumerAllowlistId}
          >
            Download & Decrypt
          </Button>

          {downloadedData && (
            <Button onClick={handleSaveDecryptedFile} variant="solid" color="green">
              💾 Save Decrypted File ({Math.round(downloadedData.size / 1024)} KB)
            </Button>
          )}
        </Flex>
      </Card>

      {/* Status/Error Display */}
      {status && (
        <Callout.Root color="blue" mb="3">
          <Callout.Text style={{ whiteSpace: "pre-wrap" }}>
            {status}
          </Callout.Text>
        </Callout.Root>
      )}

      {error && (
        <Callout.Root color="red" mb="3">
          <Callout.Text style={{ whiteSpace: "pre-wrap" }}>{error}</Callout.Text>
        </Callout.Root>
      )}

      {loading && (
        <Callout.Root color="gray">
          <Callout.Text>Processing... Please wait</Callout.Text>
        </Callout.Root>
      )}
    </Container>
  );
}

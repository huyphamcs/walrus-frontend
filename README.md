# Walrus File Storage dApp

A decentralized file storage application built on the **Sui blockchain** using **Walrus** decentralized storage network. This dApp enables users to upload files to Walrus either via HTTP endpoints (testnet) or through wallet-signed transactions, with full support for downloading and managing uploaded files.

## Table of Contents

- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [Technology Stack](#technology-stack)
- [Installation](#installation)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
  - [Sui Blockchain APIs](#sui-blockchain-apis)
  - [Walrus Storage APIs](#walrus-storage-apis)
  - [Seal SDK APIs](#seal-sdk-apis)
- [Components Documentation](#components-documentation)
- [Services Documentation](#services-documentation)
- [Configuration](#configuration)
- [Usage Guide](#usage-guide)
- [Troubleshooting](#troubleshooting)
- [References](#references)

---

## Features

### Core Features
- ✅ **Dual Upload Methods**
  - **HTTP Upload**: Free testnet upload via publisher endpoint
  - **Transaction Upload**: Wallet-signed transactions with blob ownership

- ✅ **File Management**
  - Upload files of any type (text, images, videos, etc.)
  - Download files with data integrity verification
  - Copy blob IDs and Walrus URLs
  - Remove files from local storage
  - Persistent file list in localStorage

- ✅ **Wallet Integration**
  - Connect with Sui-compatible wallets
  - Multi-account support with account switching
  - Copy wallet address to clipboard
  - Secure transaction signing

- ✅ **Modern UI**
  - Drag-and-drop file upload
  - Progress indicators
  - Dark theme with Radix UI
  - Responsive design

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   App.tsx    │  │  Components  │  │   Services   │     │
│  │              │  │              │  │              │     │
│  │ - Main UI    │  │ - FileUpload │  │ - walrus.ts  │     │
│  │ - State Mgmt │  │ - Uploaded   │  │              │     │
│  │              │  │ - Account    │  │              │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
        ┌───────▼───────┐        ┌───────▼──────┐
        │  Sui Wallet   │        │   Walrus     │
        │               │        │   Network    │
        │ - Sign Txs    │        │              │
        │ - Manage Keys │        │ - Storage    │
        └───────────────┘        │ - Publisher  │
                                 │ - Aggregator │
                                 └──────────────┘
```

### Data Flow

#### HTTP Upload Flow
```
User Selects File
    ↓
Convert to ArrayBuffer
    ↓
HTTP PUT to Publisher Endpoint
    ↓
Walrus Encoding (Server-side)
    ↓
Store on Storage Nodes
    ↓
Return Blob ID
```

#### Transaction Upload Flow
```
User Selects File
    ↓
Convert to Uint8Array
    ↓
Create WalrusBlobFlow
    ↓
WASM Encoding (Client-side)
    ↓
Sign Registration Transaction
    ↓
Upload to Storage Nodes
    ↓
Sign Certification Transaction
    ↓
Return Blob ID
```

#### Download Flow
```
User Clicks Download
    ↓
Check Upload Method
    ↓
┌─────────────────┬─────────────────┐
│  HTTP Upload    │  Tx Upload      │
│                 │                 │
│  HTTP GET       │  SDK readBlob() │
│  from           │  with WASM      │
│  Aggregator     │  Decoding       │
└─────────────────┴─────────────────┘
    ↓
Convert to Blob
    ↓
Trigger Browser Download
```

---

## Technology Stack

### Frontend Framework
- **React 18.3.1** - UI library
- **TypeScript 5.9.2** - Type safety
- **Vite 7.1.5** - Build tool with SWC for fast compilation

### Blockchain & Storage
- **@mysten/sui 1.45.0** - Sui blockchain client
- **@mysten/dapp-kit 0.19.9** - Sui wallet integration
- **@mysten/walrus 0.8.4** - Walrus storage SDK
- **@mysten/walrus-wasm 0.1.1** - WASM encoding/decoding
- **@mysten/seal 0.9.4** - Encrypted storage (for future features)

### UI Components
- **@radix-ui/themes 3.2.1** - Design system
- **@radix-ui/react-icons 1.3.0** - Icon library
- **@tanstack/react-query 5.87.1** - Async state management

---

## Installation

### Prerequisites
- Node.js 18+ or Bun
- pnpm (recommended) or npm
- Sui-compatible wallet (e.g., Sui Wallet, Suiet)

### Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd walrus-frontend
```

2. **Install dependencies**
```bash
pnpm install
# or
npm install
```

3. **Configure Vite for WASM** (already configured)
The `vite.config.mts` includes necessary WASM configuration:
```typescript
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
  },
  worker: {
    format: 'es',
  },
  assetsInclude: ['**/*.wasm'],
})
```

4. **Start development server**
```bash
pnpm dev
# or
npm run dev
```

5. **Build for production**
```bash
pnpm build
# or
npm run build
```

---

## Project Structure

```
walrus-frontend/
├── src/
│   ├── components/
│   │   ├── AccountButton.tsx      # Wallet account management
│   │   ├── FileUpload.tsx         # File upload interface
│   │   └── UploadedFiles.tsx      # File list and management
│   │
│   ├── services/
│   │   └── walrus.ts              # Walrus API integration
│   │
│   ├── App.tsx                    # Main application component
│   ├── main.tsx                   # Application entry point
│   ├── networkConfig.ts           # Sui network configuration
│   └── vite-env.d.ts             # TypeScript declarations
│
├── public/                        # Static assets
├── vite.config.mts               # Vite configuration
├── tsconfig.json                 # TypeScript configuration
└── package.json                  # Dependencies
```

---

## API Documentation

## Sui Blockchain APIs

### @mysten/sui/client

The Sui client provides blockchain interaction capabilities.

#### SuiClient

**Initialization**
```typescript
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

const client = new SuiClient({
  url: getFullnodeUrl('testnet')
});
```

**Key Methods Used**

1. **getFullnodeUrl(network)**
   - Returns RPC endpoint URL for specified network
   - Networks: 'devnet' | 'testnet' | 'mainnet'
   ```typescript
   const url = getFullnodeUrl('testnet');
   // Returns: 'https://fullnode.testnet.sui.io:443'
   ```

### @mysten/dapp-kit

Provides React hooks for Sui wallet integration.

#### Core Hooks

1. **useCurrentAccount()**
   ```typescript
   const currentAccount = useCurrentAccount();
   // Returns: { address: string; ... } | null
   ```
   - Gets currently connected wallet account
   - Returns `null` if no wallet connected

2. **useAccounts()**
   ```typescript
   const accounts = useAccounts();
   // Returns: WalletAccount[]
   ```
   - Gets all available accounts from connected wallet
   - Used for account switching

3. **useSwitchAccount()**
   ```typescript
   const { mutate: switchAccount } = useSwitchAccount();

   switchAccount({
     account: targetAccount
   });
   ```
   - Switches between wallet accounts
   - Requires account object from `useAccounts()`

4. **useSignAndExecuteTransaction()**
   ```typescript
   const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

   const result = await signAndExecuteTransaction({
     transaction: tx,
   });
   // Returns: { digest: string; ... }
   ```
   - Signs and executes Sui transactions
   - Triggers wallet popup for user confirmation

5. **useDisconnectWallet()**
   ```typescript
   const { mutate: disconnect } = useDisconnectWallet();

   disconnect();
   ```
   - Disconnects currently connected wallet

6. **useSuiClient()**
   ```typescript
   const suiClient = useSuiClient();
   ```
   - Returns SuiClient instance configured for current network
   - Used with Walrus SDK

#### Provider Components

1. **SuiClientProvider**
   ```typescript
   <SuiClientProvider
     networks={networkConfig}
     defaultNetwork="testnet"
   >
     {children}
   </SuiClientProvider>
   ```
   - Provides SuiClient to all child components
   - Manages network switching

2. **WalletProvider**
   ```typescript
   <WalletProvider autoConnect>
     {children}
   </WalletProvider>
   ```
   - Manages wallet connection state
   - `autoConnect`: Automatically reconnects previous wallet

3. **ConnectButton**
   ```typescript
   <ConnectButton />
   ```
   - Pre-built wallet connection button
   - Handles wallet selection UI

### Transaction Building

```typescript
import { Transaction } from '@mysten/sui/transactions';

const tx = new Transaction();

// Example: Move call
tx.moveCall({
  target: `${PACKAGE_ID}::module::function`,
  arguments: [
    tx.object(OBJECT_ID),
    tx.pure.string("value"),
    tx.pure.u64(12345)
  ]
});

// Execute
const result = await signAndExecuteTransaction({ transaction: tx });
```

---

## Walrus Storage APIs

### @mysten/walrus

The Walrus SDK provides decentralized storage capabilities.

#### WalrusClient

**Initialization**
```typescript
import { WalrusClient } from '@mysten/walrus';
import { getFullnodeUrl } from '@mysten/sui/client';
import walrusWasmUrl from '@mysten/walrus-wasm/web/walrus_wasm_bg.wasm?url';

const walrusClient = new WalrusClient({
  network: 'testnet',
  suiRpcUrl: getFullnodeUrl('testnet'),
  wasmUrl: walrusWasmUrl
});
```

**Configuration Options**
```typescript
interface WalrusClientConfig {
  network: 'mainnet' | 'testnet';
  suiRpcUrl: string;
  wasmUrl?: string; // Required for browser environments
  storageNodeClientOptions?: {
    timeout?: number;
    fetch?: typeof fetch;
    onError?: (error: Error) => void;
  };
  uploadRelay?: {
    host: string;
    sendTip?: TipConfig;
  };
}
```

#### Core Methods

### 1. writeBlobFlow()

Creates a flow for uploading raw blob data with transaction signing.

**Purpose**: Upload files with wallet-signed transactions, giving the user ownership of the blob.

**Signature**
```typescript
writeBlobFlow({ blob }: { blob: Uint8Array }): WriteBlobFlow
```

**Returns**: `WriteBlobFlow` object with methods:

#### WriteBlobFlow Interface
```typescript
interface WriteBlobFlow {
  encode: () => Promise<void>;
  register: (options: WriteBlobFlowRegisterOptions) => Transaction;
  upload: (options: { digest: string }) => Promise<void>;
  certify: () => Transaction;
  getBlob: () => Promise<{ blobId: string; blobObject: Blob }>;
}
```

**Complete Example**
```typescript
// Step 1: Create flow
const fileData = new Uint8Array(await file.arrayBuffer());
const flow = walrusClient.writeBlobFlow({ blob: fileData });

// Step 2: Encode (WASM processing)
await flow.encode();

// Step 3: Create registration transaction
const registerTx = flow.register({
  epochs: 5,           // Storage duration
  owner: userAddress,  // Blob owner
  deletable: true,     // Can be deleted
});

// Step 4: Sign and execute registration
const registerResult = await signAndExecuteTransaction({
  transaction: registerTx,
});

// Step 5: Upload blob data to storage nodes
await flow.upload({ digest: registerResult.digest });

// Step 6: Create certification transaction
const certifyTx = flow.certify();

// Step 7: Sign and execute certification
await signAndExecuteTransaction({
  transaction: certifyTx,
});

// Step 8: Get blob ID
const { blobId } = await flow.getBlob();
console.log('Uploaded blob:', blobId);
```

### 2. writeFilesFlow()

Creates a flow for uploading multiple files in a quilt (container format).

**Purpose**: Upload multiple files together, stored as a single quilt object.

**Signature**
```typescript
writeFilesFlow({ files }: { files: WalrusFile[] }): WriteFilesFlow
```

**WalrusFile Creation**
```typescript
import { WalrusFile } from '@mysten/walrus';

const file1 = WalrusFile.from({
  contents: new Uint8Array(data),
  identifier: 'file1.txt',
  tags: { 'content-type': 'text/plain' }
});
```

**Example**
```typescript
const flow = walrusClient.writeFilesFlow({
  files: [file1, file2, file3]
});

await flow.encode();
const tx = flow.register({ epochs: 5, owner: userAddress, deletable: true });
const result = await signAndExecuteTransaction({ transaction: tx });
await flow.upload({ digest: result.digest });
const certifyTx = flow.certify();
await signAndExecuteTransaction({ transaction: certifyTx });

const files = await flow.listFiles();
files.forEach(f => console.log('Blob ID:', f.blobId));
```

### 3. readBlob()

Reads raw blob data from Walrus storage.

**Purpose**: Download files uploaded via `writeBlobFlow()`.

**Signature**
```typescript
readBlob({ blobId }: { blobId: string }): Promise<Uint8Array>
```

**Example**
```typescript
const blobId = 'tTp2nPBqo2U1Bt8hH0I7fbzTtPqhKgMB9u82jMmwmD0';
const data = await walrusClient.readBlob({ blobId });

// Convert to Blob for download
const blob = new Blob([new Uint8Array(data)]);
const url = URL.createObjectURL(blob);
```

### 4. getFiles()

Reads files from quilts (multi-file containers).

**Purpose**: Download files uploaded via `writeFilesFlow()`.

**Signature**
```typescript
getFiles({ ids }: { ids: string[] }): Promise<WalrusFile[]>
```

**Example**
```typescript
const [file1, file2] = await walrusClient.getFiles({
  ids: [blobId1, blobId2]
});

// Get file contents
const contents = await file1.bytes();
const text = await file1.text();
const json = await file1.json();

// Get file metadata
const identifier = await file1.getIdentifier();
const tags = await file1.getTags();
```

### 5. getBlob()

Gets a WalrusBlob object for advanced operations.

**Signature**
```typescript
getBlob({ blobId }: { blobId: string }): Promise<WalrusBlob>
```

**Example**
```typescript
const blob = await walrusClient.getBlob({ blobId });

// If blob is a quilt, get files
if (blob.isQuilt) {
  const files = await blob.files();
  const readme = await blob.files({ identifiers: ['README.md'] });
}
```

#### HTTP Upload (Publisher/Aggregator)

**Publisher Endpoint** - Upload files
```typescript
const PUBLISHER_URL = "https://publisher.walrus-testnet.walrus.space";

// Upload via HTTP PUT
const response = await fetch(`${PUBLISHER_URL}/v1/blobs?epochs=5`, {
  method: "PUT",
  headers: {
    'Content-Type': 'application/octet-stream',
  },
  body: arrayBuffer,
});

const result = await response.json();
// Response format:
{
  newlyCreated?: { blobObject: { blobId: string } },
  alreadyCertified?: { blobId: string },
  blobId?: string
}
```

**Aggregator Endpoint** - Download files
```typescript
const AGGREGATOR_URL = "https://aggregator.walrus-testnet.walrus.space";

// Download via HTTP GET
const response = await fetch(`${AGGREGATOR_URL}/v1/blobs/${blobId}`);
const blob = await response.blob();
```

#### Error Handling

```typescript
import { RetryableWalrusClientError } from '@mysten/walrus';

try {
  const data = await walrusClient.readBlob({ blobId });
} catch (error) {
  if (error instanceof RetryableWalrusClientError) {
    // Reset client and retry
    walrusClient.reset();
    // Retry operation
  } else {
    // Handle other errors
    console.error('Failed to read blob:', error);
  }
}
```

---

## Seal SDK APIs

The Seal SDK provides encrypted storage with programmable access control. While not currently implemented in this project, it's included in the dependencies for future features.

### @mysten/seal

**Purpose**: Add encryption and access control to Walrus-stored data.

#### SealClient

**Initialization**
```typescript
import { SealClient } from '@mysten/seal';

const sealClient = new SealClient({
  suiClient,
  serverConfigs: [
    { objectId: "0x<key_server_1>", weight: 1 },
    { objectId: "0x<key_server_2>", weight: 1 },
    { objectId: "0x<key_server_3>", weight: 1 }
  ],
  verifyKeyServers: true,
  timeout: 30000
});
```

#### Core Methods

### 1. encrypt()

Encrypts data with identity-based encryption.

```typescript
const { encryptedObject, key } = await sealClient.encrypt({
  packageId: PACKAGE_ID,
  id: 'unique_identity',
  data: fileData,
  threshold: 2,
  demType: DemType.AesGcm256
});

// Store encryptedObject on Walrus
const blobId = await uploadToWalrus(encryptedObject);

// Optional: Backup symmetric key
const backupKey = btoa(String.fromCharCode(...key));
```

### 2. decrypt()

Decrypts encrypted data with authorization.

```typescript
const decryptedData = await sealClient.decrypt({
  data: encryptedObject,
  sessionKey,
  txBytes,
  checkShareConsistency: true
});
```

### 3. SessionKey

Manages temporary session keys for authorization.

```typescript
const sessionKey = await SessionKey.create({
  address: userAddress,
  packageId: PACKAGE_ID,
  ttlMin: 15,
  signer,
  suiClient
});

// Export for storage
const exported = sessionKey.export();
localStorage.setItem('session_key', JSON.stringify(exported));

// Import later
const sessionKey = SessionKey.import(data, suiClient, signer);
```

#### Future Use Cases

- **Private file storage**: Encrypt files before uploading
- **Shared access**: Grant temporary access to specific users
- **NFT-gated content**: Require NFT ownership to decrypt
- **Subscription services**: Time-based access control
- **Medical records**: HIPAA-compliant encrypted storage

---

## Components Documentation

### App.tsx

**Main Application Component**

**Responsibilities**:
- Manages global application state
- Handles file upload success
- Persists uploaded files to localStorage
- Renders main UI layout

**Key State**:
```typescript
const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
```

**File Persistence**:
- Loads files from localStorage on mount
- Saves files to localStorage on every change
- Storage key: `"walrus-uploaded-files"`

**Props Passed to Children**:
- `onUploadSuccess`: Callback for successful uploads
- `files`: Array of uploaded files
- `onRemove`: Callback for file removal

---

### AccountButton.tsx

**Wallet Account Management Component**

**Features**:
1. Display connected wallet address
2. Copy address to clipboard
3. Switch between multiple accounts
4. Disconnect wallet

**Hooks Used**:
```typescript
const currentAccount = useCurrentAccount();
const accounts = useAccounts();
const { mutate: disconnect } = useDisconnectWallet();
const { mutate: switchAccount } = useSwitchAccount();
```

**UI Structure**:
```
[Button: 👤 0x1234...5678]
  ↓ Click
[Dropdown Menu]
├─ Connected Wallet: 0x1234...5678
├─ 📋 Copy Address
├─ Switch Account (if multiple accounts)
│  ├─ 0x1234...5678 [Active]
│  ├─ 0xabcd...ef01
│  └─ 0x9876...4321
└─ 🚪 Disconnect
```

**Address Formatting**:
```typescript
const formatAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};
```

---

### FileUpload.tsx

**File Upload Interface Component**

**Features**:
1. Drag-and-drop file upload
2. Click-to-browse file selection
3. Upload method selection (HTTP vs Transaction)
4. Progress indicator
5. Error display

**Upload Modes**:
```typescript
type UploadMode = "testnet" | "account";
```

- **Testnet Mode**: Free HTTP upload to testnet publisher
- **Account Mode**: Transaction-based upload with wallet signing

**Upload Flow**:
```typescript
const handleFileUpload = async (file: File) => {
  if (uploadMode === "testnet") {
    blobId = await uploadToWalrus(file);
  } else {
    blobId = await uploadToWalrusWithAccount(
      file,
      signAndExecuteTransaction,
      suiClient,
      currentAccount.address
    );
  }

  onUploadSuccess(blobId, file.name, file.size, uploadMethod);
};
```

**Progress Simulation**:
```typescript
const progressInterval = setInterval(() => {
  setUploadProgress((prev) => Math.min(prev + 10, 90));
}, 200);
```

**UI Elements**:
- SegmentedControl for mode selection
- Drag-drop zone
- File input (hidden)
- Progress bar
- Error message display

---

### UploadedFiles.tsx

**File List Management Component**

**Features**:
1. Display uploaded files in table
2. Download files
3. Copy blob ID
4. Copy Walrus URL
5. Remove files from list

**File Interface**:
```typescript
export interface UploadedFile {
  blobId: string;
  fileName: string;
  fileSize: number;
  uploadedAt: Date;
  uploadMethod?: "http" | "transaction";
}
```

**Download Logic**:
```typescript
const handleDownload = async (file: UploadedFile) => {
  // Use appropriate download method based on upload method
  const blob = file.uploadMethod === "transaction"
    ? await downloadFromWalrusWithAccount(file.blobId, suiClient)
    : await downloadFromWalrus(file.blobId);

  // Trigger browser download
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.fileName;
  a.click();
};
```

**Table Structure**:
```
| File Name | Size | Blob ID | Uploaded | Actions |
|-----------|------|---------|----------|---------|
| test.txt  | 1 KB | tTp2... | 2:30 PM  | ⬇️ 📋 🗑️ |
```

**Actions**:
- ⬇️ Download: Triggers file download
- 📋 Copy: Copies blob ID or URL
- 🗑️ Remove: Removes from local list

---

## Services Documentation

### walrus.ts

**Walrus API Integration Service**

Contains all Walrus-related functionality.

#### Constants

```typescript
const AGGREGATOR_URL = "https://aggregator.walrus-testnet.walrus.space";
const PUBLISHER_URL = "https://publisher.walrus-testnet.walrus.space";
const EPOCHS = 5; // Storage duration
```

#### Functions

### 1. uploadToWalrus()

**HTTP-based upload to Walrus testnet**

```typescript
export async function uploadToWalrus(file: File): Promise<string>
```

**Process**:
1. Convert file to ArrayBuffer
2. PUT request to publisher endpoint
3. Parse response for blob ID
4. Return blob ID

**Response Handling**:
```typescript
if (result.newlyCreated?.blobObject?.blobId) {
  return result.newlyCreated.blobObject.blobId;
} else if (result.alreadyCertified?.blobId) {
  return result.alreadyCertified.blobId;
} else if (result.blobId) {
  return result.blobId;
}
```

### 2. uploadToWalrusWithAccount()

**Transaction-based upload with wallet signing**

```typescript
export async function uploadToWalrusWithAccount(
  file: File,
  signAndExecuteTransaction: (input: any) => Promise<any>,
  _suiClient: SuiClient,
  userAddress: string
): Promise<string>
```

**6-Step Process**:
1. **Initialize**: Create WalrusClient
2. **Encode**: WASM encoding of blob
3. **Register**: Create registration transaction
4. **Sign**: User signs transaction
5. **Upload**: Upload to storage nodes
6. **Certify**: Create and sign certification transaction

**Key Differences from HTTP Upload**:
- Requires wallet connection
- User owns the blob on-chain
- Two transaction signatures required
- Client-side WASM encoding
- Blob can be deleted by owner

### 3. downloadFromWalrus()

**HTTP-based download from aggregator**

```typescript
export async function downloadFromWalrus(blobId: string): Promise<Blob>
```

**Used for**: Files uploaded via `uploadToWalrus()`

**Process**:
1. GET request to aggregator endpoint
2. Convert response to Blob
3. Return Blob

### 4. downloadFromWalrusWithAccount()

**SDK-based download with WASM decoding**

```typescript
export async function downloadFromWalrusWithAccount(
  blobId: string,
  suiClient: SuiClient
): Promise<Blob>
```

**Used for**: Files uploaded via `uploadToWalrusWithAccount()`

**Process**:
1. Initialize WalrusClient (if needed)
2. Use `readBlob()` to read raw blob data
3. WASM decoding happens automatically
4. Convert Uint8Array to Blob
5. Return Blob

**Why Different Download Methods?**

| Upload Method | Download Method | Reason |
|---------------|-----------------|---------|
| HTTP | HTTP Aggregator | Direct blob access |
| Transaction | SDK readBlob() | Requires WASM decoding |

### 5. getWalrusUrl()

**Get public HTTP URL for blob**

```typescript
export function getWalrusUrl(blobId: string): string {
  return `${AGGREGATOR_URL}/v1/blobs/${blobId}`;
}
```

### 6. formatFileSize()

**Format bytes to human-readable size**

```typescript
export function formatFileSize(bytes: number): string {
  const sizes = ["Bytes", "KB", "MB", "GB"];
  // Returns: "1.5 MB"
}
```

---

## Configuration

### networkConfig.ts

**Sui Network Configuration**

```typescript
import { getFullnodeUrl } from "@mysten/sui/client";
import { createNetworkConfig } from "@mysten/dapp-kit";

const { networkConfig, useNetworkVariable, useNetworkVariables } =
  createNetworkConfig({
    devnet: {
      url: getFullnodeUrl("devnet"),
    },
    testnet: {
      url: getFullnodeUrl("testnet"),
    },
    mainnet: {
      url: getFullnodeUrl("mainnet"),
    },
  });

export { useNetworkVariable, useNetworkVariables, networkConfig };
```

**Usage in main.tsx**:
```typescript
<SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
  <WalletProvider autoConnect>
    <App />
  </WalletProvider>
</SuiClientProvider>
```

### vite.config.mts

**Vite Configuration for Walrus**

```typescript
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext', // Required for WASM
  },
  worker: {
    format: 'es', // Required for WASM workers
  },
  assetsInclude: ['**/*.wasm'], // Include WASM files
})
```

**WASM URL Import**:
```typescript
import walrusWasmUrl from '@mysten/walrus-wasm/web/walrus_wasm_bg.wasm?url';
```

---

## Usage Guide

### Basic File Upload

1. **Connect Wallet**
   - Click "Connect Wallet" button
   - Select wallet (e.g., Sui Wallet)
   - Approve connection

2. **Select Upload Method**
   - **Testnet (Free)**: No transaction signatures required
   - **Signed Account**: Requires wallet signatures, you own the blob

3. **Upload File**
   - Drag file to upload zone, or
   - Click zone to browse files
   - Wait for progress bar to complete
   - File appears in "Uploaded Files" list

### Download File

1. **Locate File**
   - Find file in "Uploaded Files" table

2. **Click Download Button**
   - Click ⬇️ icon
   - File downloads automatically

### Copy Blob Information

**Copy Blob ID**:
1. Click 📋 icon next to blob ID
2. "Copied!" confirmation appears
3. Paste anywhere (e.g., Ctrl+V)

**Copy Walrus URL**:
1. Click 📋 icon in Actions column
2. Direct HTTP URL is copied
3. Can be shared or accessed in browser

### Switch Wallet Account

1. **Open Account Menu**
   - Click account button (shows current address)

2. **Select Account**
   - If multiple accounts available, see "Switch Account" section
   - Click desired account
   - Current account shows "Active" badge

3. **Copy Address**
   - Click "Copy Address" in dropdown
   - Full address copied to clipboard

### Remove File

1. **Click Remove Button**
   - Click 🗑️ icon in Actions column
   - File removed from local list
   - Note: File still exists on Walrus

---

## Troubleshooting

### Upload Issues

**Problem**: "Failed to upload file"

**Solutions**:
1. Check wallet connection
2. Ensure sufficient SUI for gas (transaction mode)
3. Verify network connectivity
4. Check file size (large files take longer)

**Problem**: Upload stuck at 90%

**Solution**:
- This is normal - final step takes longer
- Wait for storage node confirmation
- Don't refresh the page

### Download Issues

**Problem**: Downloaded file is corrupted

**Solution**:
- Check upload method indicator
- Ensure correct download method is used
- HTTP uploads use HTTP download
- Transaction uploads use SDK download

**Problem**: Download fails with error

**Solutions**:
1. Verify blob ID is correct
2. Check network connectivity
3. Try copying Walrus URL and accessing directly
4. Blob may not be fully certified yet (wait 1-2 minutes)

### Wallet Issues

**Problem**: Wallet not connecting

**Solutions**:
1. Install Sui-compatible wallet extension
2. Unlock wallet
3. Refresh page
4. Clear browser cache

**Problem**: Can't see multiple accounts

**Solution**:
- Create additional accounts in your wallet
- They will appear automatically in dropdown

**Problem**: Transaction signature popup not appearing

**Solutions**:
1. Check browser popup blocker
2. Wallet extension may be locked
3. Try disconnecting and reconnecting

### General Issues

**Problem**: Files not persisting after refresh

**Solution**:
- Check browser localStorage is enabled
- Check localStorage quota
- Files stored in: `walrus-uploaded-files`

**Problem**: WASM errors in console

**Solution**:
- Ensure `@mysten/walrus-wasm` is installed
- Check vite.config.mts has WASM configuration
- Clear build cache: `rm -rf node_modules/.vite`

---

## References

### Official Documentation

- **Sui Documentation**: https://docs.sui.io/
- **Walrus Documentation**: https://docs.walrus.site/
- **Seal Documentation**: https://seal-docs.wal.app/
- **Mysten Labs GitHub**: https://github.com/MystenLabs/

### SDK References

- **@mysten/dapp-kit**: https://sdk.mystenlabs.com/dapp-kit
- **@mysten/sui**: https://sdk.mystenlabs.com/typescript
- **@mysten/walrus**: https://sdk.mystenlabs.com/walrus

### Walrus Endpoints

**Testnet**:
- Publisher: https://publisher.walrus-testnet.walrus.space
- Aggregator: https://aggregator.walrus-testnet.walrus.space

**CLI Tool**:
```bash
# Install Walrus CLI
cargo install walrus

# Read blob
walrus read <blob-id>

# Upload blob
walrus store <file-path>
```

### Community

- **Sui Discord**: https://discord.gg/sui
- **Sui Twitter**: https://twitter.com/SuiNetwork
- **Walrus Twitter**: https://twitter.com/WalrusProtocol

---

## License

This project is open source and available under the MIT License.

---

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

## Acknowledgments

Built with:
- Mysten Labs Sui & Walrus SDKs
- Radix UI Design System
- React & TypeScript
- Vite Build Tool

Special thanks to the Sui and Walrus developer communities!

import { useState } from "react";
import { useCurrentAccount, useDisconnectWallet, ConnectButton, useAccounts, useSwitchAccount } from "@mysten/dapp-kit";
import { Button, DropdownMenu, Flex, Text, Separator, Badge } from "@radix-ui/themes";
import { CheckIcon, CopyIcon, ExitIcon, PersonIcon } from "@radix-ui/react-icons";

export function AccountButton() {
  const currentAccount = useCurrentAccount();
  const accounts = useAccounts();
  const { mutate: disconnect } = useDisconnectWallet();
  const { mutate: switchAccount } = useSwitchAccount();
  const [copied, setCopied] = useState(false);

  // If not connected, show the default connect button
  if (!currentAccount) {
    return <ConnectButton />;
  }

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(currentAccount.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy address:", error);
    }
  };

  const handleSwitchAccount = (accountAddress: string) => {
    const targetAccount = accounts.find(acc => acc.address === accountAddress);
    if (targetAccount) {
      switchAccount({ account: targetAccount });
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <Button variant="soft" style={{ cursor: "pointer" }}>
          <PersonIcon width="16" height="16" />
          {formatAddress(currentAccount.address)}
        </Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Content>
        <DropdownMenu.Label>
          <Flex direction="column" gap="1">
            <Text size="1" weight="medium" color="gray">
              Connected Wallet
            </Text>
            <Text size="2" weight="bold">
              {formatAddress(currentAccount.address)}
            </Text>
          </Flex>
        </DropdownMenu.Label>

        <Separator size="4" my="1" />

        <DropdownMenu.Item onClick={handleCopyAddress}>
          {copied ? (
            <>
              <CheckIcon width="14" height="14" />
              Copied!
            </>
          ) : (
            <>
              <CopyIcon width="14" height="14" />
              Copy Address
            </>
          )}
        </DropdownMenu.Item>

        {/* Show account switching if multiple accounts available */}
        {accounts.length > 1 && (
          <>
            <Separator size="4" my="1" />
            <DropdownMenu.Label>
              <Text size="1" weight="medium" color="gray">
                Switch Account
              </Text>
            </DropdownMenu.Label>
            {accounts.map((account) => (
              <DropdownMenu.Item
                key={account.address}
                onClick={() => handleSwitchAccount(account.address)}
                disabled={account.address === currentAccount.address}
              >
                <Flex align="center" justify="between" style={{ width: "100%" }}>
                  <Text size="2" style={{ fontFamily: "monospace" }}>
                    {formatAddress(account.address)}
                  </Text>
                  {account.address === currentAccount.address && (
                    <Badge color="blue" size="1">Active</Badge>
                  )}
                </Flex>
              </DropdownMenu.Item>
            ))}
          </>
        )}

        <Separator size="4" my="1" />

        <DropdownMenu.Item color="red" onClick={() => disconnect()}>
          <ExitIcon width="14" height="14" />
          Disconnect
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

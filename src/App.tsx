import { Outlet, Link, useLocation } from "react-router-dom";
import { Box, Flex, Heading, Button } from "@radix-ui/themes";
import { AccountButton } from "./components/AccountButton";

function App() {
  const location = useLocation();

  return (
    <>
      <Flex
        position="sticky"
        px="4"
        py="2"
        justify="between"
        align="center"
        style={{
          borderBottom: "1px solid var(--gray-a2)",
        }}
      >
        <Flex align="center" gap="4">
          <Heading>Walrus File Storage</Heading>
          <Flex gap="2">
            <Link to="/">
              <Button
                variant={location.pathname === "/" ? "solid" : "soft"}
                size="2"
              >
                File Storage
              </Button>
            </Link>
            <Link to="/marketplace">
              <Button
                variant={location.pathname === "/marketplace" ? "solid" : "soft"}
                size="2"
              >
                Data Marketplace
              </Button>
            </Link>
          </Flex>
        </Flex>

        <Box>
          <AccountButton />
        </Box>
      </Flex>

      <Outlet />
    </>
  );
}

export default App;

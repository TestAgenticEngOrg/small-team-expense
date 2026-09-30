import { type ReactElement } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  AppShell as OxygenAppShell,
  Header,
  Sidebar,
  Footer,
  UserMenu,
  ColorSchemeToggle,
  Divider,
} from "@wso2/oxygen-ui";
import { Receipt, ClipboardCheck, LogOut } from "@wso2/oxygen-ui-icons-react";
import { APP_NAME } from "../appName";
import { Can, useAuthz } from "../authz/gates";
import { signOut } from "../authz/session";

/** One rail. Every item is gated with <Can>, so a Manager who is also an
 * Employee sees the union, and the sample's shell shape (react-webapp,
 * oxygen-ui-design-system) is honoured on every screen. */
export function AppShell(): ReactElement {
  const { pathname } = useLocation();
  const { username } = useAuthz();
  const active = pathname.startsWith("/approvals")
    ? "managerqueue"
    : pathname.startsWith("/expenses")
      ? "myexpenses"
      : "myexpenses";

  return (
    <OxygenAppShell>
      <OxygenAppShell.Navbar>
        <Header>
          <Header.Toggle />
          <Header.Brand>
            <Header.BrandTitle>{APP_NAME}</Header.BrandTitle>
          </Header.Brand>
          <Header.Spacer />
          <Header.Actions>
            <ColorSchemeToggle />
            <Divider orientation="vertical" flexItem sx={{ mx: 2 }} />
            <UserMenu>
              <UserMenu.Trigger name={username || "Signed in"} />
              <UserMenu.Header name={username || "Signed in"} email={username} />
              <UserMenu.Logout icon={<LogOut />} onClick={() => void signOut()} />
            </UserMenu>
          </Header.Actions>
        </Header>
      </OxygenAppShell.Navbar>

      <OxygenAppShell.Sidebar>
        <Sidebar activeItem={active}>
          <Sidebar.Nav>
            <Sidebar.Category>
              <Can op="GET /me/expenses">
                <Sidebar.Item id="myexpenses" link={<Link to="/expenses" />}>
                  <Sidebar.ItemIcon>
                    <Receipt />
                  </Sidebar.ItemIcon>
                  <Sidebar.ItemLabel>My Expenses</Sidebar.ItemLabel>
                </Sidebar.Item>
              </Can>
              <Can op="POST /me/expenses">
                <Sidebar.Item id="submitexpense" link={<Link to="/expenses/new" />}>
                  <Sidebar.ItemIcon>
                    <Receipt />
                  </Sidebar.ItemIcon>
                  <Sidebar.ItemLabel>Submit Expense</Sidebar.ItemLabel>
                </Sidebar.Item>
              </Can>
              <Can op="GET /me/team/expenses">
                <Sidebar.Item id="managerqueue" link={<Link to="/approvals" />}>
                  <Sidebar.ItemIcon>
                    <ClipboardCheck />
                  </Sidebar.ItemIcon>
                  <Sidebar.ItemLabel>Approvals</Sidebar.ItemLabel>
                </Sidebar.Item>
              </Can>
            </Sidebar.Category>
          </Sidebar.Nav>
        </Sidebar>
      </OxygenAppShell.Sidebar>

      <OxygenAppShell.Main>
        <Outlet />
      </OxygenAppShell.Main>

      <OxygenAppShell.Footer>
        <Footer>
          <Footer.Copyright>© WSO2 LLC</Footer.Copyright>
        </Footer>
      </OxygenAppShell.Footer>
    </OxygenAppShell>
  );
}

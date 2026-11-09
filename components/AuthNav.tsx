import OwnerNav from "./OwnerNav";

// Owner links in the site nav. A Server Component: it reads the session
// on the server, so the nav shows the right links without a client fetch.
// Rendered by the (server) homepage and passed into the client HomeClient
// as a prop — client components cannot import server components directly.
// The buttons themselves live in OwnerNav, shared with the owner pages.
export default async function AuthNav() {
  return <OwnerNav />;
}

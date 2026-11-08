import GroomProClient from "./groompro-client";

// The document must come from the deployment that serves its hashed assets.
export const dynamic = "force-dynamic";

export default function Page() {
  return <GroomProClient />;
}

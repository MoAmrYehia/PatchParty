import PatchParty from "./components/PatchParty";
export default async function Home({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  const params = await searchParams;
  return <PatchParty initialStage={Boolean(params.stage)} />;
}

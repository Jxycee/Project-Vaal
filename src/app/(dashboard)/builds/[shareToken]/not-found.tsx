// Rendered by notFound() in ./page.tsx — a bad token, an RPC error and a
// `private` build all land here identically, on purpose (see that file).
export default function SharedBuildNotFound() {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <h1 className="font-heading text-lg font-semibold text-foreground">Build not found</h1>
      <p className="text-sm text-muted-foreground">That build is not available.</p>
    </div>
  );
}

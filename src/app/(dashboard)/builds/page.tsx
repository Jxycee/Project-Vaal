import MyBuildsList from '@/components/builds/MyBuildsList';

export const metadata = { title: 'Builds' };

export default function BuildsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Your builds</h1>
      <MyBuildsList />
    </div>
  );
}

import HomeClient from './HomeClient';
import { getRecentSuccesses } from '@/server/playHistory/getRecentSuccesses';

export const revalidate = 30;

export default async function Page() {
  const { items } = await getRecentSuccesses({ limit: 10 });
  return <HomeClient initialRecentSuccesses={items} />;
}
